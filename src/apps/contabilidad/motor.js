// Motor contable (PGC PYMES): genera el libro diario a partir de facturas, banco, escrituras/contratos vinculados
// y asientos manuales; y de ahí los mayores, sumas y saldos, pérdidas y ganancias y balance.
import { num, fechaOrden, TITULOS_PGC, TIPOS_VINCULO, vencimientos } from "./datos.js";

export const CUENTAS = {
  ...TITULOS_PGC,
  "100": "Capital social", "110": "Prima de emisión", "112": "Reserva legal", "118": "Aportaciones de socios", "120": "Remanente", "121": "Resultados negativos de ejercicios anteriores", "129": "Resultado del ejercicio",
  "170": "Deudas a largo plazo con entidades de crédito", "171": "Deudas a largo plazo", "180": "Fianzas recibidas a largo plazo", "181": "Anticipos recibidos por ventas a largo plazo",
  "210": "Terrenos y bienes naturales", "211": "Construcciones", "300": "Mercaderías / existencias", "407": "Anticipos a proveedores",
  "400": "Proveedores", "410": "Acreedores por prestaciones de servicios", "430": "Clientes", "438": "Anticipos de clientes",
  "472": "H.P. IVA soportado", "473": "H.P. retenciones y pagos a cuenta", "4751": "H.P. acreedora por retenciones practicadas", "477": "H.P. IVA repercutido",
  "520": "Deudas a corto plazo con entidades de crédito", "551": "Cuenta corriente con socios y administradores", "555": "Partidas pendientes de aplicación", "572": "Bancos",
  "600": "Compras de mercaderías", "621": "Arrendamientos y cánones", "622": "Reparaciones y conservación", "640": "Sueldos y salarios", "642": "Seguridad Social a cargo de la empresa",
  "662": "Intereses de deudas", "669": "Otros gastos financieros", "681": "Amortización del inmovilizado material", "630": "Impuesto sobre beneficios",
  "700": "Ventas", "705": "Prestaciones de servicios", "740": "Subvenciones a la explotación", "752": "Ingresos por arrendamientos", "759": "Ingresos por servicios diversos", "769": "Otros ingresos financieros",
};
export const titulo = (c) => CUENTAS[c] || CUENTAS[String(c).slice(0, 4)] || CUENTAS[String(c).slice(0, 3)] || "";
const r2 = (x) => Math.round(num(x) * 100) / 100;
const claveMov = (m) => `${m.fecha}|${r2(m.importe)}|${(m.concepto || "").slice(0, 60)}`;
export { claveMov };

// Subcuentas por tercero (8 dígitos al exportar): 41000001, 41000002…
function subcuentas() {
  const mapa = new Map(), cont = {};
  return (base, tercero) => {
    const k = base + "|" + String(tercero || "VARIOS").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 24);
    if (!mapa.has(k)) { cont[base] = (cont[base] || 0) + 1; mapa.set(k, base + String(cont[base]).padStart(8 - base.length, "0")); }
    return mapa.get(k);
  };
}

