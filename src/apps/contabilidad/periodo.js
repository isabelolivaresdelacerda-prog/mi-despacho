// Contabilidad por trimestre y por año: cifras clave, impuestos, lo que queda por gestionar y cierre del extracto.
import { mayores, perdidasYGanancias, filtrarPeriodo, claveMov } from "./motor.js";
import { fechaOrden, vencimientos, TIPOS_VINCULO } from "./datos.js";

export const TRAMOS = [["1", "1T"], ["2", "2T"], ["3", "3T"], ["4", "4T"], ["anio", "Año"]];
const r2 = (x) => Math.round((+x || 0) * 100) / 100;
const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const deISO = (f) => (f ? `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}` : "");

export function rango(anio, tramo) {
  if (tramo === "anio") return { anio, tramo, desde: iso(anio, 1, 1), hasta: iso(anio, 12, 31), etiqueta: `Año ${anio}`, corta: `${anio}` };
  const t = +tramo, mf = t * 3;
  return { anio, tramo, desde: iso(anio, mf - 2, 1), hasta: iso(anio, mf, new Date(Date.UTC(anio, mf, 0)).getUTCDate()), etiqueta: `${t}º trimestre ${anio}`, corta: `${t}T ${anio}` };
}
export const enRango = (f, r) => { const o = fechaOrden(f); return o >= r.desde && o <= r.hasta; };
export const claveCierre = (r) => `${r.anio}-${r.tramo}`;

// Plazos generales de presentación (se mueven al lunes si caen en fin de semana; confirmar con la gestoría)
function habil(f) { const d = new Date(f + "T12:00:00Z"); const w = d.getUTCDay(); if (w === 6) d.setUTCDate(d.getUTCDate() + 2); if (w === 0) d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); }
export function plazos(r) {
  const y = r.anio;
  if (r.tramo === "anio") return { iva: { modelo: "390", fecha: habil(iso(y + 1, 1, 30)) }, ret: { modelo: "190 / 180", fecha: habil(iso(y + 1, 1, 31)) }, is: { modelo: "200", fecha: habil(iso(y + 1, 7, 25)) } };
  const t = +r.tramo;
  const iva = t === 4 ? habil(iso(y + 1, 1, 30)) : habil(iso(y, t * 3 + 1, 20));
  const ret = t === 4 ? habil(iso(y + 1, 1, 20)) : iva;
  // Pagos fraccionados del Impuesto sobre Sociedades (modelo 202): abril, octubre y diciembre
  const is = { 1: { modelo: "202 (1P)", fecha: habil(iso(y, 4, 20)) }, 3: { modelo: "202 (2P)", fecha: habil(iso(y, 10, 20)) }, 4: { modelo: "202 (3P)", fecha: habil(iso(y, 12, 20)) } }[t] || null;
  return { iva: { modelo: "303", fecha: iva }, ret: { modelo: "111 / 115", fecha: ret }, is };
}
export const fechaBonita = deISO;

