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
