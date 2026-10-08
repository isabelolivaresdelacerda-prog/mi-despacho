// Motor contable (PGC PYMES): genera el libro diario a partir de facturas, banco, escrituras/contratos vinculados
// y asientos manuales; y de ahí los mayores, sumas y saldos, pérdidas y ganancias y balance.
import { num, fechaOrden, TITULOS_PGC, TIPOS_VINCULO, vencimientos } from "./datos.js";
import { tituloCuenta } from "./pgc.js";
let PLAN = "pymes";
export const usarPlan = (p) => { PLAN = p || "pymes"; };

export const CUENTAS = {
  ...TITULOS_PGC,
  "100": "Capital social", "110": "Prima de emisión", "112": "Reserva legal", "118": "Aportaciones de socios", "120": "Remanente", "121": "Resultados negativos de ejercicios anteriores", "129": "Resultado del ejercicio",
  "170": "Deudas a largo plazo con entidades de crédito", "171": "Deudas a largo plazo", "180": "Fianzas recibidas a largo plazo", "181": "Anticipos recibidos por ventas a largo plazo",
  "210": "Terrenos y bienes naturales", "211": "Construcciones", "300": "Mercaderías / existencias", "407": "Anticipos a proveedores",
  "400": "Proveedores", "410": "Acreedores por prestaciones de servicios", "430": "Clientes", "438": "Anticipos de clientes",
  "472": "H.P. IVA soportado", "473": "H.P. retenciones y pagos a cuenta", "4751": "H.P. acreedora por retenciones practicadas", "477": "H.P. IVA repercutido", "4700": "H.P. deudora por IVA", "4750": "H.P. acreedora por IVA", "4752": "H.P. acreedora por impuesto sobre sociedades", "4759": "Otros tributos pendientes de pago (Comunidad Autónoma, ayuntamiento)",
  "520": "Deudas a corto plazo con entidades de crédito", "551": "Cuenta corriente con socios y administradores", "555": "Partidas pendientes de aplicación", "572": "Bancos",
  "600": "Compras de mercaderías", "621": "Arrendamientos y cánones", "622": "Reparaciones y conservación", "640": "Sueldos y salarios", "642": "Seguridad Social a cargo de la empresa",
  "662": "Intereses de deudas", "669": "Otros gastos financieros", "681": "Amortización del inmovilizado material", "630": "Impuesto sobre beneficios",
  "700": "Ventas", "705": "Prestaciones de servicios", "740": "Subvenciones a la explotación", "752": "Ingresos por arrendamientos", "759": "Ingresos por servicios diversos", "769": "Otros ingresos financieros",
};
export const titulo = (c) => tituloCuenta(c, PLAN) || CUENTAS[c] || CUENTAS[String(c).slice(0, 4)] || CUENTAS[String(c).slice(0, 3)] || "";
const r2 = (x) => Math.round(num(x) * 100) / 100;
const fechaMas = (iso, d) => { const t = new Date(iso + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + d); return t.toISOString().slice(0, 10); };
const claveMov = (m) => `${m.fecha}|${r2(m.importe)}|${(m.concepto || "").slice(0, 60)}`;
export { claveMov };

