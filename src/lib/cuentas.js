// Cuentas de usuario de Mi Despacho (Supabase Auth). Las claves las guarda Supabase cifradas (bcrypt);
// Mi Despacho nunca las ve ni las almacena.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_KEY } from "../config.js";

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "md-sesion" },
});

const traducir = (m = "") =>
  /invalid login credentials/i.test(m) ? "Correo o clave incorrectos." :
  /rate|too many/i.test(m) ? "Demasiados intentos. Espera unos minutos." :
  /network|fetch/i.test(m) ? "No hay conexión. Revisa internet." : "No se ha podido entrar. Inténtalo de nuevo.";

// Paso 1: usuario y clave. Devuelve qué falta del doble factor.
export async function entrar(email, clave) {
  const { error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: clave });
  if (error) throw new Error(traducir(error.message));
  return estadoMFA();
}

// Doble factor (código de la app del móvil: Google Authenticator, Microsoft Authenticator…)
export async function estadoMFA() {
  const { data: s } = await sb.auth.getSession();
  if (!s.session) return { sesion: false };
  const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  const { data: f } = await sb.auth.mfa.listFactors();
  const totp = (f?.totp || []).filter((x) => x.status === "verified");
  return { sesion: true, nivel: aal?.currentLevel, inscrito: totp.length > 0, factor: totp[0]?.id };
}
export async function iniciarAltaMFA() {
  const { data: f } = await sb.auth.mfa.listFactors();
  for (const x of (f?.all || []).filter((x) => x.status !== "verified")) await sb.auth.mfa.unenroll({ factorId: x.id });
  const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "Mi Despacho " + new Date().toISOString().slice(0, 10) });
  if (error) throw new Error("No se pudo preparar el doble factor.");
  return { id: data.id, uri: data.totp.uri, secreto: data.totp.secret };
}
export async function verificarMFA(factorId, codigo) {
  const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code: String(codigo).replace(/\s/g, "") });
  if (error) throw new Error("El código no es correcto o ha caducado. Prueba con el siguiente.");
  const yo = await miFicha();
  if (!yo || yo.estado !== "activo") { await sb.auth.signOut(); throw new Error("Tu acceso no está activo. Habla con la administradora."); }
  sb.rpc("registrar_entrada").then(() => {}, () => {});
  return yo;
}

export async function salir() { await sb.auth.signOut(); }

export async function miFicha() {
  const { data: s } = await sb.auth.getSession();
  const email = s.session?.user?.email;
  if (!email) return null;
  const { data } = await sb.from("usuarios_permitidos").select("email,nombre,rol,estado,organizacion,tipo_cuenta").eq("email", email.toLowerCase()).maybeSingle();
  return data;
}

export async function crearClave(email, codigo, clave) {
  // (tras crear la clave, la persona entra y configura su doble factor)
  const r = await fetch(`${SUPABASE_URL}/functions/v1/crear-clave`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
    body: JSON.stringify({ email, codigo, clave }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "No se pudo guardar la clave.");
}

export async function pedirAcceso(nombre, email) {
  const { error } = await sb.from("solicitudes_alta").insert({ nombre: nombre.trim(), email: email.trim().toLowerCase() });
  // Si ya hay una solicitud pendiente con ese correo, se trata como hecha (no se revela nada más)
  if (error && error.code !== "23505") throw new Error("No se pudo enviar la solicitud. Revisa los datos.");
}

// ---- administración (solo funciona si quien llama es administradora; lo comprueba la base de datos) ----
export const admin = {
  async usuarios() { const { data, error } = await sb.from("usuarios_permitidos").select("email,nombre,rol,estado,organizacion,tipo_cuenta,codigo_expira,creado,autorizado_por").order("creado"); if (error) throw error; return data; },
  async solicitudes() { const { data, error } = await sb.from("solicitudes_alta").select("*").eq("estado", "pendiente").order("creada"); if (error) throw error; return data; },
  async autorizar(id, rol = "usuario") { const { data, error } = await sb.rpc("admin_autorizar", { p_solicitud: id, p_rol: rol }); if (error) throw error; return data; },
  async rechazar(id) { const { error } = await sb.rpc("admin_rechazar", { p_solicitud: id }); if (error) throw error; },
  async codigo(email) { const { data, error } = await sb.rpc("admin_generar_codigo", { p_email: email }); if (error) throw error; return data; },
  async estado(email, estado) { const { error } = await sb.rpc("admin_estado", { p_email: email, p_estado: estado }); if (error) throw error; },
  async ficha(email, nombre, organizacion, tipo) { const { error } = await sb.rpc("admin_ficha", { p_email: email, p_nombre: nombre, p_organizacion: organizacion, p_tipo: tipo }); if (error) throw error; },
  async registro() { const { data, error } = await sb.from("registro").select("*").order("en", { ascending: false }).limit(100); if (error) throw error; return data; },
};
