// Aislamiento entre usuarios y empresas en el navegador (multiempresa).
// Todo lo que Mi Despacho guarda en el navegador (configuración, contratos, calendario, plantillas…) se guarda
// bajo un "espacio" = usuario + empresa. Otro usuario, u otra empresa, no ve nada de lo anterior.
let espacio = null;
const PROPIAS = /^(md-|mi-despacho|bitini-)/;
const GLOBALES = (k) => k.startsWith("md-sesion") || k === "md-pgc-actualizado" || k.startsWith("md-ultima-empresa");
const orig = { get: Storage.prototype.getItem, set: Storage.prototype.setItem, del: Storage.prototype.removeItem };
const clave = (k) => (!espacio || typeof k !== "string" || !PROPIAS.test(k) || GLOBALES(k) ? k : `esp:${espacio}:${k}`);

Storage.prototype.getItem = function (k) { return orig.get.call(this, clave(k)); };
Storage.prototype.setItem = function (k, v) { return orig.set.call(this, clave(k), v); };
Storage.prototype.removeItem = function (k) { return orig.del.call(this, clave(k)); };

export function fijarEspacio(email, empresaId) { espacio = email && empresaId ? `${email.toLowerCase()}|${empresaId}` : null; }
export const espacioActual = () => espacio;

// Datos antiguos (de antes de las cuentas de usuario) guardados sin espacio
export function hayDatosAntiguos() {
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (PROPIAS.test(k) && !GLOBALES(k)) return true; }
  return false;
}
// Pasa los datos antiguos al espacio actual y los borra de donde estaban (así nadie más los ve)
export function moverDatosAntiguos() {
  const ks = [];
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (PROPIAS.test(k) && !GLOBALES(k)) ks.push(k); }
  for (const k of ks) { const v = orig.get.call(localStorage, k); orig.set.call(localStorage, `esp:${espacio}:${k}`, v); orig.del.call(localStorage, k); }
  return ks.length;
}
export function borrarDatosAntiguos() {
  const ks = [];
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (PROPIAS.test(k) && !GLOBALES(k)) ks.push(k); }
  ks.forEach((k) => orig.del.call(localStorage, k));
}
