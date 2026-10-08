// Contabilidad por trimestre y por año: cifras clave, impuestos, lo que queda por gestionar y cierre del extracto.
import { mayores, perdidasYGanancias, filtrarPeriodo, claveMov } from "./motor.js";
import { fechaOrden, vencimientos, TIPOS_VINCULO, num } from "./datos.js";

export const TRAMOS = [["1", "1T"], ["2", "2T"], ["3", "3T"], ["4", "4T"], ["anio", "Año"]];
const r2 = (x) => Math.round((+x || 0) * 100) / 100;
const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const deISO = (f) => (f ? `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}` : "");

export function rango(anio, tramo) {
  if (tramo === "anio") return { anio, tramo, desde: iso(anio, 1, 1), hasta: iso(anio, 12, 31), etiqueta: `Año ${anio}`, corta: `${anio}` };
  const t = +tramo, mf = t * 3;
  return { anio, tramo, desde: iso(anio, mf - 2, 1), hasta: iso(anio, mf, new Date(Date.UTC(anio, mf, 0)).getUTCDate()), etiqueta: `${t}º trimestre ${anio}`, corta: `${t}T ${anio}` };
}
// Pagada o cobrada: por el saldo de la subcuenta del tercero (si el diario lo ha calculado) o por el cruce exacto con el banco
export const noPagada = (f, d) => (d?.sinPagar ? d.sinPagar.has(f.archivo) : f.emitida ? !f._cobro : !f._pago);
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
export function cifras(todos, movimientos, pendientes, r, d = null) {
  const A = filtrarPeriodo(todos, r.desde, r.hasta);
  const AT = A.filter((a) => a.origen !== "regularizacion");
  const sal = (pref, signo = 1) => r2(AT.reduce((t, a) => t + a.lineas.filter((l) => l.cuenta.startsWith(pref)).reduce((s, l) => s + (l.debe - l.haber) * signo, 0), 0));
  const hab = (pref, filtro = () => true) => r2(AT.filter(filtro).reduce((t, a) => t + a.lineas.filter((l) => l.cuenta.startsWith(pref)).reduce((s, l) => s + l.haber, 0), 0));
  const esAlquiler = (a) => a.lineas.some((l) => l.cuenta.startsWith("621"));
  const ivaRep = sal("477", -1), ivaSop = sal("472");
  const ret115 = hab("4751", esAlquiler), retTotal = hab("4751");
  const pyg = perdidasYGanancias(A);
  const acumulado = perdidasYGanancias(filtrarPeriodo(todos, iso(r.anio, 1, 1), r.hasta)).antesImpuestos;
  const movs = movimientos.filter((m) => enRango(m.fecha, r));
  const pend = pendientes.filter((m) => enRango(m.fecha, r));
  const entradas = r2(movs.filter((m) => m.importe > 0).reduce((s, m) => s + m.importe, 0));
  const salidas = r2(movs.filter((m) => m.importe < 0).reduce((s, m) => s + m.importe, 0));
  const fR = (d?.facturas || []).filter((f) => enRango(f.fecha, r));
  const fE = (d?.emitidas || []).filter((f) => enRango(f.fecha, r));
  const pendPago = fR.filter((f) => f.total && noPagada(f, d)), pendCobro = fE.filter((f) => f.total && noPagada(f, d));
  const retSoportadas = r2(fE.reduce((s, f) => s + (f.retencion_importe || 0), 0));
  return {
    asientos: A,
    nRecibidas: fR.length, recibidasSinLeer: fR.filter((f) => !f._leida).length,
    nPendPago: pendPago.length, importePendPago: r2(pendPago.reduce((s, f) => s + f.total, 0)),
    gastoBase: r2(fR.reduce((s, f) => s + (f.base || 0), 0)), ivaSopFacturas: r2(fR.reduce((s, f) => s + (f.iva_importe || 0), 0)),
    nEmitidas: fE.length, baseEmitidas: r2(fE.reduce((s, f) => s + (f.base || 0), 0)),
    nPendCobro: pendCobro.length, importePendCobro: r2(pendCobro.reduce((s, f) => s + f.total, 0)), retSoportadas,
    cargosSinJustificante: movs.filter((m) => m.importe < 0 && !m._justificante).length,
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
export function porGestionar(d, todos, pendientes, vinculados, r, hoy = new Date().toISOString().slice(0, 10)) {
  const { facturas, emitidas = [], movimientos } = d;
  const enP = (f) => enRango(f, r);
  const sinFecha = (f) => fechaOrden(f).startsWith("9999");
  const L = [];
  const add = (id, titulo, explica, accion, items) => { if (items.length) L.push({ id, titulo, explica, accion, items }); };

  const pend = pendientes.filter((m) => enP(m.fecha));
  add("pagos-sin-factura", "Pagos del banco sin factura", "Ha salido dinero y no aparece la factura. Búscala y súbela a «Facturas recibidas», o di qué es con «¿Dónde va?» si no lleva factura (impuestos, nóminas, préstamo…).", { tab: "libros", sub: "aplicar", texto: "¿Dónde va?" },
    pend.filter((m) => m.importe < 0).map((m) => ({ fecha: m.fecha, texto: m.concepto, importe: m.importe })));
  add("cobros-sin-factura", "Cobros en el banco sin factura emitida", "Ha entrado dinero y no hay ninguna factura emitida por ese importe. Si es una venta o un servicio, falta la factura: súbela a «Facturas emitidas». Si es otra cosa (aportación de un socio, préstamo, devolución…), dilo con «¿Dónde va?».", { tab: "facturas", sub: "emitidas", texto: "Subir factura emitida" },
    pend.filter((m) => m.importe > 0).map((m) => ({ fecha: m.fecha, texto: m.concepto, importe: m.importe })));

  const fP = facturas.filter((f) => enP(f.fecha));
  add("facturas-sin-pago", "Facturas sin pago en el banco", "No se ha encontrado en el extracto un pago por el mismo importe. Puede estar pendiente de pagar, pagada por otra vía o con otro importe.", { tab: "facturas", texto: "Revisar" },
    fP.filter((f) => f.total && noPagada(f, d)).map((f) => ({ fecha: f.fecha, texto: `${f.proveedor || f.archivo} ${f.numero || ""}`, importe: -f.total })));
  add("sin-leer", "Facturas sin leer", "Están en la carpeta pero todavía no se han leído sus datos.", { tab: "facturas", texto: "Leer" },
    facturas.filter((f) => !f._leida && (enP(f.fecha) || sinFecha(f.fecha))).map((f) => ({ fecha: f.fecha, texto: f.archivo })));
  add("sin-fecha", "Facturas sin fecha o sin importe", "No se pueden colocar en ningún trimestre hasta completarlas.", { tab: "facturas", texto: "Corregir" },
    facturas.filter((f) => f._leida && (sinFecha(f.fecha) || !f.total)).map((f) => ({ fecha: f.fecha || "—", texto: `${f.proveedor || ""} ${f.archivo}`.trim(), importe: f.total ? -f.total : undefined })));
  add("ia-sin-revisar", "Propuestas de la IA sin revisar", "Datos leídos por la IA que ninguna persona ha comprobado todavía.", { tab: "facturas", texto: "Revisar" },
    fP.filter((f) => f.analizado_ia && !f._editada).map((f) => ({ fecha: f.fecha, texto: `${f.proveedor || f.archivo} ${f.numero || ""}`, importe: f.total ? -f.total : undefined })));

  add("cargos-sin-justificante", "Cargos del banco sin su justificante", "Cada cargo debería tener el documento individual del banco (adeudo, recibo, orden de transferencia) en «documentos_banco». Descárgalo de la banca online y súbelo, o asócialo si ya está.", { tab: "banco", texto: "Asociar justificantes" },
    movimientos.filter((m) => enP(m.fecha) && m.importe < 0 && !m._justificante).map((m) => ({ fecha: m.fecha, texto: m.concepto, importe: m.importe })));
  const eP = emitidas.filter((f) => enP(f.fecha));
  add("emitidas-sin-cobro", "Facturas emitidas sin cobro en el banco", "No se ha encontrado en el extracto un cobro por el mismo importe: pendiente de cobrar o cobrada por otra vía.", { tab: "facturas", sub: "emitidas", texto: "Revisar" },
    eP.filter((f) => f.total && noPagada(f, d)).map((f) => ({ fecha: f.fecha, texto: `${f.cliente || f.archivo} ${f.numero || ""}`, importe: f.total })));
  add("emitidas-sin-leer", "Facturas emitidas sin leer", "Están en la carpeta pero todavía no se han leído sus datos.", { tab: "facturas", sub: "emitidas", texto: "Leer" },
    emitidas.filter((f) => !f._leida && (enP(f.fecha) || sinFecha(f.fecha))).map((f) => ({ fecha: f.fecha, texto: f.archivo })));

  add("vinculados-ia", "Escrituras y contratos leídos por la IA sin revisar", "La app los ha encontrado en la carpeta de la empresa y los ha vinculado a la contabilidad. Comprueba fecha, importe y tipo con el documento.", { tab: "vinculados", texto: "Revisar" },
    vinculados.filter((v) => v.propuestoIA && !v.revisado).map((v) => ({ fecha: v.fecha || v.inicio || "", texto: `${(TIPOS_VINCULO[v.tipo] || {}).nombre || v.tipo} · ${v.archivo}`, importe: num(v.importe) || undefined })));

  const cuotas = [];
  for (const v of vinculados) {
    if (!TIPOS_VINCULO[v.tipo]?.periodico) continue;
    for (const q of vencimientos(v, movimientos, hoy)) if (!q.mov && enP(q.fecha)) cuotas.push({ fecha: q.fecha, texto: `${TIPOS_VINCULO[v.tipo].nombre}${v.tercero ? " – " + v.tercero : ""}`, importe: TIPOS_VINCULO[v.tipo].signo * q.importe });
  }
  add("cuotas", "Cuotas de contratos que no aparecen en el banco", "Según el contrato vinculado tocaba pagar o cobrar y no se ha encontrado el movimiento (±10 días).", { tab: "vinculados", texto: "Ver contrato" }, cuotas);

  // Terceros con pagos o cobros sin su factura: subcuentas de acreedores (400/410) con saldo deudor y de clientes (430) con saldo acreedor
  const hasta = filtrarPeriodo(todos, null, r.hasta);
  const saldos = {};
  for (const a of hasta) for (const l of a.lineas) if (/^4[13]0\d{5}$/.test(l.cuenta) || /^400\d{5}$/.test(l.cuenta)) { const x = (saldos[l.cuenta] ||= { titulo: l.titulo, s: 0, ult: "" }); x.s += l.debe - l.haber; if (a.origen === "banco-tercero") x.ult = a.fecha; }
  add("terceros-sin-factura", "Pagos a profesionales y proveedores que esperan su factura", "Se ha pagado a esta persona o empresa más de lo que dicen sus facturas: falta su factura (y, si es un profesional, su retención para el modelo 111). Pídesela y súbela a «Facturas recibidas»: se compensará sola en su subcuenta.", { tab: "facturas", texto: "Subir facturas" },
    Object.entries(saldos).filter(([c, x]) => /^4[01]/.test(c) && x.s > 0.01).map(([c, x]) => ({ fecha: x.ult, texto: `${x.titulo || c}: pagado de más (falta su factura o es provisión de fondos sin gastar) · subcuenta ${c}`, importe: -r2(x.s) })));
  add("clientes-sin-factura", "Cobros de clientes que esperan su factura emitida", "Este cliente ha pagado más de lo facturado: falta emitirle o subir su factura.", { tab: "facturas", sub: "emitidas", texto: "Subir factura emitida" },
    Object.entries(saldos).filter(([c, x]) => c.startsWith("430") && x.s < -0.01).map(([c, x]) => ({ fecha: x.ult, texto: `Falta la factura emitida a ${x.titulo || c} (subcuenta ${c})`, importe: r2(-x.s) })));

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

// ---- Modelos de impuestos del año: calculados, presentados y pagados ----
// Clave: "2026-2|111" (trimestre) o "2026-anio|390" (anual)
export const NOMBRE_MODELO = { "303": "IVA", "111": "Retenciones de profesionales y nóminas (IRPF)", "115": "Retenciones de alquileres", "202": "Pago fraccionado de Sociedades", "390": "Resumen anual de IVA", "190": "Resumen anual de retenciones", "180": "Resumen anual de retenciones de alquileres", "347": "Operaciones con terceros", "200": "Impuesto sobre Sociedades" };
export const claveModelo = (anio, tramo, modelo) => `${anio}-${tramo}|${modelo}`;

// Id del aviso en el calendario (ver calendario/obligaciones.js)
export function idCalendario(anio, tramo, modelo) {
  if (tramo === "anio") return `${anio + 1}-${modelo}`;
  const t = +tramo;
  if (modelo === "202") return { 1: `${anio}-202-1`, 3: `${anio}-202-2`, 4: `${anio}-202-3` }[t] || null;
  return t === 4 ? `${anio + 1}-${modelo}-4` : `${anio}-${modelo}-${t}`;
}

export function modelosDelAnio(anio, todos, d, pendientes, opciones = {}) {
  const out = [];
  for (const t of ["1", "2", "3", "4"]) {
    const r = rango(anio, t), c = cifras(todos, d.movimientos, pendientes, r, d), p = plazos(r);
    out.push({ anio, tramo: t, modelo: "303", r, plazo: p.iva.fecha, calculado: c.iva303, ivaRep: c.ivaRep, ivaSop: c.ivaSop, siempre: true });
    out.push({ anio, tramo: t, modelo: "111", r, plazo: p.ret.fecha, calculado: c.ret111, siempre: opciones.profesionales || opciones.empleados || c.ret111 > 0 });
    out.push({ anio, tramo: t, modelo: "115", r, plazo: p.ret.fecha, calculado: c.ret115, siempre: opciones.alquileres || c.ret115 > 0 });
    if (p.is) out.push({ anio, tramo: t, modelo: "202", r, plazo: p.is.fecha, calculado: 0, siempre: !!opciones.pagosFraccionados, nota: "lo calcula la gestoría" });
  }
  const ra = rango(anio, "anio"), ca = cifras(todos, d.movimientos, pendientes, ra, d), pa = plazos(ra);
  out.push({ anio, tramo: "anio", modelo: "390", r: ra, plazo: pa.iva.fecha, calculado: ca.iva303, siempre: true, informativo: true });
  out.push({ anio, tramo: "anio", modelo: "190", r: ra, plazo: pa.ret.fecha, calculado: ca.ret111, siempre: ca.ret111 > 0, informativo: true });
  out.push({ anio, tramo: "anio", modelo: "180", r: ra, plazo: pa.ret.fecha, calculado: ca.ret115, siempre: ca.ret115 > 0, informativo: true });
  out.push({ anio, tramo: "anio", modelo: "347", r: ra, plazo: habil(iso(anio + 1, 2, new Date(Date.UTC(anio + 1, 2, 0)).getUTCDate())), calculado: 0, siempre: true, informativo: true });
  out.push({ anio, tramo: "anio", modelo: "200", r: ra, plazo: pa.is.fecha, calculado: ca.isEstimado, siempre: true });
  return out.filter((m) => m.siempre).map((m) => ({ ...m, clave: claveModelo(m.anio, m.tramo, m.modelo), etiqueta: m.tramo === "anio" ? `${anio}` : `${m.tramo}T ${anio}`, idCal: idCalendario(m.anio, m.tramo, m.modelo) }));
}

// Pagos a Hacienda en el banco: «AEAT», «Agencia Tributaria», «impuesto», «modelo 111»…
const RE_AEAT = /aeat|agencia\s*(estatal\s*de\s*admin|tribut)|hacienda|impuesto|tributos|\bmod(elo)?\.?\s*(303|111|115|202|200)\b|\b(303|111|115|202|200)\b/i;
export function pagosHacienda(movimientos) { return movimientos.filter((m) => m.importe < 0 && RE_AEAT.test(m.concepto || "")); }

// Propone a qué modelo corresponde cada pago a Hacienda (por número de modelo en el concepto, fecha e importe)
export function proponerPagos(modelos, movimientos, presentados) {
  const libres = modelos.filter((m) => !presentados[m.clave]);
  const props = [];
  const usados = new Set(Object.values(presentados).map((p) => p.mov).filter(Boolean));
  for (const mv of pagosHacienda(movimientos)) {
    if (usados.has(claveMov(mv))) continue;
    const f = fechaOrden(mv.fecha), imp = Math.abs(mv.importe);
    const num = ((mv.concepto || "").match(/\b(303|111|115|202|200)\b/) || [])[1];
    const cand = libres.filter((m) => (!num || m.modelo === num) && f >= m.r.hasta && f <= sumarDias(m.plazo, 15));
    const exacto = cand.find((m) => Math.abs(Math.abs(m.calculado) - imp) < 0.011);
    const m = exacto || (cand.length === 1 ? cand[0] : null);
    props.push({ mov: mv, modelo: m, seguro: !!exacto || !!num });
  }
  return props;
}
function sumarDias(isoF, n) { const d = new Date(isoF + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

// Justificantes en la carpeta «impuestos»: "303 2T 2026.pdf", "Modelo 111 - 2º trimestre 2026.pdf"…
export function leerNombreImpuesto(nombre) {
  const n = nombre.replace(/[_\-.]/g, " ");
  const modelo = (n.match(/\b(303|111|115|202|200|390|190|180|347)\b/) || [])[1];
  const anio = +((n.match(/\b(20\d\d)\b/) || [])[1] || 0);
  const t = (n.match(/\b([1-4])\s*(?:º|o)?\s*(?:t|trim|trimestre|p)\b/i) || n.match(/\b(?:t|trim\w*)\s*([1-4])\b/i) || [])[1];
  if (!modelo) return null;
  return { modelo, anio: anio || null, tramo: ["390", "190", "180", "347", "200"].includes(modelo) ? "anio" : t || null };
}

// Borrador de casillas para exportar (orientativo: comprobar con el modelo vigente de la AEAT)
export function casillas(m, c) {
  const e = (v) => r2(v);
  if (m.modelo === "303") return [["27", "Total cuota devengada (IVA repercutido)", e(c.ivaRep)], ["28/29", "Base y cuota deducible en operaciones interiores corrientes", e(c.ivaSop)], ["45", "Total a deducir", e(c.ivaSop)], ["46", "Resultado régimen general", e(c.ivaRep - c.ivaSop)], ["71", "Resultado de la liquidación", e(c.ivaRep - c.ivaSop)]];
  if (m.modelo === "111") return [["07–09", "Rendimientos de actividades económicas: retenciones", e(c.ret111)], ["28", "Total liquidación", e(c.ret111)]];
  if (m.modelo === "115") return [["03", "Retenciones e ingresos a cuenta (alquileres)", e(c.ret115)], ["05", "Resultado a ingresar", e(c.ret115)]];
  if (m.modelo === "202") return [["—", "Resultado contable acumulado del ejercicio (referencia para la gestoría)", e(c.acumulado)]];
  if (m.modelo === "200") return [["—", "Resultado contable antes de impuestos", e(c.acumulado)], ["—", "Cuota estimada al 25 %", e(c.isEstimado)]];
  return [["—", "Importe del periodo", e(m.calculado)]];
}
