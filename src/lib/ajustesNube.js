// Ajustes en la cuenta (no solo en el navegador): logo, colores, plantillas, calendario… de cada usuaria y empresa.
// Así se ven igual en cualquier dirección (midespacho.vercel.app, el dominio de la empresa) y en cualquier ordenador.
import { sb } from "./cuentas.js";

const NO_SUBIR = /clave|key|token|secret|sesion|password/i; // las claves de IA y similares se quedan solo en el navegador
const pref = (esp) => `esp:${esp}:`;
const SELLO = "__actualizado";

function recoger(esp) {
  const p = pref(esp), out = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(p)) { const c = k.slice(p.length); if (c !== SELLO && !NO_SUBIR.test(c)) out[c] = localStorage.getItem(k); }
  }
  return out;
}
const sello = (esp, t) => { try { localStorage.setItem(pref(esp) + SELLO, String(t)); } catch { /* nada */ } };

export async function subirAjustes(email, empresaId) {
  const esp = `${email.toLowerCase()}|${empresaId}`;
  const datos = recoger(esp);
  if (!Object.keys(datos).length) return false;
  const actualizado = new Date().toISOString();
  const { error } = await sb.from("ajustes_usuario").upsert({ email: email.toLowerCase(), empresa_id: empresaId, datos, actualizado });
  if (!error) sello(esp, Date.parse(actualizado));
  return !error;
}

// Al entrar en una empresa: si en la cuenta hay ajustes más nuevos, se traen; si no, se suben los de este navegador
export async function sincronizarAjustes(email, empresaId) {
  const esp = `${email.toLowerCase()}|${empresaId}`;
  try {
    const { data } = await sb.from("ajustes_usuario").select("datos,actualizado").eq("email", email.toLowerCase()).eq("empresa_id", empresaId).maybeSingle();
    const local = recoger(esp);
    const tLocal = +localStorage.getItem(pref(esp) + SELLO) || 0;
    const hayLocal = Object.keys(local).length > 0;
    if (data && (!hayLocal || Date.parse(data.actualizado) > tLocal)) {
      for (const [k, v] of Object.entries(data.datos || {})) if (typeof v === "string") localStorage.setItem(pref(esp) + k, v);
      sello(esp, Date.parse(data.actualizado));
      return "traidos";
    }
    if (hayLocal && (!data || tLocal === 0 || tLocal > Date.parse(data.actualizado))) return (await subirAjustes(email, empresaId)) ? "subidos" : "error";
    return "iguales";
  } catch { return "error"; }
}

// Claves de IA: se guardan en la cuenta CIFRADAS (clave maestra en el Vault de Supabase) y solo las lee la propia usuaria
// con la sesión en dos pasos. Así se piden una vez y valen en cualquier ordenador y dirección.
export async function subirClavesIA(claves, modo) {
  try {
    const datos = { ...claves };
    if (modo) datos.modo = modo;
    const { error } = await sb.rpc("guardar_claves_ia", { p_claves: datos });
    return !error;
  } catch { return false; }
}
export async function traerClavesIA() {
  try {
    const { data, error } = await sb.rpc("mis_claves_ia");
    if (error || !data) return false;
    const { leerClaves, guardarClaves, guardarModo } = await import("../ia-navegador.js");
    const { modo, ...nube } = data;
    const local = leerClaves();
    const juntas = { ...local, ...Object.fromEntries(Object.entries(nube).filter(([, v]) => v)) };
    guardarClaves(juntas, { sinSubir: true });
    if (modo) guardarModo(modo, { sinSubir: true });
    // Si en este navegador había claves que la cuenta no tiene (p. ej. en la dirección antigua), se suben
    if (Object.keys(local).some((k) => local[k] && !nube[k])) await subirClavesIA(juntas, modo);
    return true;
  } catch { return false; }
}
