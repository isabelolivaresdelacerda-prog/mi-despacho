// Lectura de facturas en el navegador: texto del PDF con pdf.js y extracción con la IA del ordenador.
// Si la IA local no está encendida, se usa una lectura básica por patrones y la usuaria revisa.
import * as pdfjs from "pdfjs-dist";
import worker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { preguntarIA } from "../../ia-navegador.js";
import { num, asignarCuenta } from "./datos.js";

pdfjs.GlobalWorkerOptions.workerSrc = worker;

// Texto del PDF. Si es un escaneado (sin texto), se lee con OCR en tu ordenador (Tesseract, en español):
// la imagen no sale del navegador; los archivos del OCR se sirven desde la propia app.
export async function textoPDF(file, maxPaginas = 4, { ocr = true, onPaso } = {}) {
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
export async function textoImagen(file) { const w = await trabajadorOCR(); return (await w.recognize(file)).data.text; }

const PROMPT = `Eres un extractor de facturas españolas. Lee el texto de la factura y responde SOLO con un JSON con esta estructura exacta:
{"numero":"","fecha":"dd/mm/aaaa","proveedor":"","nif_proveedor":"","iban_proveedor":"","cliente":"","nif_cliente":"","base":0.0,"iva_pct":0.0,"iva_importe":0.0,"retencion_pct":0.0,"retencion_importe":0.0,"total":0.0,"concepto":""}
Reglas: el proveedor es quien EMITE la factura (si no pone su nombre, deja proveedor vacío pero copia su IBAN de cobro en iban_proveedor); el texto puede venir de un OCR con errores; importes como número con punto decimal; si no aparece un dato, déjalo vacío o a 0. No inventes nada.

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

// propia = { nombre, cif } de la empresa que usa la app; emitida = la factura la ha hecho ella
export async function leerFactura(file, { propia, emitida = false } = {}) {
  let texto = "";
  try { texto = /\.(jpe?g|png)$/i.test(file.name || "") ? await textoImagen(file) : await textoPDF(file); } catch { texto = ""; }
  if (texto.replace(/\s/g, "").length < 30) return { datos: null, motivo: "No se ha podido leer ni con OCR. Rellena los datos a mano." };
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