// Subcuentas por tercero (8 dígitos): 41000001 David Alcón, 41000002 Notaría… Se reconoce al tercero por su NIF
// o por su nombre sin tildes ni signos, así el pago sin factura y la factura que llega después van a la misma subcuenta.
const FORMAS = /\b(S\s?L\s?U?|S\s?L\s?P|S\s?A\s?U?|S\s?C(OOP)?|C\s?B|LTD|LIMITED|LLC|INC|CORP(ORATION)?|GMBH|B\s?V|S\s?A\s?S|SARL|SRL|SPA|AG|PLC|CO|COMPANY|SOCIEDAD|LIMITADA|ANONIMA|WWW|COM|NET|ORG|ES|EU|IE|IRELAND|EUROPE|ESPANA|SPAIN|IBERIA)\b/g;
export const claveTercero = (t) => {
  const k = String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").replace(FORMAS, " ").replace(/\s+/g, "").slice(0, 30);
  return k || "VARIOS";
};
// Nombre probable del tercero en el concepto del banco: "S/ORD.TRANSFERENCIA pago topografico SEPA 618289694330 david alcon martin" → "David Alcon Martin"
export function adivinarTercero(concepto) {
  let t = String(concepto || "");
  const largos = [...t.matchAll(/\d{6,}/g)];
  if (largos.length) { const u = largos[largos.length - 1]; const resto = t.slice(u.index + u[0].length).trim(); if (resto.replace(/[^a-z]/gi, "").length > 3) t = resto; }
  t = t.replace(/\b(s\/ord|ord|transf\w*|sepa|pago|recibo|adeudo|cargo|abono|bizum|a favor de|de|n[ºo]\.?|ref\w*|concepto|traspaso|emitida|recibida|inmediata|ordinaria)\b\.?/gi, " ").replace(/[\d/.:_-]+/g, " ").replace(/\s+/g, " ").trim();
  return t.toLowerCase().replace(/(^|\s)\S/g, (x) => x.toUpperCase()).slice(0, 60);
}
// Palabras que no sirven para reconocer a una entidad
const GENERICAS = new Set(["SERVICIOS", "SERVICIO", "GESTION", "GESTORIA", "ABOGADOS", "ASESORES", "CONSULTING", "CONSULTORES", "GRUPO", "INVERSIONES", "HOLDING", "COMERCIAL", "INTERNACIONAL", "SOLUCIONES", "TECNOLOGIA", "PROMOCIONES", "INMOBILIARIA", "CONSTRUCCIONES", "NOTARIA", "REGISTRO", "BANCO", "SEGUROS", "DAVID", "MARIA", "JOSE", "JUAN", "ANTONIO", "MANUEL", "CARLOS", "JAVIER", "LUIS", "ISABEL", "PAGO", "FACTURA", "TRANSFERENCIA"]);
const plano = (t) => " " + String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim() + " ";
// ¿A qué entidad conocida (proveedor o cliente con facturas) pertenece este movimiento?
export function entidadDe(concepto, terceros) {
  const c = plano(concepto), cj = c.replace(/ /g, "");
  let mejor = null;
  for (const t of terceros) {
    const k = claveTercero(t);
    if (k.length >= 5 && cj.includes(k)) return t;
    const pal = plano(t).trim().split(" ").filter((w) => w.length >= 4 && !GENERICAS.has(w) && !/^\d+$/.test(w));
    if (pal.length && pal.every((w) => c.includes(" " + w + " "))) mejor = mejor || t;
    else if (!mejor && pal[0] && pal[0].length >= 5 && c.includes(" " + pal[0] + " ")) mejor = t;
  }
  return mejor;
}

function subcuentas() {
  const mapa = new Map(), cont = {};
  return (base, nombre, nif) => {
    const kn = nif ? base + "|NIF" + String(nif).toUpperCase().replace(/[^A-Z0-9]/g, "") : null;
    const ct = claveTercero(nombre || nif);
    const kt = base + "|" + ct;
    let c = (kn && mapa.get(kn)) || mapa.get(kt);
    // Variantes del mismo nombre ("WIX" y "WIXCOM", "NOTARIA GARCIA" y "NOTARIA GARCIA LOPEZ")
    if (!c && ct.length >= 3 && ct !== "VARIOS") for (const [k, v] of mapa) { const o = k.split("|")[1]; if (k.startsWith(base + "|") && !o.startsWith("NIF") && o.length >= 3 && (o.startsWith(ct) || ct.startsWith(o))) { c = v; break; } }
    if (!c) { cont[base] = (cont[base] || 0) + 1; c = base + String(cont[base]).padStart(8 - base.length, "0"); }
    if (kn) mapa.set(kn, c);
    if (nombre) mapa.set(kt, c);
    return c;
  };
}

