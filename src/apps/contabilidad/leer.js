// Lectura de facturas en el navegador: texto del PDF con pdf.js y extracción con la IA del ordenador.
// Si la IA local no está encendida, se usa una lectura básica por patrones y la usuaria revisa.
import * as pdfjs from "pdfjs-dist";
import worker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { preguntarIA } from "../../ia-navegador.js";
import { num, asignarCuenta } from "./datos.js";

pdfjs.GlobalWorkerOptions.workerSrc = worker;

// Registro de textos ya leídos («programa/textos_documentos.json»): la huella (SHA-256) del archivo → su texto.
// Así un documento ya leído (aunque se renombre o se mueva) no se vuelve a leer ni a pasar por el OCR.
let _raizTextos = null, _textos = null, _pendiente = null;
export function usarRegistroTextos(raiz) { _raizTextos = raiz; _textos = null; }
async function registro() {
  if (_textos || !_raizTextos) return _textos || {};
  const { leerJSON } = await import("./datos.js");
  _textos = await leerJSON(_raizTextos, "textos_documentos.json", {});
  return _textos;
}
function guardarRegistro() {
  if (!_raizTextos || !_textos) return;
  clearTimeout(_pendiente);
  _pendiente = setTimeout(async () => { const { escribirJSON } = await import("./datos.js"); await escribirJSON(_raizTextos, "textos_documentos.json", _textos); }, 1500);
}
export async function huellaArchivo(file) {
  const h = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Texto del PDF. Si es un escaneado (sin texto), se lee con OCR en tu ordenador (Tesseract, en español):
// la imagen no sale del navegador; los archivos del OCR se sirven desde la propia app.
export async function textoPDF(file, maxPaginas = 4, opciones = {}) {
  let h = null;
  try { const reg = await registro(); h = await huellaArchivo(file); if (reg[h]?.texto) return reg[h].texto; } catch { /* sin registro */ }
  const t = await textoPDFsinRegistro(file, maxPaginas, opciones);
  try { if (h && t && t.replace(/\s/g, "").length > 20) { const reg = await registro(); reg[h] = { nombre: file.name || "", texto: t.slice(0, 20000), leido: new Date().toISOString().slice(0, 10) }; guardarRegistro(); } } catch { /* nada */ }
  return t;
}
async function textoPDFsinRegistro(file, maxPaginas = 4, { ocr = true, onPaso } = {}) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  let t = "";
  for (let i = 1; i <= Math.min(doc.numPages, maxPaginas); i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    t += c.items.map((x) => x.str + (x.hasEOL ? "\n" : " ")).join("") + "\n";
  }
  t = t.replace(/[ \t]+/g, " ").trim();
  if (t.replace(/\s/g, "").length >= 40 || !ocr) return t;
  onPaso?.("Escaneado: leyendo con OCR…");
  return (await ocrPDF(doc, Math.min(doc.numPages, 2))).replace(/[ \t]+/g, " ").trim();
}

let _ocr = null;
async function trabajadorOCR() {
  if (!_ocr) _ocr = (async () => {
    const { createWorker } = await import("tesseract.js");
    return createWorker("spa", 1, { workerPath: "/ocr/worker.min.js", corePath: "/ocr/", langPath: "/ocr", gzip: true, workerBlobURL: false });
  })();
  return _ocr;
}
async function ocrPDF(doc, paginas) {
  const w = await trabajadorOCR();
  let t = "";
  for (let i = 1; i <= paginas; i++) {
    const pg = await doc.getPage(i);
    const vp = pg.getViewport({ scale: 2.2 });
    const cv = document.createElement("canvas"); cv.width = vp.width; cv.height = vp.height;
    await pg.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise;
    const r = await w.recognize(cv);
    t += r.data.text + "\n";
  }
  return t;
}
// OCR de una imagen (jpg/png) suelta
export async function textoImagen(file) {
  let h = null;
  try { const reg = await registro(); h = await huellaArchivo(file); if (reg[h]?.texto) return reg[h].texto; } catch { /* sin registro */ }
  const w = await trabajadorOCR(); const t = (await w.recognize(file)).data.text;
  try { if (h && t) { const reg = await registro(); reg[h] = { nombre: file.name || "", texto: t.slice(0, 20000), leido: new Date().toISOString().slice(0, 10) }; guardarRegistro(); } } catch { /* nada */ }
  return t;
}

const PROMPT = `Eres un extractor de facturas españolas. Lee el texto de la factura y responde SOLO con un JSON con esta estructura exacta:
{"numero":"","fecha":"dd/mm/aaaa","proveedor":"","nif_proveedor":"","iban_proveedor":"","cliente":"","nif_cliente":"","base":0.0,"iva_pct":0.0,"iva_importe":0.0,"retencion_pct":0.0,"retencion_importe":0.0,"gastos_suplidos":0.0,"total":0.0,"moneda":"EUR","isp":false,"concepto":""}
Reglas: el proveedor es quien EMITE la factura (si no pone su nombre, deja proveedor vacío pero copia su IBAN de cobro en iban_proveedor); el texto puede venir de un OCR con errores; gastos_suplidos = importes «no sujetos» o suplidos que suman al total sin IVA; isp = true si la factura es de un proveedor extranjero sin IVA español o dice «reverse charge» / «inversión del sujeto pasivo»; moneda = la de la factura (EUR, USD…); importes como número con punto decimal; si no aparece un dato, déjalo vacío o a 0. No inventes nada.

TEXTO:
`;