// datos = { facturas, movimientos }, vinculados = [...], manuales = [...asientos], asignaciones = { claveMov: {cuenta, concepto} }
export function generarDiario({ facturas, movimientos }, vinculados = [], manuales = [], asignaciones = {}) {
  const sub = subcuentas();
  const A = [];
  const asiento = (fecha, concepto, lineas, origen, doc) => {
    const l = lineas.filter((x) => r2(x.debe) || r2(x.haber)).map((x) => ({ ...x, debe: r2(x.debe), haber: r2(x.haber), titulo: x.titulo || titulo(x.cuenta) }));
    if (l.length) A.push({ fecha, concepto, lineas: l, origen, doc });
  };
  const usados = new Set();

  // 1) Facturas recibidas y su pago
  for (const f of facturas) {
    if (!f.total) continue;
    const cta = sub("410", f.proveedor || f.nif_proveedor);
    const c = `${f.proveedor || "Proveedor"} ${f.numero || ""}`.trim();
    asiento(f.fecha, `Factura ${c}`, [
      { cuenta: f.cuenta_pgc || "629", debe: f.base },
      { cuenta: "472", debe: f.iva_importe },
      { cuenta: "4751", haber: f.retencion_importe },
      { cuenta: cta, titulo: f.proveedor, haber: f.total },
    ], "factura", f.archivo);
    if (f._pago) {
      const m = movimientos.find((x) => x._factura === f.archivo);
      if (m) usados.add(m._id);
      asiento(f._pago.fecha || f.fecha, `Pago ${c}`, [{ cuenta: cta, titulo: f.proveedor, debe: f.total }, { cuenta: f._pago.manual ? "551" : "572", haber: f.total }], "pago", f.archivo);
    }
  }

  // 2) Escrituras y contratos vinculados
  for (const v of vinculados) {
    const t = TIPOS_VINCULO[v.tipo]; if (!t) continue;
    const cuenta = v.cuenta || t.cuenta || "629";
    const c = `${t.nombre}${v.tercero ? " – " + v.tercero : ""}`;
    if (!t.periodico) {
      if (!num(v.importe)) continue;
      const mov = movimientos.find((x) => !usados.has(x._id) && Math.abs(Math.abs(x.importe) - num(v.importe)) < 0.011 && Math.sign(x.importe) === t.signo);
      if (mov) usados.add(mov._id);
      asiento(v.fecha || mov?.fecha, c, t.signo > 0 ? [{ cuenta: "572", debe: v.importe }, { cuenta, haber: v.importe }] : [{ cuenta, debe: v.importe }, { cuenta: "572", haber: v.importe }], "documento", v.archivo);
    } else {
      for (const q of vencimientos(v, movimientos)) {
        if (!q.mov) continue;
        usados.add(q.mov._id);
        asiento(q.mov.fecha, `${c} (cuota)`, t.signo > 0 ? [{ cuenta: "572", debe: q.importe }, { cuenta, haber: q.importe }] : [{ cuenta, debe: q.importe }, { cuenta: "572", haber: q.importe }], "cuota", v.archivo);
      }
    }
  }

  // 3) Movimientos del banco sin documento: asignados a mano o a «partidas pendientes de aplicación» (555)
  const pendientes = [];
  for (const m of movimientos) {
    if (usados.has(m._id) || m._factura) continue;
    const a = asignaciones[claveMov(m)];
    const cuenta = a?.cuenta || "555";
    if (!a) pendientes.push(m);
    const imp = Math.abs(m.importe);
    asiento(m.fecha, a?.concepto || m.concepto, m.importe >= 0 ? [{ cuenta: "572", debe: imp }, { cuenta, haber: imp }] : [{ cuenta, debe: imp }, { cuenta: "572", haber: imp }], a ? "banco" : "banco-pendiente", "");
  }

  // 4) Asientos manuales
  for (const m of manuales) asiento(m.fecha, m.concepto, m.lineas, "manual", m.doc || "");

  A.sort((a, b) => fechaOrden(a.fecha).localeCompare(fechaOrden(b.fecha)));
  A.forEach((a, i) => { a.num = i + 1; a.cuadra = Math.abs(a.lineas.reduce((s, l) => s + l.debe - l.haber, 0)) < 0.01; });
  return { asientos: A, pendientes };
}

export function filtrarPeriodo(asientos, desde, hasta) {
  return asientos.filter((a) => { const f = fechaOrden(a.fecha); return (!desde || f >= desde) && (!hasta || f <= hasta); });
}

// Mayores: movimientos y saldo por cuenta
export function mayores(asientos) {
  const M = new Map();
  for (const a of asientos) for (const l of a.lineas) {
    if (!M.has(l.cuenta)) M.set(l.cuenta, { cuenta: l.cuenta, titulo: l.titulo, apuntes: [], debe: 0, haber: 0 });
    const c = M.get(l.cuenta);
    c.debe = r2(c.debe + l.debe); c.haber = r2(c.haber + l.haber);
    c.apuntes.push({ num: a.num, fecha: a.fecha, concepto: a.concepto, debe: l.debe, haber: l.haber, saldo: r2(c.debe - c.haber), doc: a.doc });
  }
  return [...M.values()].sort((a, b) => a.cuenta.localeCompare(b.cuenta));
}

// Cuenta de pérdidas y ganancias (modelo abreviado PGC PYMES)
const g = (saldos, prefijos, signo) => r2(saldos.filter((s) => prefijos.some((p) => s.cuenta.startsWith(p))).reduce((t, s) => t + (s.debe - s.haber) * signo, 0));
export function perdidasYGanancias(asientos) {
  const s = mayores(asientos);
  const L = [
    ["1. Importe neto de la cifra de negocios", g(s, ["70"], -1)],
    ["4. Aprovisionamientos", g(s, ["60", "61"], -1)],
    ["5. Otros ingresos de explotación", g(s, ["74", "75"], -1)],
    ["6. Gastos de personal", g(s, ["64"], -1)],
    ["7. Otros gastos de explotación", g(s, ["62", "631", "634", "639", "65"], -1)],
    ["8. Amortización del inmovilizado", g(s, ["68"], -1)],
  ];
  const explot = r2(L.reduce((t, x) => t + x[1], 0));
  const F = [["12. Ingresos financieros", g(s, ["76"], -1)], ["13. Gastos financieros", g(s, ["66"], -1)]];
  const fin = r2(F.reduce((t, x) => t + x[1], 0));
  const antes = r2(explot + fin);
  const imp = g(s, ["630", "633", "638"], -1);
  return { lineas: L, explotacion: explot, financieras: F, financiero: fin, antesImpuestos: antes, impuesto: imp, resultado: r2(antes + imp) };
}