// datos = { facturas, emitidas, movimientos }, vinculados = [...], manuales = [...asientos], asignaciones = { claveMov: {cuenta, concepto} },
// impuestos = modelos presentados [{ modelo, etiqueta, fechaFin, plazo, importe, ivaRep, ivaSop }]
export function generarDiario({ facturas, emitidas = [], movimientos }, vinculados = [], manuales = [], asignaciones = {}, impuestos = []) {
  const sub = subcuentas();
  const A = [];
  const asiento = (fecha, concepto, lineas, origen, doc, mov = null) => {
    const l = lineas.filter((x) => r2(x.debe) || r2(x.haber)).map((x) => ({ ...x, debe: r2(x.debe), haber: r2(x.haber), titulo: x.titulo || titulo(x.cuenta) }));
    if (l.length) A.push({ fecha, concepto, lineas: l, origen, doc, mov });
  };
  const usados = new Set();

  // Cuenta de gasto elegida al aplicar un pago a un tercero: se usa en su factura si la factura no la trae clara
  const cuentaTercero = {};
  for (const a of Object.values(asignaciones)) if (a?.tercero && a.cuenta) cuentaTercero[claveTercero(a.tercero)] = a.cuenta;
  // Entidades conocidas: proveedores y clientes con facturas, y terceros ya asignados a mano
  const proveedores = [...new Set(facturas.map((f) => f.proveedor).filter(Boolean))];
  const clientes = [...new Set(emitidas.map((f) => f.cliente).filter(Boolean))];
  const provisionistas = [...proveedores, ...Object.values(asignaciones).map((a) => a?.tercero).filter(Boolean)];
  const pendFactura = new Map(); // archivo → subcuenta, para saber qué facturas quedan por pagar (por saldo)
  // 1) Facturas recibidas y su pago
  for (let f of facturas) {
    if ((!f.cuenta_pgc || f.cuenta_pgc === "629") && !f._editada && cuentaTercero[claveTercero(f.proveedor)]) f = { ...f, cuenta_pgc: cuentaTercero[claveTercero(f.proveedor)] };
    if (!f.total) continue;
    const cta = sub("410", f.proveedor, f.nif_proveedor);
    const c = `${f.proveedor || "Proveedor"} ${f.numero || ""}`.trim();
    // Suplidos (no sujetos: papel timbrado, Registro, tasas…): van al gasto y al total, sin IVA. Así el asiento siempre cuadra.
    const suplidos = r2(f.total - (f.base + f.iva_importe - f.retencion_importe));
    // Inversión del sujeto pasivo (proveedor extranjero sin IVA español: Anthropic, Base44, Hostinger…): autorrepercusión 472/477
    const isp = f.isp ? r2(num(f.isp_importe) || f.base * (num(f.isp_pct) || 21) / 100) : 0;
    // Factura mal sumada por el proveedor (total menor que base + IVA, por poco): se apunta lo que dice el total y la
    // diferencia va a «diferencias» (778) para que el asiento cuadre; la app avisa para pedir una factura rectificada.
    const errorSuma = suplidos < -0.009 && suplidos > -5 ? -suplidos : 0;
    asiento(f.fecha, `Factura ${c}${errorSuma ? ` · ojo: la factura está mal sumada (${errorSuma.toFixed(2)} €): pedir rectificativa` : ""}`, [
      { cuenta: f.cuenta_pgc || "629", debe: f.base },
      { cuenta: f.cuenta_pgc || "629", titulo: "Suplidos", debe: suplidos > 0.009 ? suplidos : 0 },
      { cuenta: "472", debe: f.iva_importe },
      { cuenta: "472", titulo: "IVA soportado (inversión del sujeto pasivo)", debe: isp },
      { cuenta: "477", titulo: "IVA repercutido (inversión del sujeto pasivo)", haber: isp },
      { cuenta: "4751", haber: f.retencion_importe },
      { cuenta: cta, titulo: f.proveedor, nif: f.nif_proveedor, haber: f.total },
      { cuenta: "778", titulo: "Diferencia por error de suma en la factura del proveedor", haber: errorSuma },
    ], "factura", f.archivo);
    pendFactura.set(f.archivo, cta);
    if (f._pago) {
      const m = movimientos.find((x) => x._factura === f.archivo);
      if (m) usados.add(m._id);
      // Pagada por otro (p. ej. Solve con la provisión de fondos): se descuenta de la subcuenta de quien pagó
      const pagador = f._pago.manual ? entidadDe(f._pago.texto, provisionistas) : null;
      const contra = f._pago.manual ? (pagador ? sub("410", pagador) : "551") : "572";
      // Se apunta lo que de verdad salió del banco: si no coincide con la factura, la diferencia queda en la cuenta del proveedor
      const pagado = m ? Math.abs(m.importe) : f.total;
      asiento(f._pago.fecha || f.fecha, `Pago ${c}${pagador ? ` (por ${pagador})` : ""}${f._pago.dif ? ` · ojo: ${f._pago.dif > 0 ? "pagado de más" : "pagado de menos"} ${Math.abs(f._pago.dif).toFixed(2)}` : ""}`, [{ cuenta: cta, titulo: f.proveedor, debe: pagado }, { cuenta: contra, titulo: pagador || undefined, haber: pagado }], "pago", f.archivo, m ? m._id : null);
    }
  }

  // 1b) Facturas emitidas y su cobro
  for (const f of emitidas) {
    if (!f.total) continue;
    const cta = sub("430", f.cliente, f.nif_cliente);
    const c = `${f.cliente || "Cliente"} ${f.numero || ""}`.trim();
    asiento(f.fecha, `Factura emitida ${c}`, [
      { cuenta: cta, titulo: f.cliente, nif: f.nif_cliente, debe: f.total },
      { cuenta: "473", debe: f.retencion_importe },
      { cuenta: f.cuenta_pgc || "705", haber: f.base },
      { cuenta: "477", haber: f.iva_importe },
    ], "emitida", f.archivo);
    pendFactura.set(f.archivo, cta);
    if (f._cobro) {
      const m = movimientos.find((x) => x._emitida === f.archivo);
      if (m) usados.add(m._id);
      asiento(f._cobro.fecha || f.fecha, `Cobro ${c}`, [{ cuenta: "572", debe: f.total }, { cuenta: cta, titulo: f.cliente, nif: f.nif_cliente, haber: f.total }], "cobro", f.archivo, m ? m._id : null);
    }
  }

  // 1c) Impuestos presentados: liquidación del IVA y su pago en el banco
  const CTA_IMP = { "303": "4750", "111": "4751", "115": "4751", "202": "473", "200": "4752" };
  for (const t of impuestos) {
    if (t.modelo === "otro") {
      // ITP/AJD, IBI, plusvalía, IAE, tasas…: gasto (631) o mayor valor del bien comprado; pagado por banco, por un tercero o pendiente
      const imp = r2(t.importe); if (!imp) continue;
      let contra = "4759", mv = null;
      if (t.pagadoPor) contra = sub("410", t.pagadoPor);
      else {
        mv = t.mov ? movimientos.find((x) => !usados.has(x._id) && claveMov(x) === t.mov) : movimientos.find((x) => !usados.has(x._id) && !x._factura && x.importe < 0 && Math.abs(Math.abs(x.importe) - imp) < 0.011 && Math.abs(Date.parse(fechaOrden(x.fecha)) - Date.parse(fechaOrden(t.fecha))) <= 40 * 86400000);
        if (mv) { usados.add(mv._id); contra = "572"; }
      }
      asiento(mv?.fecha || t.fecha, t.etiqueta, [{ cuenta: t.cuenta || "631", debe: imp }, { cuenta: contra, titulo: t.pagadoPor || undefined, haber: imp }], "tributo", t.justificante || "", mv ? mv._id : null);
      continue;
    }
    if (t.modelo === "303" && (t.ivaRep || t.ivaSop)) {
      const res = r2(t.ivaRep - t.ivaSop);
      asiento(t.fechaFin, `Liquidación del IVA ${t.etiqueta} (303)`, [{ cuenta: "477", debe: t.ivaRep }, { cuenta: "472", haber: t.ivaSop }, res >= 0 ? { cuenta: "4750", haber: res } : { cuenta: "4700", debe: -res }], "regularizacion", t.justificante || "");
    }
    const imp = r2(t.importe);
    if (imp <= 0 || !CTA_IMP[t.modelo]) continue;
    const desde = fechaOrden(t.fechaFin), hasta = t.plazo ? fechaMas(t.plazo, 10) : "9999";
    const m = t.mov ? movimientos.find((x) => !usados.has(x._id) && claveMov(x) === t.mov) : movimientos.find((x) => !usados.has(x._id) && !x._factura && !x._emitida && x.importe < 0 && Math.abs(Math.abs(x.importe) - imp) < 0.011 && fechaOrden(x.fecha) >= desde && fechaOrden(x.fecha) <= hasta);
    if (!m) continue;
    usados.add(m._id);
    asiento(m.fecha, `Pago modelo ${t.modelo} ${t.etiqueta}`, [{ cuenta: CTA_IMP[t.modelo], debe: imp }, { cuenta: "572", haber: imp }], "impuesto", t.justificante || "", m._id);
  }

  // 2) Escrituras y contratos vinculados
  for (const v of vinculados) {
    const t = TIPOS_VINCULO[v.tipo]; if (!t) continue;
    const cuenta = v.cuenta || t.cuenta || "629";
    const c = `${t.nombre}${v.tercero ? " – " + v.tercero : ""}`;
    if (!t.periodico) {
      if (!num(v.importe)) continue;
      const mov = movimientos.find((x) => !usados.has(x._id) && Math.abs(Math.abs(x.importe) - num(v.importe)) < 0.011 && Math.sign(x.importe) === t.signo);
      // Sin su movimiento en el banco no se apunta nada contra el banco (si no, el saldo de la 572 se inventa dinero):
      // el documento queda como informativo hasta que aparezca el cobro o pago, o se aplique a mano.
      if (!mov) continue;
      usados.add(mov._id);
      asiento(v.fecha || mov.fecha, c, t.signo > 0 ? [{ cuenta: "572", debe: v.importe }, { cuenta, haber: v.importe }] : [{ cuenta, debe: v.importe }, { cuenta: "572", haber: v.importe }], "documento", v.archivo, mov._id);
    } else {
      for (const q of vencimientos(v, movimientos)) {
        if (!q.mov) continue;
        usados.add(q.mov._id);
        asiento(q.mov.fecha, `${c} (cuota)`, t.signo > 0 ? [{ cuenta: "572", debe: q.importe }, { cuenta, haber: q.importe }] : [{ cuenta, debe: q.importe }, { cuenta: "572", haber: q.importe }], "cuota", v.archivo, q.mov._id);
      }
    }
  }

  // 3) Movimientos del banco sin documento: asignados a mano o a «partidas pendientes de aplicación» (555)
  const pendientes = [];
  for (const m of movimientos) {
    if (usados.has(m._id) || m._factura || m._emitida) continue;
    const ent = adivinarTercero(m.concepto);
    const a = asignaciones[claveMov(m)] || asignaciones["@" + claveTercero(ent)] || (() => { const e = entidadDe(m.concepto, provisionistas.filter((x) => asignaciones["@" + claveTercero(x)])); return e ? { ...asignaciones["@" + claveTercero(e)], tercero: asignaciones["@" + claveTercero(e)].tercero || e } : null; })();
    const imp = Math.abs(m.importe);
    if (!a) {
      // Entidad con facturas (Solve, Wix…): el pago o cobro va a su subcuenta y se cuadra por saldo
      const prov = m.importe < 0 ? entidadDe(m.concepto, proveedores) || entidadDe(m.concepto, clientes) : entidadDe(m.concepto, clientes) || entidadDe(m.concepto, proveedores);
      if (prov) {
        const base = proveedores.includes(prov) ? "410" : "430";
        const cta = sub(base, prov);
        asiento(m.fecha, `${m.importe < 0 ? "Pago a" : "Cobro de"} ${prov}`, m.importe >= 0 ? [{ cuenta: "572", debe: imp }, { cuenta: cta, titulo: prov, haber: imp }] : [{ cuenta: cta, titulo: prov, debe: imp }, { cuenta: "572", haber: imp }], "banco-entidad", "", m._id);
        continue;
      }
    }
    if (a?.tercero && a.esperaFactura) {
      // Pago (o cobro) a un tercero a la espera de su factura: va a su subcuenta de acreedor (410) o de cliente (430)
      // Un ingreso de alguien a quien le compramos (devolución, transferencia anulada…) va a su cuenta de acreedor, no a cliente
      const esProveedor = m.importe < 0 || proveedores.some((p) => claveTercero(p) === claveTercero(a.tercero)) || /DEVOLUCI|CANCELACI|ANULACI|RETROCES/i.test(m.concepto || "");
      const cta = sub(esProveedor ? "410" : "430", a.tercero);
      const c = m.importe < 0 ? `Pago a ${a.tercero} (a falta de factura)` : esProveedor ? `Devolución de ${a.tercero}` : `Cobro de ${a.tercero} (a falta de factura)`;
      asiento(m.fecha, c, m.importe >= 0 ? [{ cuenta: "572", debe: imp }, { cuenta: cta, titulo: a.tercero, haber: imp }] : [{ cuenta: cta, titulo: a.tercero, debe: imp }, { cuenta: "572", haber: imp }], "banco-tercero", "", m._id);
      continue;
    }
    const cuenta = a?.cuenta || "555";
    if (!a) pendientes.push(m);
    asiento(m.fecha, a?.concepto || m.concepto, m.importe >= 0 ? [{ cuenta: "572", debe: imp }, { cuenta, haber: imp }] : [{ cuenta, debe: imp }, { cuenta: "572", haber: imp }], a ? "banco" : "banco-pendiente", "", m._id);
  }

  // 4) Asientos manuales
  for (const m of manuales) asiento(m.fecha, m.concepto, m.lineas, "manual", m.doc || "");

  A.sort((a, b) => fechaOrden(a.fecha).localeCompare(fechaOrden(b.fecha)));
  A.forEach((a, i) => { a.num = i + 1; a.cuadra = Math.abs(a.lineas.reduce((s, l) => s + l.debe - l.haber, 0)) < 0.01; });
  return { asientos: A, pendientes, sinPagar: sinPagarPorSaldo(A, pendFactura, [...facturas, ...emitidas]) };
}

