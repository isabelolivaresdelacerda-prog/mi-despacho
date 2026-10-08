// Paquete completo del periodo para la gestoría y para importar en A3 o Sage.
import { exportarApuntes, exportarPlanCuentas, filtrarPeriodo, PROGRAMAS } from "./motor.js";
import { libroFacturasCSV, libroEmitidasCSV, csv, eur, num } from "./datos.js";
import { enRango, porGestionar, cifras, modelosDelAnio, casillas, fechaBonita, NOMBRE_MODELO } from "./periodo.js";

export function paquete({ d, diario, extra, r, formato = "a3", config }) {
  const todos = diario.asientos;
  const A = filtrarPeriodo(todos, r.desde, r.hasta);
  const eti = r.corta.replace(/\s+/g, " ");
  // formato = clave del programa de la gestoría (a3eco, sage50, contaplus…) o, por compatibilidad, "a3" / "sage"
  const prog = PROGRAMAS[formato] ? formato : formato === "sage" ? "sage50" : "a3eco";
  const P = PROGRAMAS[prog];
  const digitos = +config?.digitosGestoria || P.digitos;
  const F = P.nombre.split(" (")[0].replace(/[|/\\:*?"<>]/g, "").trim();
  const fR = d.facturas.filter((f) => enRango(f.fecha, r)), fE = (d.emitidas || []).filter((f) => enRango(f.fecha, r));
  const movs = d.movimientos.filter((m) => enRango(m.fecha, r));
  const pendIds = new Set(diario.pendientes.map((m) => m._id));
  const docMov = new Map(); for (const a of todos) if (a.mov !== null && a.mov !== undefined) docMov.set(a.mov, a);

  // Impuestos del periodo
  const modelos = modelosDelAnio(r.anio, todos, d, diario.pendientes, config?.calendario || {}).filter((m) => r.tramo === "anio" || m.tramo === r.tramo);
  const imp = [["Modelo", "Nombre", "Periodo", "Casilla", "Concepto", "Importe", "Presentado", "Fecha", "Resultado", "Importe presentado", "Justificante"]];
  for (const m of modelos) {
    const c = cifras(todos, d.movimientos, diario.pendientes, m.r, d), p = extra.presentados?.[m.clave];
    for (const [cas, t, v] of casillas(m, c)) imp.push([m.modelo, NOMBRE_MODELO[m.modelo], m.etiqueta, cas, t, v, p ? "Sí" : "No", p?.fecha ? fechaBonita(p.fecha) : "", p?.resultado || "", p ? num(p.importe) : "", p?.justificante || ""]);
  }
  for (const o of (extra.otros || []).filter((o) => enRango(o.fecha, r))) imp.push([o.modelo || "", o.tipo, o.fecha, "", o.descripcion || "", num(o.importe), "Sí", o.fecha, "pagado", num(o.importe), o.archivo || ""]);

  const extracto = [["Fecha", "Concepto", "Importe", "Asiento", "Documento", "Justificante del banco", "Estado"],
    ...movs.map((m) => { const a = docMov.get(m._id); return [m.fecha, m.concepto, m.importe, a?.num || "", m._factura || m._emitida || a?.doc || "", m._justificante?.nombre || (m._justificante?.no ? "no necesita" : ""), pendIds.has(m._id) ? "sin documento (555)" : "contabilizado"]; })];

  const pend = porGestionar(d, todos, diario.pendientes, extra.vinc || [], r);
  const txtPend = pend.length ? pend.map((g) => [`${g.titulo} (${g.items.length})`, ...g.items.map((i) => `  - ${i.fecha || ""} ${i.texto}${i.importe !== undefined ? " " + eur(i.importe) : ""}`)].join("\r\n")).join("\r\n\r\n") : "Nada pendiente.";
  const empresa = config?.empresa?.razon_social || config?.nombre || "";
  const leeme = [
    `CONTABILIDAD ${empresa} – ${r.etiqueta}`, `Preparado con Mi Despacho el ${new Date().toLocaleString("es-ES")}`, "",
    `Diario ${F}.csv: preparado para ${P.nombre}. Un apunte por línea, subcuentas a ${digitos} dígitos, fecha ${P.fecha === "ymd" ? "aaaammdd" : "dd/mm/aaaa"}, separador «;», decimales con coma. En el programa: importar asientos desde fichero de texto/Excel.`,
    "Plan de subcuentas.csv: cuentas y subcuentas usadas, con el NIF de cada proveedor (410xxxxx) y cliente (430xxxxx). Conviene importarlo antes que el diario.",
    "Libro facturas recibidas / emitidas.csv: libros registro de IVA del periodo.",
    "Impuestos.csv: modelos del periodo con sus casillas (orientativas) y lo ya presentado.",
    "Extracto conciliado.csv: cada movimiento del banco con su asiento, documento y justificante.",
    "Pendiente de gestionar.txt: lo que falta (facturas, justificantes, cobros o pagos sin documento…).", "",
    `Asientos: ${A.length} · descuadrados: ${A.filter((a) => !a.cuadra).length} · movimientos sin documento: ${movs.filter((m) => pendIds.has(m._id)).length}`,
    "Los datos leídos por IA son propuestas revisables (supervisión humana).",
  ].join("\r\n");

  return [
    { nombre: `Diario ${F} ${eti}.csv`, texto: exportarApuntes(A, prog, { programa: prog, digitos }) },
    { nombre: `Plan de subcuentas ${eti}.csv`, texto: exportarPlanCuentas(filtrarPeriodo(todos, null, r.hasta), digitos) },
    { nombre: `Libro facturas recibidas ${eti}.csv`, texto: libroFacturasCSV(fR) },
    { nombre: `Libro facturas emitidas ${eti}.csv`, texto: libroEmitidasCSV(fE) },
    { nombre: `Impuestos ${eti}.csv`, texto: csv(imp) },
    { nombre: `Extracto conciliado ${eti}.csv`, texto: csv(extracto) },
    { nombre: `Pendiente de gestionar ${eti}.txt`, texto: "﻿" + txtPend },
    { nombre: `LEEME ${eti}.txt`, texto: "﻿" + leeme },
  ];
}

export async function zipDe(archivos) {
  const { default: JSZip } = await import("jszip");
  const z = new JSZip();
  for (const a of archivos) z.file(a.nombre, a.texto);
  return z.generateAsync({ type: "blob" });
}
export function descargarBlob(blob, nombre) {
  const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
}
