// Generación del PDF del contrato y de la hoja de evidencias de firma (pdf-lib).
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { MODELO, VERSION_CONTRATO, rellenar, banderas } from "./modelo.js";

const A4 = [595.28, 841.89];
const M = 68; // margen
const ANCHO = A4[0] - M * 2;

export async function sha256Hex(bytes) {
  const h = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// Texto del contrato ya rellenado, en bloques (se usa para la vista previa y el PDF)
export function bloquesRellenos(datos) {
  const f = banderas(datos);
  return MODELO
    .filter(b => !b.si || f[b.si])
    .map(b => ({
      ...b,
      texto: b.texto ? rellenar(b.texto, datos) : b.texto,
      items: b.items ? b.items.map(t => rellenar(t, datos)) : b.items,
    }));
}

// Pequeño motor de maquetación: escribe líneas y salta de página cuando hace falta
function crearEscritor(pdf, fonts, pie) {
  let page, y;
  const paginas = [];
  const nueva = () => {
    page = pdf.addPage(A4);
    paginas.push(page);
    y = A4[1] - M;
  };
  nueva();

  const partir = (texto, font, size, ancho) => {
    const palabras = String(texto).split(/\s+/);
    const lineas = [];
    let linea = "";
    for (const p of palabras) {
      const prueba = linea ? linea + " " + p : p;
      if (font.widthOfTextAtSize(prueba, size) > ancho && linea) {
        lineas.push(linea);
        linea = p;
      } else linea = prueba;
    }
    if (linea) lineas.push(linea);
    return lineas;
  };

  const escribir = (texto, { font = fonts.normal, size = 10, centrado = false, sangria = 0, antes = 0, despues = 6, color = rgb(0, 0, 0), vineta = false, interlinea = 1.45 } = {}) => {
    y -= antes;
    const ancho = ANCHO - sangria;
    const lineas = partir(apto(texto), font, size, ancho);
    const alto = size * interlinea;
    lineas.forEach((l, i) => {
      if (y - alto < M + 20) nueva();
      const w = font.widthOfTextAtSize(l, size);
      const x = centrado ? (A4[0] - w) / 2 : M + sangria;
      if (vineta && i === 0) page.drawText("•", { x: M + sangria - 11, y: y - size, size, font, color });
      page.drawText(l, { x, y: y - size, size, font, color });
      y -= alto;
    });
    y -= despues;
  };

  const espacio = h => { if (y - h < M + 20) nueva(); };
  const linea = () => {
    page.drawLine({ start: { x: M, y }, end: { x: A4[0] - M, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    y -= 10;
  };

  const numerar = () => {
    paginas.forEach((p, i) => {
      const t = `${pie} · página ${i + 1} de ${paginas.length}`;
      const w = fonts.normal.widthOfTextAtSize(t, 7.5);
      p.drawText(t, { x: (A4[0] - w) / 2, y: M / 2, size: 7.5, font: fonts.normal, color: rgb(0.5, 0.5, 0.5) });
    });
  };

  return { escribir, espacio, linea, nueva, numerar, get y() { return y; } };
}

async function fuentes(pdf) {
  return {
    normal: await pdf.embedFont(StandardFonts.TimesRoman),
    negrita: await pdf.embedFont(StandardFonts.TimesRomanBold),
    cursiva: await pdf.embedFont(StandardFonts.TimesRomanItalic),
  };
}

// Las fuentes estándar del PDF solo admiten WinAnsi: se cambian los caracteres que no caben
const EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
const apto = (t) => String(t || "").replace(/●/g, "•").replace(/[\t\r]/g, " ")
  .replace(/./gu, (c) => { const n = c.codePointAt(0); return (n >= 32 && n < 127) || (n >= 160 && n <= 255) || EXTRA.includes(c) ? c : "?"; });

// Maquetación con la misma presentación que el Word del sistema de contratos (docx.js):
// Times 12, interlineado 1,25, 8 pt tras cada párrafo, texto justificado y título de cláusula en negrita delante.
const W = { tam: 12, inter: 1.25, tras: 8, izq: 85, der: 71, sup: 71, inf: 71 };
function maquetador(pdf, f, pie) {
  let page, y;
  const paginas = [];
  const ancho = A4[0] - W.izq - W.der;
  const nueva = () => { page = pdf.addPage(A4); paginas.push(page); y = A4[1] - W.sup; };
  nueva();
  const alto = W.tam * W.inter;

  // runs: [{ texto, font }]; jc: "both" | "center" | "left"
  const parrafo = (runs, jc = "both") => {
    const palabras = [];
    runs.forEach((r) => apto(r.texto).split(/ +/).filter(Boolean).forEach((w) => palabras.push({ w, font: r.font })));
    if (!palabras.length) { y -= alto + W.tras; if (y < W.inf + 20) nueva(); return; }
    const espacio = f.normal.widthOfTextAtSize(" ", W.tam);
    const lineas = [];
    let linea = [], usado = 0;
    palabras.forEach((p) => {
      p.ancho = p.font.widthOfTextAtSize(p.w, W.tam);
      const extra = (linea.length ? espacio : 0) + p.ancho;
      if (linea.length && usado + extra > ancho) { lineas.push(linea); linea = [p]; usado = p.ancho; }
      else { linea.push(p); usado += extra; }
    });
    if (linea.length) lineas.push(linea);
    lineas.forEach((l, i) => {
      if (y - alto < W.inf + 20) nueva();
      const total = l.reduce((s, p) => s + p.ancho, 0);
      const ultima = i === lineas.length - 1;
      let hueco = espacio;
      let x = W.izq;
      if (jc === "both" && !ultima && l.length > 1) hueco = (ancho - total) / (l.length - 1);
      if (jc === "center") x = W.izq + (ancho - total - espacio * (l.length - 1)) / 2;
      l.forEach((p) => { page.drawText(p.w, { x, y: y - W.tam, size: W.tam, font: p.font, color: rgb(0, 0, 0) }); x += p.ancho + hueco; });
      y -= alto;
    });
    y -= W.tras;
  };
  const reservar = (h) => { if (y - h < W.inf + 20) nueva(); };
  const numerar = () => {
    paginas.forEach((p, i) => {
      const t = apto(`${pie} · página ${i + 1} de ${paginas.length}`);
      const w = f.normal.widthOfTextAtSize(t, 8);
      p.drawText(t, { x: (A4[0] - w) / 2, y: W.inf / 2, size: 8, font: f.normal, color: rgb(0.5, 0.5, 0.5) });
    });
  };
  return { parrafo, reservar, nueva, numerar };
}

// 1) PDF del contrato (sin firmas). Su huella SHA-256 es lo que se firma.
// `bloques`: el contrato en el formato del sistema (los mismos que el Word y la vista previa, con las cláusulas modificadas).
export async function generarContratoPDF(datos, bloques) {
  const pdf = await PDFDocument.create();
  pdf.setTitle("RGPD - Contrato de encargo del tratamiento de datos personales");
  pdf.setSubject(apto(`${datos.resp?.razon_social || ""} / ${datos.enc?.razon_social || ""}`));
  pdf.setCreator("Mi Despacho");
  pdf.setProducer("Mi Despacho");
  // Fecha fija para que el mismo contenido produzca siempre el mismo PDF (y la misma huella)
  const fija = new Date(datos.fecha_generacion || "2026-01-01T00:00:00Z");
  pdf.setCreationDate(fija);
  pdf.setModificationDate(fija);

  const f = await fuentes(pdf);
  const m = maquetador(pdf, f, `RGPD - Contrato de encargo del tratamiento · modelo v${VERSION_CONTRATO}`);
  const n = (texto) => ({ texto, font: f.normal });
  const b_ = (texto) => ({ texto, font: f.negrita });

  for (const b of bloques) {
    if (b.t === "title" || b.t === "h") m.parrafo([b_(b.text)], "center");
    else if (b.t === "sub") m.parrafo([n(b.text)], "center");
    else if (b.t === "salto") m.nueva();
    else if (b.t === "sig") {
      m.reservar(150);
      m.parrafo([]);
      [b.a, b.b].forEach((s) => { m.parrafo([]); s.split("\n").forEach((l, i) => m.parrafo([i === 0 ? b_(l) : n(l)], "left")); });
      m.parrafo([{ texto: "Firmado electrónicamente. Ver hoja de evidencias anexa.", font: f.cursiva }], "left");
    } else {
      if (b.lead) m.reservar(60);
      String(b.text).split("\n").forEach((t, i) => { if (i === 0 || t.trim()) m.parrafo(i === 0 && b.lead ? [b_(b.lead), n(t)] : [n(t)]); });
    }
  }
  m.numerar();
  const bytes = await pdf.save({ useObjectStreams: false });
  return { bytes, hash: await sha256Hex(bytes) };
}

// 2) PDF final: contrato + hoja de evidencias con todas las firmas registradas
export async function generarPDFFirmado(contratoBytes, hashContrato, datos, firmas) {
  const pdf = await PDFDocument.load(contratoBytes);
  const f = await fuentes(pdf);
  const e = crearEscritor(pdf, f, `Hoja de evidencias · huella del contrato ${hashContrato.slice(0, 16)}…`);
  const gris = rgb(0.35, 0.35, 0.35);

  e.escribir("HOJA DE EVIDENCIAS DE FIRMA ELECTRÓNICA", { font: f.negrita, size: 12, centrado: true, despues: 4 });
  e.escribir("Anexa al contrato de encargo del tratamiento de datos personales", { font: f.cursiva, size: 8.5, centrado: true, despues: 14 });

  const fila = (k, v) => {
    e.escribir(k, { font: f.negrita, size: 8.5, despues: 0, color: gris });
    e.escribir(v, { size: 9.5, despues: 5 });
  };
  fila("Documento", `RGPD - Contrato de encargo del tratamiento — modelo v${VERSION_CONTRATO}`);
  fila("Partes", `${datos.resp.razon_social} (${datos.resp.nif}) — Responsable · ${datos.enc.razon_social} (${datos.enc.nif}) — Encargado`);
  fila("Páginas del contrato", String(pdf.getPageCount() - 1));
  fila("Huella digital del contrato (SHA-256)", hashContrato);
  e.escribir("Cualquier modificación del contrato, por mínima que sea, produce una huella distinta. Para verificarlo, calcule el SHA-256 del contrato original sin esta hoja y compárelo con la huella indicada.", { size: 8, color: gris, despues: 10 });
  e.linea();

  firmas.forEach((s, i) => {
    e.espacio(170);
    e.escribir(`Firma ${i + 1} de 2 — ${s.rol === "resp" ? "Responsable del Tratamiento" : "Encargado del Tratamiento"}`, { font: f.negrita, size: 10, antes: 4, despues: 6 });
    fila("Entidad", `${s.entidad} — NIF ${s.nif}`);
    fila("Firmante", `${s.nombre} — DNI ${s.dni} — ${s.cargo}`);
    fila("Fecha y hora", `${s.fecha_local}  (UTC: ${s.fecha_utc})`);
    fila("Método", s.metodo);
    fila("Declaraciones aceptadas", "Ha leído el contrato íntegro; actúa con representación vigente y facultades suficientes; acepta firmar electrónicamente.");
    fila("Navegador", s.navegador);
    if (s.ip) fila("Dirección IP", s.ip);
    fila("Huella firmada", s.hash_contrato);
    fila("Identificador de la firma", s.id_firma);
    e.linea();
  });

  if (firmas.length < 2) {
    e.escribir("Pendiente de la firma de la otra parte. El contrato no surte efecto hasta que esté firmado por ambas partes.", { font: f.cursiva, size: 9, color: rgb(0.7, 0.35, 0) });
  } else {
    e.escribir("Contrato firmado por ambas partes. Entra en vigor en la fecha de la última firma.", { font: f.negrita, size: 9.5, color: rgb(0.1, 0.45, 0.2) });
  }
  e.numerar();
  // las páginas del contrato ya tienen su pie; numerar() solo afecta a las nuevas de evidencias
  const bytes = await pdf.save({ useObjectStreams: false });
  return { bytes, hash: await sha256Hex(bytes) };
}