// Cifras del periodo a partir del libro diario completo
export function cifras(todos, movimientos, pendientes, r) {
  const A = filtrarPeriodo(todos, r.desde, r.hasta);
  const sal = (pref, signo = 1) => r2(A.reduce((t, a) => t + a.lineas.filter((l) => l.cuenta.startsWith(pref)).reduce((s, l) => s + (l.debe - l.haber) * signo, 0), 0));
  const hab = (pref, filtro = () => true) => r2(A.filter(filtro).reduce((t, a) => t + a.lineas.filter((l) => l.cuenta.startsWith(pref)).reduce((s, l) => s + l.haber, 0), 0));
  const esAlquiler = (a) => a.lineas.some((l) => l.cuenta.startsWith("621"));
  const ivaRep = sal("477", -1), ivaSop = sal("472");
  const ret115 = hab("4751", esAlquiler), retTotal = hab("4751");
  const pyg = perdidasYGanancias(A);
  const acumulado = perdidasYGanancias(filtrarPeriodo(todos, iso(r.anio, 1, 1), r.hasta)).antesImpuestos;
  const movs = movimientos.filter((m) => enRango(m.fecha, r));
  const pend = pendientes.filter((m) => enRango(m.fecha, r));
  const entradas = r2(movs.filter((m) => m.importe > 0).reduce((s, m) => s + m.importe, 0));
  const salidas = r2(movs.filter((m) => m.importe < 0).reduce((s, m) => s + m.importe, 0));
  return {
    asientos: A,
    ingresos: r2(-A.reduce((t, a) => t + a.lineas.filter((l) => l.cuenta.startsWith("7")).reduce((s, l) => s + l.debe - l.haber, 0), 0)),
    gastos: r2(A.reduce((t, a) => t + a.lineas.filter((l) => l.cuenta.startsWith("6") && !l.cuenta.startsWith("630")).reduce((s, l) => s + l.debe - l.haber, 0), 0)),
    resultado: pyg.antesImpuestos, acumulado,
    ivaRep, ivaSop, iva303: r2(ivaRep - ivaSop),
    ret111: r2(retTotal - ret115), ret115,
    isEstimado: acumulado > 0 ? r2(acumulado * 0.25) : 0,
    nMov: movs.length, entradas, salidas, neto: r2(entradas + salidas),
    conciliados: movs.length - pend.length, sinDoc: pend.length,
    descuadrados: A.filter((a) => !a.cuadra).length,
  };
}

// Lo que queda por gestionar en el periodo (más lo que no tiene fecha y por eso no cae en ningún periodo)
export function porGestionar({ facturas, movimientos }, todos, pendientes, vinculados, r, hoy = new Date().toISOString().slice(0, 10)) {
  const enP = (f) => enRango(f, r);
  const sinFecha = (f) => fechaOrden(f).startsWith("9999");
  const L = [];
  const add = (id, titulo, explica, accion, items) => { if (items.length) L.push({ id, titulo, explica, accion, items }); };

  const pend = pendientes.filter((m) => enP(m.fecha));
  add("pagos-sin-factura", "Pagos del banco sin factura", "Ha salido dinero y no aparece la factura. Búscala y súbela a «Facturas recibidas», o di qué es con «¿Dónde va?» si no lleva factura (impuestos, nóminas, préstamo…).", { tab: "libros", sub: "aplicar", texto: "¿Dónde va?" },
    pend.filter((m) => m.importe < 0).map((m) => ({ fecha: m.fecha, texto: m.concepto, importe: m.importe })));
  add("cobros-sin-doc", "Cobros del banco sin documento", "Ha entrado dinero y no se sabe de qué es: una factura emitida, una aportación de un socio, un préstamo…", { tab: "libros", sub: "aplicar", texto: "¿Dónde va?" },
    pend.filter((m) => m.importe > 0).map((m) => ({ fecha: m.fecha, texto: m.concepto, importe: m.importe })));

  const fP = facturas.filter((f) => enP(f.fecha));
  add("facturas-sin-pago", "Facturas sin pago en el banco", "No se ha encontrado en el extracto un pago por el mismo importe. Puede estar pendiente de pagar, pagada por otra vía o con otro importe.", { tab: "facturas", texto: "Revisar" },
    fP.filter((f) => f.total && !f._pago).map((f) => ({ fecha: f.fecha, texto: `${f.proveedor || f.archivo} ${f.numero || ""}`, importe: -f.total })));
  add("sin-leer", "Facturas sin leer", "Están en la carpeta pero todavía no se han leído sus datos.", { tab: "facturas", texto: "Leer" },
    facturas.filter((f) => !f._leida && (enP(f.fecha) || sinFecha(f.fecha))).map((f) => ({ fecha: f.fecha, texto: f.archivo })));
  add("sin-fecha", "Facturas sin fecha o sin importe", "No se pueden colocar en ningún trimestre hasta completarlas.", { tab: "facturas", texto: "Corregir" },
    facturas.filter((f) => f._leida && (sinFecha(f.fecha) || !f.total)).map((f) => ({ fecha: f.fecha || "—", texto: `${f.proveedor || ""} ${f.archivo}`.trim(), importe: f.total ? -f.total : undefined })));
  add("ia-sin-revisar", "Propuestas de la IA sin revisar", "Datos leídos por la IA que ninguna persona ha comprobado todavía.", { tab: "facturas", texto: "Revisar" },
    fP.filter((f) => f.analizado_ia && !f._editada).map((f) => ({ fecha: f.fecha, texto: `${f.proveedor || f.archivo} ${f.numero || ""}`, importe: f.total ? -f.total : undefined })));

  const cuotas = [];
  for (const v of vinculados) {
    if (!TIPOS_VINCULO[v.tipo]?.periodico) continue;
    for (const q of vencimientos(v, movimientos, hoy)) if (!q.mov && enP(q.fecha)) cuotas.push({ fecha: q.fecha, texto: `${TIPOS_VINCULO[v.tipo].nombre}${v.tercero ? " – " + v.tercero : ""}`, importe: TIPOS_VINCULO[v.tipo].signo * q.importe });
  }
  add("cuotas", "Cuotas de contratos que no aparecen en el banco", "Según el contrato vinculado tocaba pagar o cobrar y no se ha encontrado el movimiento (±10 días).", { tab: "vinculados", texto: "Ver contrato" }, cuotas);

  const A = filtrarPeriodo(todos, r.desde, r.hasta);
  add("fuera-banco", "Apuntes de banco que no están en el extracto", "La contabilidad dice que pasó por el banco, pero no se encuentra en el extracto. Comprueba la fecha y el importe del documento.", { tab: "vinculados", texto: "Revisar" },
    A.filter((a) => a.mov === null && a.origen !== "manual" && a.lineas.some((l) => l.cuenta === "572")).map((a) => ({ fecha: a.fecha, texto: a.concepto, importe: a.lineas.reduce((s, l) => s + (l.cuenta === "572" ? l.debe - l.haber : 0), 0) })));
  add("descuadrados", "Asientos descuadrados", "El debe y el haber no coinciden: normalmente falta la base, el IVA o el total en la factura.", { tab: "libros", sub: "diario", texto: "Ver diario" },
    A.filter((a) => !a.cuadra).map((a) => ({ fecha: a.fecha, texto: `Asiento ${a.num} · ${a.concepto}` })));
  return L;
}

