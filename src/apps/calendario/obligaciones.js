// Calendario de obligaciones fiscales y mercantiles de una S.L. española con ejercicio igual al año natural.
// Los plazos son los generales; si el último día cae en sábado o domingo se pasa al lunes. No tiene en cuenta festivos.
// Siempre conviene confirmarlos con la gestoría.

const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
function habil(f) {
  const d = new Date(f + "T12:00:00Z");
  const w = d.getUTCDay();
  if (w === 6) d.setUTCDate(d.getUTCDate() + 2);
  if (w === 0) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
const ultimoDia = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
function sumarMeses(f, n) {
  const [y, m, d] = f.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, Math.min(d, ultimoDia(t.getUTCFullYear(), t.getUTCMonth() + 1)));
}

// opciones: { empleados, alquileres, profesionales, pagosFraccionados, intracomunitarias, cambiosSocios, fechaJunta (yyyy-mm-dd) }
export function obligaciones(anio, o = {}) {
  const E = [];
  const add = (id, fecha, titulo, tipo, detalle, desde) => E.push({ id: `${anio}-${id}`, fecha: habil(fecha), desde: desde || null, titulo, tipo, detalle });
  const prev = anio - 1;

  // ---- Impuestos trimestrales ----
  const trimestres = [[1, iso(anio, 4, 20), iso(anio, 4, 1)], [2, iso(anio, 7, 20), iso(anio, 7, 1)], [3, iso(anio, 10, 20), iso(anio, 10, 1)]];
  for (const [t, fin, ini] of trimestres) {
    add(`303-${t}`, fin, `IVA ${t}T (modelo 303)`, "impuesto", `Autoliquidación del IVA del ${t}º trimestre. Si se domicilia, hasta 5 días antes.`, ini);
    if (o.profesionales || o.empleados) add(`111-${t}`, fin, `Retenciones de profesionales y trabajadores ${t}T (modelo 111)`, "impuesto", "Retenciones practicadas en facturas de profesionales y en nóminas.", ini);
    if (o.alquileres) add(`115-${t}`, fin, `Retenciones de alquileres ${t}T (modelo 115)`, "impuesto", "Si la sociedad paga alquiler de un local.", ini);
    if (o.intracomunitarias) add(`349-${t}`, fin, `Operaciones intracomunitarias ${t}T (modelo 349)`, "impuesto", "", ini);
  }
  // 4º trimestre del año anterior y resúmenes anuales, en enero
  add("303-4", iso(anio, 1, 30), `IVA 4T ${prev} (modelo 303)`, "impuesto", "Autoliquidación del IVA del 4º trimestre del año anterior.", iso(anio, 1, 1));
  add("390", iso(anio, 1, 30), `Resumen anual de IVA ${prev} (modelo 390)`, "impuesto", "", iso(anio, 1, 1));
  if (o.profesionales || o.empleados) {
    add("111-4", iso(anio, 1, 20), `Retenciones 4T ${prev} (modelo 111)`, "impuesto", "", iso(anio, 1, 1));
    add("190", iso(anio, 1, 31), `Resumen anual de retenciones ${prev} (modelo 190)`, "impuesto", "", iso(anio, 1, 1));
  }
  if (o.alquileres) {
    add("115-4", iso(anio, 1, 20), `Retenciones de alquileres 4T ${prev} (modelo 115)`, "impuesto", "", iso(anio, 1, 1));
    add("180", iso(anio, 1, 31), `Resumen anual de retenciones de alquileres ${prev} (modelo 180)`, "impuesto", "", iso(anio, 1, 1));
  }
  add("347", iso(anio, 2, ultimoDia(anio, 2)), `Operaciones con terceros ${prev} (modelo 347)`, "impuesto", "Clientes y proveedores con los que se superaron 3.005,06 € en el año.", iso(anio, 2, 1));
  add("200", iso(anio, 7, 25), `Impuesto sobre Sociedades ${prev} (modelo 200)`, "impuesto", "Declaración anual del Impuesto sobre Sociedades.", iso(anio, 7, 1));
  if (o.pagosFraccionados) {
    add("202-1", iso(anio, 4, 20), "Pago fraccionado del Impuesto sobre Sociedades (modelo 202)", "impuesto", "1er pago fraccionado.", iso(anio, 4, 1));
    add("202-2", iso(anio, 10, 20), "Pago fraccionado del Impuesto sobre Sociedades (modelo 202)", "impuesto", "2º pago fraccionado.", iso(anio, 10, 1));
    add("202-3", iso(anio, 12, 20), "Pago fraccionado del Impuesto sobre Sociedades (modelo 202)", "impuesto", "3er pago fraccionado.", iso(anio, 12, 1));
  }
  if (o.empleados) for (let m = 1; m <= 12; m++) add(`ss-${m}`, iso(anio, m, ultimoDia(anio, m)), "Seguros sociales del mes anterior", "laboral", "Cotizaciones a la Seguridad Social.", null);

  // ---- Mercantil (cierre a 31 de diciembre del año anterior) ----
  add("formulacion", iso(anio, 3, 31), `Formulación de las cuentas anuales ${prev}`, "mercantil", "Los administradores deben formular las cuentas en los 3 meses siguientes al cierre.", iso(anio, 1, 1));
  add("libros", iso(anio, 4, 30), `Legalización de libros contables ${prev} (Diario, Inventarios y Cuentas Anuales)`, "mercantil", "Presentación telemática en el Registro Mercantil, en los 4 meses siguientes al cierre.", iso(anio, 1, 1));
  add("actas", iso(anio, 4, 30), `Legalización del libro de actas ${prev}`, "mercantil", "Actas de junta y, en su caso, del órgano de administración del ejercicio, en formato electrónico, dentro de los 4 meses siguientes al cierre.", iso(anio, 1, 1));
  if (o.cambiosSocios) add("socios", iso(anio, 4, 30), `Legalización del libro registro de socios ${prev}`, "mercantil", "Obligatoria porque en el ejercicio ha habido cambios en los socios (entradas, transmisiones o ampliaciones). Revisa también la declaración de titularidad real.", iso(anio, 1, 1));
  const junta = o.fechaJunta && o.fechaJunta.startsWith(String(anio)) ? o.fechaJunta : iso(anio, 6, 30);
  add("junta", junta, `Junta General Ordinaria: aprobación de las cuentas ${prev}`, "mercantil", o.fechaJunta ? "Fecha prevista de la junta. Recuerda convocarla con al menos 15 días de antelación." : "Debe celebrarse en los 6 primeros meses del ejercicio. Pon la fecha prevista en las opciones. Convocatoria con al menos 15 días de antelación.", sumarMeses(junta, -1));
  add("deposito", sumarMeses(junta, 1), `Depósito de las cuentas anuales ${prev} en el Registro Mercantil`, "mercantil", "En el mes siguiente a su aprobación por la junta, junto con la declaración de titularidad real.", junta);
  return E.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// ---- Exportar a Outlook / Google Calendar (.ics con aviso 7 días y 1 día antes) ----
export function ics(eventos, empresa = "") {
  const esc = (s) => String(s || "").replace(/[\\;,]/g, (c) => "\\" + c).replace(/\n/g, "\\n");
  const d = (f) => f.replace(/-/g, "");
  const sig = (f) => { const x = new Date(f + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10).replace(/-/g, ""); };
  const ahora = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Mi Despacho//Calendario//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const e of eventos) {
    L.push("BEGIN:VEVENT", `UID:${e.id}@mi-despacho`, `DTSTAMP:${ahora}`, `DTSTART;VALUE=DATE:${d(e.fecha)}`, `DTEND;VALUE=DATE:${sig(e.fecha)}`,
      `SUMMARY:${esc((empresa ? empresa + " – " : "") + e.titulo)}`, `DESCRIPTION:${esc(e.detalle)}`,
      "BEGIN:VALARM", "TRIGGER:-P7D", "ACTION:DISPLAY", `DESCRIPTION:${esc(e.titulo)}`, "END:VALARM",
      "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", `DESCRIPTION:${esc(e.titulo)}`, "END:VALARM", "END:VEVENT");
  }
  L.push("END:VCALENDAR");
  return L.join("\r\n");
}