// Qué facturas siguen sin pagar (o sin cobrar) según el saldo de la subcuenta de cada tercero:
// los pagos se aplican a las facturas más antiguas, aunque una transferencia pague varias o sea una provisión.
function sinPagarPorSaldo(A, pendFactura, todas) {
  const saldo = {};
  for (const a of A) for (const l of a.lineas) if (/^4[13]0\d{5}$/.test(l.cuenta)) saldo[l.cuenta] = (saldo[l.cuenta] || 0) + l.debe - l.haber;
  const porCta = {};
  for (const f of todas) { const c = pendFactura.get(f.archivo); if (c) (porCta[c] ||= []).push(f); }
  const out = new Set();
  for (const [c, fs] of Object.entries(porCta)) {
    let falta = c.startsWith("430") ? r2(saldo[c] || 0) : r2(-(saldo[c] || 0)); // lo que aún se debe (o nos deben)
    // Las que tienen su propio pago casado (por número, importe o elegido a mano) están pagadas; lo que quede debiendo
    // la cuenta se reparte solo entre las que no lo tienen, empezando por las más recientes
    for (const f of [...fs].filter((x) => !x._pago && !x._cobro).sort((a, b) => fechaOrden(b.fecha).localeCompare(fechaOrden(a.fecha)))) { if (falta <= 0.01) break; out.add(f.archivo); falta = r2(falta - f.total); }
  }
  return out;
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
export function perdidasYGanancias(asientos, esfl = PLAN === "esfl") {
  const s = mayores(asientos);
  const L = esfl ? [
    ["1. Ingresos de la actividad propia (cuotas, donativos, subvenciones, patrocinios)", g(s, ["72", "74"], -1)],
    ["2. Ventas y otros ingresos de la actividad mercantil", g(s, ["70", "75"], -1)],
    ["3. Gastos por ayudas y otros", g(s, ["65"], -1)],
    ["6. Aprovisionamientos", g(s, ["60", "61"], -1)],
    ["8. Gastos de personal", g(s, ["64"], -1)],
    ["9. Otros gastos de la actividad", g(s, ["62", "631", "634", "639"], -1)],
    ["10. Amortización del inmovilizado", g(s, ["68"], -1)],
  ] : [
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
export function balance(asientos, esfl = PLAN === "esfl") {
  const s = mayores(asientos);
  const pyg = perdidasYGanancias(asientos, esfl).resultado;
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
  const ap = -neto(sal(["118"]));
  const pn = [
    [esfl ? "Fondo social y reservas (10, 11, 12)" : "Capital y reservas (10, 11, 12)", r2(-neto(sal(["10", "11", "12"])) - ap)],
    [esfl ? "Aportaciones (118)" : "Aportaciones de socios (118)", r2(ap)],
    ["Subvenciones, donaciones y legados de capital (13)", r2(-neto(sal(["13"])))],
    [esfl ? "Excedente del ejercicio" : "Resultado del ejercicio", pyg],
  ];
  const pasivo = [
    ["Deudas a largo plazo (17, 18)", -neto(sal(["17", "18"]))],
    ["Acreedores y otras deudas a corto plazo", -neto(acreedores)],
  ];
  const tA = r2(activo.reduce((t, x) => t + x[1], 0)), tP = r2([...pn, ...pasivo].reduce((t, x) => t + x[1], 0));
  return { activo, pn, pasivo, totalActivo: tA, totalPasivo: tP, cuadra: Math.abs(tA - tP) < 0.05 };
}

// ---- Exportación para A3 / Sage / ContaPlus: un apunte por línea, subcuentas a la longitud del programa ----
// Programas de la gestoría: formato de columnas, longitud de subcuenta y formato de fecha
export const PROGRAMAS = {
  a3eco: { nombre: "A3ECO", formato: "a3", digitos: 8, fecha: "dmy" },
  a3asesor: { nombre: "A3ASESOR | con (A3 Software)", formato: "a3", digitos: 8, fecha: "dmy" },
  a3innuva: { nombre: "a3innuva Contabilidad", formato: "a3", digitos: 8, fecha: "dmy" },
  sage50: { nombre: "Sage 50 (antes ContaWin)", formato: "sage", digitos: 8, fecha: "dmy" },
  sage200: { nombre: "Sage 200", formato: "sage", digitos: 9, fecha: "dmy" },
  sagedespachos: { nombre: "Sage Despachos Connected", formato: "sage", digitos: 8, fecha: "dmy" },
  contaplus: { nombre: "ContaPlus (Sage)", formato: "contaplus", digitos: 8, fecha: "ymd" },
};
// Cuenta a n dígitos: las subcuentas de terceros (410/430/400 + número) rellenan con ceros por dentro; el resto por detrás
export function cuentaN(c, n = 8) {
  const s = String(c);
  if (/^(400|410|430)\d{5,}$/.test(s)) return s.slice(0, 3) + String(+s.slice(3)).padStart(n - 3, "0");
  return s.length >= n ? s.slice(0, n) : s.padEnd(n, "0");
}
const pad8 = (c) => cuentaN(c, 8);
const fechaPrograma = (f, tipo) => { const o = fechaOrden(f); return tipo === "ymd" ? o.replace(/-/g, "") : `${o.slice(8, 10)}/${o.slice(5, 7)}/${o.slice(0, 4)}`; };
export function exportarApuntes(asientos, formato = "a3", opciones = {}) {
  const P = PROGRAMAS[opciones.programa] || {};
  const n = opciones.digitos || P.digitos || 8, tf = P.fecha || "dmy";
  const fmtF = PROGRAMAS[formato] ? PROGRAMAS[formato].formato : P.formato || formato;
  const sep = ";";
  const fmt = (x) => (x ? x.toFixed(2).replace(".", ",") : "");
  const q = (s) => { const t = String(s ?? ""); return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const cab = fmtF === "sage" || fmtF === "contaplus"
    ? ["Asiento", "Fecha", "Subcuenta", "Contrapartida", "Concepto", "Documento", "Debe", "Haber"]
    : ["Fecha", "Asiento", "Cuenta", "Descripción cuenta", "Concepto", "Debe", "Haber", "Documento"];
  const filas = [cab];
  for (const a of asientos) for (const l of a.lineas) {
    const contra = a.lineas.find((x) => x !== l && (l.debe ? x.haber : x.debe));
    const f = fechaPrograma(a.fecha, tf);
    filas.push(fmtF === "sage" || fmtF === "contaplus"
      ? [a.num, f, cuentaN(l.cuenta, n), contra ? cuentaN(contra.cuenta, n) : "", a.concepto.slice(0, fmtF === "contaplus" ? 25 : 40), (a.doc || "").slice(0, fmtF === "contaplus" ? 10 : 20), fmt(l.debe), fmt(l.haber)]
      : [f, a.num, cuentaN(l.cuenta, n), l.titulo, a.concepto.slice(0, 60), fmt(l.debe), fmt(l.haber), a.doc || ""]);
  }
  return "\ufeff" + filas.map((r) => r.map(q).join(sep)).join("\r\n");
}
export function exportarPlanCuentas(asientos, digitos = 8) {
  const m = mayores(asientos);
  const nifs = {};
  for (const a of asientos) for (const l of a.lineas) if (l.nif) nifs[l.cuenta] = l.nif;
  const q = (s) => { const t = String(s ?? ""); return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  return "﻿" + [["Cuenta", "Título", "NIF"], ...m.map((c) => [cuentaN(c.cuenta, digitos), c.titulo, nifs[c.cuenta] || ""])].map((r) => r.map(q).join(";")).join("\r\n");
}