// ---- Cierre del extracto ----
export async function huella(movimientos, r) {
  const t = movimientos.filter((m) => enRango(m.fecha, r)).map(claveMov).sort().join("\n");
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// Saldos: si el extracto trae saldo tras cada movimiento se usa; si no, el que indique la persona al cerrar
export function saldosExtracto(movimientos, r) {
  const conSaldo = movimientos.filter((m) => m.saldo !== undefined && m.saldo !== null && m.saldo !== "");
  if (!conSaldo.length) return null;
  const n = (v) => (typeof v === "number" ? v : parseFloat(String(v).replace(/\./g, "").replace(",", ".")) || 0);
  const ord = [...conSaldo].sort((a, b) => fechaOrden(a.fecha).localeCompare(fechaOrden(b.fecha)) || a._id - b._id);
  const hasta = ord.filter((m) => fechaOrden(m.fecha) <= r.hasta);
  const antes = ord.filter((m) => fechaOrden(m.fecha) < r.desde);
  if (!hasta.length) return null;
  const fin = n(hasta[hasta.length - 1].saldo);
  const ini = antes.length ? n(antes[antes.length - 1].saldo) : r2(fin - movimientos.filter((m) => enRango(m.fecha, r)).reduce((s, m) => s + m.importe, 0));
  return { inicial: r2(ini), final: r2(fin) };
}

// Saldo contable de bancos (572) desde el principio hasta el final del periodo
export function saldo572(todos, r) {
  return r2(filtrarPeriodo(todos, null, r.hasta).reduce((t, a) => t + a.lineas.filter((l) => l.cuenta.startsWith("57")).reduce((s, l) => s + l.debe - l.haber, 0), 0));
}

export { mayores };
