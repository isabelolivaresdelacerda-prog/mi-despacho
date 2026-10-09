// Preparar un impuesto para presentarlo en la sede de la AEAT: casillas del 303 y del 111 calculadas desde las facturas
// del periodo, la compensación de periodos anteriores y la cuenta bancaria (para el cargo o la devolución).
import { num, fechaOrden, leerJSON } from "./datos.js";

const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
const enR = (f, r) => { const o = fechaOrden(f.fecha); return o >= r.desde && o <= r.hasta; };
const validas = (l) => (l || []).filter((f) => !f._duplicadoDe && !f.noFactura && f.total);

// Cuentas bancarias de la empresa: las que dio el banco al conectar + la de Ajustes
export async function cuentasEmpresa(raiz, config) {
  const cfg = await leerJSON(raiz, "banco_api_config.json", {});
  const l = [...(cfg._cuentas || []).map((c) => c.iban), config?.empresa?.iban, ...(config?.empresa?.ibans || [])]
    .map((x) => String(x || "").replace(/\s+/g, "").toUpperCase()).filter((x) => /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(x));
  return [...new Set(l)];
}
export const ibanBonito = (i) => String(i || "").replace(/(.{4})/g, "$1 ").trim();

// presentados: { clave: { modelo, anio, tramo, resultado, importe, ... } } — para la compensación de periodos anteriores
// extraDeducible: IVA soportado de periodos anteriores que no se dedujo y se incluye ahora (dentro de los 4 años)
export function casillas303(d, r, presentados = {}, { extraDeducible = 0 } = {}) {
  const em = validas(d.emitidas).filter((f) => enR(f, r));
  const rec = validas(d.facturas).filter((f) => enR(f, r));
  const tipo = (pct) => em.filter((f) => Math.round(num(f.iva_pct)) === pct);
  const dev = [21, 10, 4].map((p) => ({ p, base: r2(tipo(p).reduce((s, f) => s + num(f.base), 0)), cuota: r2(tipo(p).reduce((s, f) => s + num(f.iva_importe), 0)) }));
  const isp = rec.filter((f) => f.isp);
  const ispBase = r2(isp.reduce((s, f) => s + num(f.base), 0)), ispCuota = r2(isp.reduce((s, f) => s + num(f.isp_importe || num(f.base) * (num(f.isp_pct) || 21) / 100), 0));
  const conIva = rec.filter((f) => !f.isp && num(f.iva_importe));
  const dedBase = r2(conIva.reduce((s, f) => s + num(f.base), 0) + ispBase), dedCuota = r2(conIva.reduce((s, f) => s + num(f.iva_importe), 0) + ispCuota + num(extraDeducible));
  const c27 = r2(dev.reduce((s, x) => s + x.cuota, 0) + ispCuota);
  const c45 = dedCuota, c46 = r2(c27 - c45);
  // Cuotas a compensar de periodos anteriores: lo que quedó «a compensar» en el último 303 presentado antes de este periodo
  const previos = Object.values(presentados).filter((p) => p.modelo === "303" && p.resultado === "compensar" && (+p.anio < r.anio || (+p.anio === +r.anio && +p.tramo < +r.tramo)))
    .sort((a, b) => (a.anio - b.anio) || (a.tramo - b.tramo));
  const c110 = previos.length ? r2(num(previos.at(-1).importe)) : 0;
  const c78 = r2(Math.min(c110, Math.max(c46, 0))), c87 = r2(c110 - c78);
  const c69 = r2(c46 - c78), c71 = c69;
  const cuarto = r.tramo === "4";
  const resultado = c71 > 0 ? "ingresar" : c71 < 0 ? (cuarto ? "devolver" : "compensar") : "cero";
  const filas = [
    ...dev.filter((x) => x.base || x.cuota).flatMap((x) => { const n = { 21: ["07", "08", "09"], 10: ["04", "05", "06"], 4: ["01", "02", "03"] }[x.p]; return [[n[0], `Régimen general · base al ${x.p} %`, x.base], [n[2], `Régimen general · cuota al ${x.p} %`, x.cuota]]; }),
    ...(ispBase ? [["12", "Inversión del sujeto pasivo · base (servicios de fuera: Anthropic, Base44…)", ispBase], ["13", "Inversión del sujeto pasivo · cuota", ispCuota]] : []),
    ["27", "Total cuota devengada", c27],
    ["28", "IVA deducible operaciones interiores corrientes · base", dedBase],
    ["29", "IVA deducible operaciones interiores corrientes · cuota", dedCuota],
    ["45", "Total a deducir", c45],
    ["46", "Resultado régimen general (27 − 45)", c46],
    ["110", "Cuotas a compensar pendientes de periodos anteriores", c110],
    ["78", "Cuotas a compensar aplicadas en este periodo", c78],
    ["87", "Cuotas a compensar pendientes para periodos posteriores", c87],
    ["69", "Resultado", c69],
    ["71", "Resultado de la liquidación", c71],
  ];
  return { filas, resultado, importe: Math.abs(c71), c71, c87, extraDeducible: num(extraDeducible), facturas: { emitidas: em.length, recibidas: rec.length, isp: isp.length } };
}

// La retención se declara en el trimestre en que se PAGA la factura (no en el de su fecha)
export function casillas111(d, r) {
  const rec = validas(d.facturas).filter((f) => num(f.retencion_importe) > 0 && enR({ fecha: (f._pago?.fecha && !f._pago.manual ? f._pago.fecha : f.fecha) }, r));
  const nifs = new Set(rec.map((f) => (f.nif_proveedor || f.proveedor || "").toUpperCase()));
  const base = r2(rec.reduce((s, f) => s + num(f.base), 0)), ret = r2(rec.reduce((s, f) => s + num(f.retencion_importe), 0));
  return {
    filas: [["07", "Rendimientos de actividades económicas · nº de perceptores", nifs.size], ["08", "Rendimientos de actividades económicas · importe de las percepciones", base], ["09", "Rendimientos de actividades económicas · retenciones", ret], ["28", "Total liquidación", ret], ["30", "Resultado a ingresar", ret]],
    resultado: ret > 0 ? "ingresar" : "cero", importe: ret, detalle: rec.map((f) => ({ proveedor: f.proveedor, numero: f.numero, fecha: f.fecha, base: num(f.base), ret: num(f.retencion_importe) })),
  };
}

export const ENLACE_AEAT = {
  "303": "https://sede.agenciatributaria.gob.es/Sede/todas-gestiones/impuestos-tasas/iva/modelo-303-iva-autoliquidacion_.html",
  "111": "https://sede.agenciatributaria.gob.es/Sede/procedimientoini/GH01.shtml",
};