// Balance de situación (simplificado por grupos del PGC)
export function balance(asientos) {
  const s = mayores(asientos);
  const pyg = perdidasYGanancias(asientos).resultado;
  const sal = (pref) => s.filter((x) => pref.some((p) => x.cuenta.startsWith(p)));
  const neto = (arr) => r2(arr.reduce((t, x) => t + x.debe - x.haber, 0));
  // Grupo 4 y 5: según saldo deudor (activo) o acreedor (pasivo)
  const g45 = s.filter((x) => /^[45]/.test(x.cuenta));
  const deudores = g45.filter((x) => x.debe - x.haber > 0.005 && !/^57/.test(x.cuenta));
  const acreedores = g45.filter((x) => x.haber - x.debe > 0.005);
  const activo = [
    ["Inmovilizado (grupo 2)", neto(sal(["2"]))],
    ["Existencias (grupo 3)", neto(sal(["3"]))],
    ["Deudores y otras cuentas a cobrar", neto(deudores)],
    ["Tesorería (57)", neto(sal(["57"]))],
  ];
  const pn = [
    ["Capital y reservas (10, 11, 12)", -neto(sal(["10", "11", "12"]))],
    ["Aportaciones de socios (118)", 0],
    ["Resultado del ejercicio", pyg],
  ];
  pn[0][1] = r2(pn[0][1] + neto(sal(["118"])) ); // 118 ya incluido en 11x: se muestra aparte
  pn[1][1] = -neto(sal(["118"])); pn[0][1] = r2(pn[0][1] - pn[1][1]);
  const pasivo = [
    ["Deudas a largo plazo (17, 18)", -neto(sal(["17", "18"]))],
    ["Acreedores y otras deudas a corto plazo", -neto(acreedores)],
  ];
  const tA = r2(activo.reduce((t, x) => t + x[1], 0)), tP = r2([...pn, ...pasivo].reduce((t, x) => t + x[1], 0));
  return { activo, pn, pasivo, totalActivo: tA, totalPasivo: tP, cuadra: Math.abs(tA - tP) < 0.05 };
}

// ---- Exportación para A3 / Sage: un apunte por línea, subcuentas a 8 dígitos ----
const pad8 = (c) => (String(c).length >= 8 ? String(c) : String(c).padEnd(8, "0"));
export function exportarApuntes(asientos, formato = "a3") {
  const sep = ";";
  const fmt = (n) => (n ? n.toFixed(2).replace(".", ",") : "");
  const q = (s) => { const t = String(s ?? ""); return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const cab = formato === "sage"
    ? ["Asiento", "Fecha", "Subcuenta", "Contrapartida", "Concepto", "Documento", "Debe", "Haber"]
    : ["Fecha", "Asiento", "Cuenta", "Descripción cuenta", "Concepto", "Debe", "Haber", "Documento"];
  const filas = [cab];
  for (const a of asientos) for (const l of a.lineas) {
    const contra = a.lineas.find((x) => x !== l && (l.debe ? x.haber : x.debe));
    filas.push(formato === "sage"
      ? [a.num, a.fecha, pad8(l.cuenta), contra ? pad8(contra.cuenta) : "", a.concepto.slice(0, 40), (a.doc || "").slice(0, 20), fmt(l.debe), fmt(l.haber)]
      : [a.fecha, a.num, pad8(l.cuenta), l.titulo, a.concepto.slice(0, 60), fmt(l.debe), fmt(l.haber), a.doc || ""]);
  }
  return "﻿" + filas.map((r) => r.map(q).join(sep)).join("\r\n");
}
export function exportarPlanCuentas(asientos) {
  const m = mayores(asientos);
  return "﻿" + [["Cuenta", "Título"], ...m.map((c) => [pad8(c.cuenta), c.titulo])].map((r) => r.join(";")).join("\r\n");
}
