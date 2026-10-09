// VERI*FACTU directo con la AEAT (sin intermediarios). Aquí se arma el registro de cada factura:
// huella SHA-256 encadenada con la anterior, XML del registro de alta (esquema SuministroLR 1.0) y la URL del QR.
// El envío lo hace el «Firmador de Mi Despacho» en el ordenador de la usuaria, con su certificado de Windows.
export const ENTORNOS = {
  pruebas: { nombre: "Pruebas (preproducción de la AEAT)", qr: "https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR" },
  produccion: { nombre: "Real (producción)", qr: "https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR" },
};
const NS_SUM = "https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd";
const NS_SUM1 = "https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd";

const x = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const dos = (v) => (Math.round((+v || 0) * 100) / 100).toFixed(2);
// dd-mm-aaaa
export const fechaAEAT = (d) => { const f = d instanceof Date ? d : new Date(d); return `${String(f.getDate()).padStart(2, "0")}-${String(f.getMonth() + 1).padStart(2, "0")}-${f.getFullYear()}`; };
// 2026-10-09T12:34:56+02:00 (con el huso horario, sin «Z»)
export function marcaTiempo(d = new Date()) {
  const p = (n) => String(Math.abs(n)).padStart(2, "0"), off = -d.getTimezoneOffset();
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${off >= 0 ? "+" : "-"}${p(Math.trunc(off / 60))}:${p(off % 60)}`;
}

async function sha256Mayus(texto) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

// Desglose por tipo de IVA a partir de las líneas
export function desglose(lineas) {
  const g = {};
  for (const l of lineas) { const t = +l.iva || 0, b = (+l.cantidad || 0) * (+l.precio || 0); g[t] = (g[t] || 0) + b; }
  return Object.entries(g).map(([tipo, base]) => ({ tipo: +tipo, base: +dos(base), cuota: +dos(base * +tipo / 100) }));
}

// r = { nif, nombre, numero (serie+número), fecha (Date|ISO), tipo: "F1"|"F2", descripcion, destinatario:{nombre,nif}, lineas, retencion }
// anterior = { nif, numero, fecha (dd-mm-aaaa), huella } o null si es el primero de la cadena
export async function registroAlta(r, anterior, sistema) {
  const det = desglose(r.lineas);
  const cuota = +dos(det.reduce((s, d) => s + d.cuota, 0));
  const base = det.reduce((s, d) => s + d.base, 0);
  const total = +dos(base + cuota); // ImporteTotal = base + cuotas (la retención no forma parte del importe total del registro)
  const fecha = fechaAEAT(r.fecha), ts = marcaTiempo();
  const huella = await sha256Mayus(`IDEmisorFactura=${r.nif}&NumSerieFactura=${r.numero}&FechaExpedicionFactura=${fecha}&TipoFactura=${r.tipo || "F1"}&CuotaTotal=${dos(cuota)}&ImporteTotal=${dos(total)}&Huella=${anterior?.huella || ""}&FechaHoraHusoGenRegistro=${ts}`);
  const xml = `<sum1:RegistroAlta><sum1:IDVersion>1.0</sum1:IDVersion>`
    + `<sum1:IDFactura><sum1:IDEmisorFactura>${x(r.nif)}</sum1:IDEmisorFactura><sum1:NumSerieFactura>${x(r.numero)}</sum1:NumSerieFactura><sum1:FechaExpedicionFactura>${fecha}</sum1:FechaExpedicionFactura></sum1:IDFactura>`
    + `<sum1:NombreRazonEmisor>${x(r.nombre)}</sum1:NombreRazonEmisor><sum1:TipoFactura>${r.tipo || "F1"}</sum1:TipoFactura>`
    + `<sum1:DescripcionOperacion>${x((r.descripcion || "Prestación de servicios").slice(0, 500))}</sum1:DescripcionOperacion>`
    + (r.destinatario?.nif ? `<sum1:Destinatarios><sum1:IDDestinatario><sum1:NombreRazon>${x(r.destinatario.nombre)}</sum1:NombreRazon><sum1:NIF>${x(r.destinatario.nif)}</sum1:NIF></sum1:IDDestinatario></sum1:Destinatarios>` : "")
    + `<sum1:Desglose>${det.map((d) => `<sum1:DetalleDesglose><sum1:Impuesto>01</sum1:Impuesto><sum1:ClaveRegimen>01</sum1:ClaveRegimen><sum1:CalificacionOperacion>S1</sum1:CalificacionOperacion><sum1:TipoImpositivo>${dos(d.tipo)}</sum1:TipoImpositivo><sum1:BaseImponibleOimporteNoSujeto>${dos(d.base)}</sum1:BaseImponibleOimporteNoSujeto><sum1:CuotaRepercutida>${dos(d.cuota)}</sum1:CuotaRepercutida></sum1:DetalleDesglose>`).join("")}</sum1:Desglose>`
    + `<sum1:CuotaTotal>${dos(cuota)}</sum1:CuotaTotal><sum1:ImporteTotal>${dos(total)}</sum1:ImporteTotal>`
    + `<sum1:Encadenamiento>${anterior ? `<sum1:RegistroAnterior><sum1:IDEmisorFactura>${x(anterior.nif)}</sum1:IDEmisorFactura><sum1:NumSerieFactura>${x(anterior.numero)}</sum1:NumSerieFactura><sum1:FechaExpedicionFactura>${anterior.fecha}</sum1:FechaExpedicionFactura><sum1:Huella>${anterior.huella}</sum1:Huella></sum1:RegistroAnterior>` : `<sum1:PrimerRegistro>S</sum1:PrimerRegistro>`}</sum1:Encadenamiento>`
    + `<sum1:SistemaInformatico><sum1:NombreRazon>${x(sistema.nombreRazon)}</sum1:NombreRazon><sum1:NIF>${x(sistema.nif)}</sum1:NIF><sum1:NombreSistemaInformatico>${x(sistema.nombre || "Mi Despacho")}</sum1:NombreSistemaInformatico><sum1:IdSistemaInformatico>${x(sistema.id || "MD")}</sum1:IdSistemaInformatico><sum1:Version>${x(sistema.version || "1.0")}</sum1:Version><sum1:NumeroInstalacion>${x(sistema.instalacion || "1")}</sum1:NumeroInstalacion><sum1:TipoUsoPosibleSoloVerifactu>S</sum1:TipoUsoPosibleSoloVerifactu><sum1:TipoUsoPosibleMultiOT>S</sum1:TipoUsoPosibleMultiOT><sum1:IndicadorMultiplesOT>N</sum1:IndicadorMultiplesOT></sum1:SistemaInformatico>`
    + `<sum1:FechaHoraHusoGenRegistro>${ts}</sum1:FechaHoraHusoGenRegistro><sum1:TipoHuella>01</sum1:TipoHuella><sum1:Huella>${huella}</sum1:Huella></sum1:RegistroAlta>`;
  return { xml, huella, fecha, ts, cuota, total, base: +dos(base) };
}

export function sobreSOAP(obligado, registrosXml) {
  return `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:sum="${NS_SUM}" xmlns:sum1="${NS_SUM1}"><soapenv:Header/><soapenv:Body><sum:RegFactuSistemaFacturacion>`
    + `<sum:Cabecera><sum1:ObligadoEmision><sum1:NombreRazon>${x(obligado.nombre)}</sum1:NombreRazon><sum1:NIF>${x(obligado.nif)}</sum1:NIF></sum1:ObligadoEmision></sum:Cabecera>`
    + registrosXml.map((r) => `<sum:RegistroFactura>${r}</sum:RegistroFactura>`).join("")
    + `</sum:RegFactuSistemaFacturacion></soapenv:Body></soapenv:Envelope>`;
}

export function urlQR(entorno, nif, numero, fecha, importe) {
  const q = new URLSearchParams({ nif, numserie: numero, fecha, importe: dos(importe) });
  return `${ENTORNOS[entorno]?.qr || ENTORNOS.pruebas.qr}?${q.toString()}`;
}
export async function qrPNG(url) {
  const QR = (await import("qrcode")).default;
  return QR.toDataURL(url, { errorCorrectionLevel: "M", margin: 1, width: 360 });
}

// Lee la respuesta de la AEAT (sin depender de prefijos de espacio de nombres)
export function leerRespuesta(texto) {
  const t = String(texto || "");
  const v = (tag, base = t) => (base.match(new RegExp(`<(?:\\w+:)?${tag}>([\\s\\S]*?)</(?:\\w+:)?${tag}>`)) || [])[1]?.trim() || "";
  const fallo = v("faultstring");
  if (fallo) return { ok: false, estado: "Error", error: fallo, lineas: [] };
  const lineas = [...t.matchAll(/<(?:\w+:)?RespuestaLinea>([\s\S]*?)<\/(?:\w+:)?RespuestaLinea>/g)].map((m) => ({
    numero: v("NumSerieFactura", m[1]), estado: v("EstadoRegistro", m[1]), codigo: v("CodigoErrorRegistro", m[1]), error: v("DescripcionErrorRegistro", m[1]),
  }));
  const estado = v("EstadoEnvio"); // Correcto | ParcialmenteCorrecto | Incorrecto
  return { ok: estado === "Correcto" || (estado === "ParcialmenteCorrecto" && lineas.some((l) => l.estado !== "Incorrecto")), estado, csv: v("CSV"), espera: v("TiempoEsperaEnvio"), lineas, error: lineas.find((l) => l.error)?.error || "" };
}

// ---- Firmador local (programa en el ordenador de la usuaria) ----
export const FIRMADOR = "http://localhost:8771";
export async function firmadorEstado() {
  try { const r = await fetch(FIRMADOR + "/estado", { signal: AbortSignal.timeout(2500) }); return r.ok ? await r.json() : null; } catch { return null; }
}
export async function firmadorCertificados() {
  const r = await fetch(FIRMADOR + "/certificados", { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error("El firmador no ha podido leer los certificados.");
  return r.json();
}
export async function enviarAEAT({ entorno, certificado, soap }) {
  const r = await fetch(FIRMADOR + "/enviar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entorno, certificado, soap }), signal: AbortSignal.timeout(90000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `El firmador respondió ${r.status}`);
  return { http: j.status, texto: j.body, respuesta: leerRespuesta(j.body) };
}