function jsonDe(texto) {
  const m = String(texto || "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

// Lectura básica por patrones (sin IA)
export function lecturaBasica(t) {
  const imp = (re) => { const m = t.match(re); return m ? num(m[1]) : 0; };
  const nifs = [...t.matchAll(/\b([A-HJNP-SUVW]\d{7}[0-9A-J]|\d{8}[A-Z]|[XYZ]\d{7}[A-Z])\b/g)].map((m) => m[1]);
  const fecha = (t.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/) || [])[1] || "";
  const total = imp(/total(?:\s+factura|\s+a\s+pagar)?\s*:?\s*([\d.]+,\d{2})/i) || imp(/([\d.]+,\d{2})\s*€?\s*$/m);
  const base = imp(/base\s+imponible\s*:?\s*([\d.]+,\d{2})/i);
  const iva = imp(/(?:cuota\s+)?i\.?v\.?a\.?[^\d\n]{0,20}([\d.]+,\d{2})/i);
  return { numero: (t.match(/factura\s*(?:n[ºo°.]*|número)?\s*:?\s*([A-Z0-9][\w/-]{2,})/i) || [])[1] || "", fecha, nif_proveedor: nifs[0] || "", base, iva_importe: iva, total };
}

// Plantillas fijas (sin IA): facturas en inglés tipo Stripe (Anthropic, Base44/Wix, OpenAI, Hostinger…) y recibos
const MESES_EN = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
export function plantilla(t) {
  if (!/Invoice number|Receipt number/i.test(t) || !/Date (of issue|paid)/i.test(t)) return null;
  const fm = t.match(/Date (?:of issue|paid)\s+([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/i);
  const fecha = fm ? `${fm[2].padStart(2, "0")}/${String(MESES_EN[fm[1].toLowerCase()] || 1).padStart(2, "0")}/${fm[3]}` : "";
  const numero = ((t.match(/Invoice number[:\s]+([^\n]+)/i) || [])[1] || "").replace(/[^A-Za-z0-9]/g, "");
  const tot = t.match(/\bTotal\s+([€$£])\s?([\d,]+\.\d{2})/i);
  const total = tot ? num(tot[2].replace(/,/g, "").replace(".", ",")) : 0;
  const prov = ((t.match(/^(.+?)(?:\s+@\w+)?\s+Bill to/m) || [])[1] || "").replace(/\s*-\s*\d+$/, "").trim();
  const recibo = /^\s*Receipt\b/i.test(t) || /Receipt number/i.test(t);
  const isp = /reverse charge/i.test(t) || !/\bIVA\b|\bVAT\s+\d+\s*%/i.test(t); // proveedor extranjero sin IVA español
  return { numero, fecha, proveedor: prov, nif_proveedor: ((t.match(/EU VAT\W*([A-Z]{2}[A-Z0-9]{6,})/i) || [])[1] || ""), base: total, iva_pct: 0, iva_importe: 0, retencion_pct: 0, retencion_importe: 0, total, moneda: tot && tot[1] !== "€" ? (tot[1] === "$" ? "USD" : "GBP") : "EUR", isp, noFactura: recibo, notaNoFactura: recibo ? `Recibo de pago de la factura ${numero}` : undefined, cuenta_pgc: "629", concepto: "" };
}

// propia = { nombre, cif } de la empresa que usa la app; emitida = la factura la ha hecho ella
export async function leerFactura(file, { propia, emitida = false } = {}) {
  let texto = "";
  try { texto = /\.(jpe?g|png)$/i.test(file.name || "") ? await textoImagen(file) : await textoPDF(file); } catch { texto = ""; }
  if (texto.replace(/\s/g, "").length < 30) return { datos: null, motivo: "No se ha podido leer ni con OCR. Rellena los datos a mano." };
  const fija = !emitida && plantilla(texto);
  if (fija && fija.proveedor && (fija.total || fija.noFactura)) { fija.analizado_ia = false; fija.metodo = "plantilla"; return { datos: fija, motivo: "leída con plantilla (sin IA)" }; }
  if (!emitida && /PRESUPUESTO/i.test(texto.slice(0, 600)) && !/FACTURA\s*(N|n)/.test(texto)) { /* presupuesto: se lee igual pero se avisa */ }
  const quien = propia?.nombre ? `\nIMPORTANTE: nuestra empresa es «${propia.nombre}»${propia.cif ? ` (NIF ${propia.cif})` : ""}. ${emitida ? "Esta factura la EMITE nuestra empresa: proveedor = nuestra empresa; cliente = el otro." : "Esta factura la RECIBE nuestra empresa: cliente = nuestra empresa; proveedor = el otro (quien la emite y cobra)."}\n` : "";
  const r = await preguntarIA(PROMPT.replace("TEXTO:", quien + "TEXTO:") + texto.slice(0, 6000), { maxTokens: 450, json: true });
  let d = r.estado === "ok" ? jsonDe(r.texto) : null;
  const metodo = d ? `IA (${r.ia})` : "lectura básica — revísala";
  if (!d) d = lecturaBasica(texto);
  ["base", "iva_pct", "iva_importe", "retencion_pct", "retencion_importe", "total"].forEach((k) => (d[k] = num(d[k])));
  d.cuenta_pgc = asignarCuenta((d.proveedor || "") + " " + (d.concepto || "") + " " + texto.slice(0, 300));
  d.analizado_ia = metodo.startsWith("IA");
  d.metodo = metodo;
  return { datos: d, motivo: metodo };
}
