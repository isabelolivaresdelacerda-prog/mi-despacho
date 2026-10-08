// Plan General de Contabilidad: cuadro de cuentas volcado del BOE (texto consolidado) y comprobación de cambios.
// - pgc: RD 1514/2007 (BOE-A-2007-19884) · pymes: RD 1515/2007 (BOE-A-2007-19966)
// - esfl: PYMES + cuentas propias de entidades sin fines lucrativos (asociaciones, fundaciones; Resolución ICAC 26-3-2013)
import BASE from "../../data/pgc.json";

const CLAVE = "md-pgc-actualizado"; // versiones descargadas del BOE después de publicar la app
const leer = () => { try { return JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch { return {}; } };

export const ESFL = {
  "101": "Fondo social", "130": "Subvenciones oficiales de capital", "131": "Donaciones y legados de capital", "132": "Otras subvenciones, donaciones y legados",
  "412": "Beneficiarios, acreedores", "447": "Usuarios, deudores", "448": "Patrocinadores, afiliados y otros deudores",
  "650": "Ayudas monetarias", "651": "Ayudas no monetarias", "653": "Compensación de gastos por prestaciones de colaboración", "654": "Reembolsos de gastos al órgano de gobierno",
  "720": "Cuotas de asociados y afiliados", "721": "Cuotas de usuarios", "722": "Promociones para captación de recursos", "723": "Ingresos de patrocinadores y colaboraciones",
  "725": "Subvenciones oficiales a la actividad propia", "726": "Donaciones y otros ingresos para actividades", "728": "Ingresos por reintegro de ayudas y asignaciones",
};

export function plan(tipo = "pymes") {
  const base = tipo === "pgc" ? "pgc" : "pymes";
  const act = leer()[base];
  const p = act || BASE[base];
  return { ...p, clave: base, cuentas: tipo === "esfl" ? { ...p.cuentas, ...ESFL } : p.cuentas, esfl: tipo === "esfl" };
}

// Título de una cuenta o subcuenta (busca de la más larga a la más corta: 62300001 → 623)
export function tituloCuenta(cuenta, tipo) {
  const c = String(cuenta).replace(/0+$/, "") || String(cuenta);
  const cs = plan(tipo).cuentas;
  for (let n = Math.min(5, String(cuenta).length); n >= 2; n--) { const k = String(cuenta).slice(0, n); if (cs[k]) return cs[k]; }
  return cs[c] || "";
}
export const grupoDe = (cuenta, tipo) => plan(tipo).grupos[String(cuenta)[0]] || "";

// Cuenta a 8 dígitos: 623 → 62300000; con número de tercero: 410 + 1 → 41000001
export const a8 = (cuenta, n = 0) => { const s = String(cuenta); return s.length >= 8 ? s.slice(0, 8) : s + String(n).padStart(8 - s.length, "0"); };

// ---- Comprobar en el BOE si el PGC ha cambiado ----
const API = "https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/";
export async function comprobarBOE(tipo = "pymes") {
  const p = plan(tipo);
  const r = await fetch(`${API}${p.boe}/metadatos`, { headers: { Accept: "application/json" } });
  const fecha = (await r.json()).data?.[0]?.fecha_actualizacion;
  return { actual: p.fecha_actualizacion, boe: fecha, cambiado: !!fecha && fecha > p.fecha_actualizacion, nombre: p.nombre, url: `https://www.boe.es/buscar/act.php?id=${p.boe}` };
}

const txt = (el) => (el.textContent || "").replace(/\s+/g, " ").trim();
export async function descargarDelBOE(tipo = "pymes") {
  const base = tipo === "pgc" ? "pgc" : "pymes";
  const id = BASE[base].boe;
  const meta = await (await fetch(`${API}${id}/metadatos`, { headers: { Accept: "application/json" } })).json();
  const ind = await (await fetch(`${API}${id}/texto/indice`, { headers: { Accept: "application/json" } })).json();
  const bloques = (ind.data?.bloque || []).filter((b) => /^grupo\d$/.test(b.id));
  const grupos = {}, cuentas = {};
  for (const b of bloques) {
    const xml = new DOMParser().parseFromString(await (await fetch(`${API}${id}/texto/bloque/${b.id}`, { headers: { Accept: "application/xml" } })).text(), "application/xml");
    const vs = xml.querySelectorAll("bloque > version"); const v = vs[vs.length - 1];
    const g = b.id.slice(-1);
    grupos[g] = txt(v.querySelector('p.capitulo_tit') || { textContent: "" });
    for (const tr of v.querySelectorAll("tr")) {
      const c = [...tr.querySelectorAll("td")].map(txt).filter((x) => x && !/^[—–-]$/.test(x));
      const i = c.findIndex((x) => /^\d{2,5}\.$/.test(x));
      if (i >= 0 && c[i + 1]) { const k = c[i].slice(0, -1); if (k.startsWith(g)) cuentas[k] = c[i + 1].replace(/\.$/, ""); }
    }
  }
  if (Object.keys(cuentas).length < 300) throw new Error("La respuesta del BOE no parece completa. Inténtalo más tarde.");
  const antes = plan(base).cuentas;
  const diff = {
    nuevas: Object.keys(cuentas).filter((k) => !antes[k]).map((k) => [k, cuentas[k]]),
    cambiadas: Object.keys(cuentas).filter((k) => antes[k] && antes[k] !== cuentas[k]).map((k) => [k, antes[k], cuentas[k]]),
    quitadas: Object.keys(antes).filter((k) => !cuentas[k] && !ESFL[k]).map((k) => [k, antes[k]]),
  };
  const nuevo = { ...BASE[base], fecha_actualizacion: meta.data[0].fecha_actualizacion, grupos, cuentas };
  return { nuevo, diff, base };
}
export function aplicarActualizacion(base, nuevo) {
  const a = leer(); a[base] = nuevo;
  try { localStorage.setItem(CLAVE, JSON.stringify(a)); } catch { /* nada */ }
}
export const fechaBOE = (f) => (f ? `${f.slice(6, 8)}/${f.slice(4, 6)}/${f.slice(0, 4)}` : "—");
