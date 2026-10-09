// Papelería corporativa: 4 estilos (clásico, moderno, minimalista, ejecutivo) para la hoja corporativa (carta),
// el informe y la factura. Usan el logo, el color y los datos legales de la empresa (Ajustes › Empresa).
// La hoja y el informe salen en Word (.docx con cabecera y pie); la factura en PDF.
import JSZip from "jszip";

export const ESTILOS = {
  clasico: { nombre: "Clásico", desc: "Serif, centrado y sobrio. Para despachos y empresas tradicionales.", tit: "Georgia", txt: "Georgia" },
  moderno: { nombre: "Moderno", desc: "Sans serif, logo a la izquierda y franja de color. Limpio y actual.", tit: "Calibri", txt: "Calibri" },
  minimal: { nombre: "Minimalista", desc: "Mucho blanco, letra pequeña espaciada. Elegante y discreto.", tit: "Arial", txt: "Arial" },
  ejecutivo: { nombre: "Ejecutivo", desc: "Cabecera de color con el nombre en blanco. Con presencia.", tit: "Garamond", txt: "Garamond" },
};

const hex = (c) => String(c || "#7A1F2B").replace("#", "").toUpperCase().padEnd(6, "0").slice(0, 6);
const x = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Fuentes del estilo, cambiadas por las de la marca si la empresa las ha elegido
const conMarca = (estilo, marca = {}) => ({ ...ESTILOS[estilo], ...(marca.fuenteTit ? { tit: marca.fuenteTit } : {}), ...(marca.fuenteTxt ? { txt: marca.fuenteTxt } : {}) });

export function textoLegal(e = {}) {
  const dom = [e.domicilio, [e.cp, e.municipio].filter(Boolean).join(" "), e.provincia && e.provincia !== e.municipio ? `(${e.provincia})` : ""].filter(Boolean).join(", ");
  const reg = e.registro ? `Inscrita en el Registro Mercantil de ${e.registro}${e.tomo ? `, tomo ${e.tomo}` : ""}${e.folio ? `, folio ${e.folio}` : ""}${e.hoja ? `, hoja ${e.hoja}` : ""}${e.inscripcion ? `, inscripción ${e.inscripcion}` : ""}` : "";
  return { linea1: [e.razon_social, e.cif && `CIF ${e.cif}`, dom].filter(Boolean).join(" · "), linea2: [reg, e.email, e.telefono, e.web].filter(Boolean).join(" · ") };
}

// ---------- Word ----------
const r = (t, o = {}) => `<w:r><w:rPr><w:rFonts w:ascii="${o.f}" w:hAnsi="${o.f}"/>${o.b ? "<w:b/>" : ""}${o.i ? "<w:i/>" : ""}${o.caps ? "<w:caps/>" : ""}${o.sp ? `<w:spacing w:val="${o.sp}"/>` : ""}${o.c ? `<w:color w:val="${o.c}"/>` : ""}<w:sz w:val="${o.sz || 22}"/></w:rPr><w:t xml:space="preserve">${x(t)}</w:t></w:r>`;
const p = (runs, o = {}) => `<w:p><w:pPr>${o.shd ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.shd}"/>` : ""}${o.bb ? `<w:pBdr><w:bottom w:val="single" w:sz="${o.bbsz || 6}" w:space="6" w:color="${o.bb}"/></w:pBdr>` : ""}${o.bt ? `<w:pBdr><w:top w:val="single" w:sz="${o.btsz || 6}" w:space="6" w:color="${o.bt}"/></w:pBdr>` : ""}<w:spacing w:before="${o.antes || 0}" w:after="${o.despues ?? 120}" w:line="${o.line || 276}" w:lineRule="auto"/><w:jc w:val="${o.jc || "left"}"/>${o.ind ? `<w:ind w:left="${o.ind}" w:right="${o.ind}"/>` : ""}</w:pPr>${runs}</w:p>`;
const img = (emu) => `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${emu.w}" cy="${emu.h}"/><wp:docPr id="1" name="Logo"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1" name="logo.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${emu.w}" cy="${emu.h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';

async function medidasLogo(dataUrl, altoMm) {
  const im = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = dataUrl; });
  const h = altoMm * 36000, w = Math.round(h * (im.width / im.height));
  return { w: Math.min(w, 60 * 36000), h: Math.round(Math.min(w, 60 * 36000) / (im.width / im.height)) };
}

function cabeceraPie(estilo, empresa, color, conLogo, emu, marca = {}) {
  const s = conMarca(estilo, marca), gris = marca.color2 ? hex(marca.color2) : null, c = hex(color), L = textoLegal(empresa), nombre = empresa.razon_social || "Nombre de la empresa";
  const logo = conLogo ? img(emu) : "";
  let cab, pie;
  if (estilo === "clasico") {
    cab = (conLogo ? p(logo, { jc: "center", despues: 60 }) : "") + p(r(nombre, { f: s.tit, sz: 30, b: true, c }), { jc: "center", bb: c, despues: 0 });
    pie = p(r(L.linea1, { f: s.txt, sz: 15, c: "666666" }), { jc: "center", despues: 0 }) + p(r(L.linea2, { f: s.txt, sz: 14, c: gris || "888888", i: true }), { jc: "center", despues: 0 });
  } else if (estilo === "moderno") {
    cab = `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:bottom w:val="single" w:sz="18" w:color="${c}"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="4500"/><w:gridCol w:w="4500"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="2500" w:type="pct"/><w:vAlign w:val="center"/></w:tcPr>${conLogo ? p(logo, { despues: 80 }) : p(r(nombre, { f: s.tit, sz: 28, b: true, c }), { despues: 80 })}</w:tc><w:tc><w:tcPr><w:tcW w:w="2500" w:type="pct"/><w:vAlign w:val="center"/></w:tcPr>${p(r(nombre, { f: s.tit, sz: 20, b: true, c: "333333" }), { jc: "right", despues: 0 })}${p(r([empresa.web, empresa.email].filter(Boolean).join("  ·  "), { f: s.txt, sz: 16, c: "777777" }), { jc: "right", despues: 80 })}</w:tc></w:tr></w:tbl>`;
    pie = p(r(L.linea1, { f: s.txt, sz: 15, c: "555555" }), { bt: c, btsz: 12, despues: 0 }) + p(r(L.linea2, { f: s.txt, sz: 14, c: gris || "888888" }), { despues: 0 });
  } else if (estilo === "minimal") {
    cab = (conLogo ? p(logo, { jc: "right", despues: 40 }) : "") + p(r(nombre, { f: s.tit, sz: 16, caps: true, sp: 60, c: "333333" }), { jc: "right", despues: 0 });
    pie = p(r([L.linea1, L.linea2].filter(Boolean).join(" · "), { f: s.txt, sz: 13, c: gris || "9A9A9A" }), { jc: "left", despues: 0 });
  } else {
    cab = p((conLogo ? logo + r("   ", { f: s.tit }) : "") + r(nombre, { f: s.tit, sz: 32, b: true, c: "FFFFFF" }), { shd: c, despues: 0, antes: 0, ind: 0, line: 360 }) + p(r(" ", { f: s.txt, sz: 8 }), { despues: 0 });
    pie = p(r(L.linea1, { f: s.txt, sz: 15, c: "FFFFFF" }), { shd: c, jc: "center", despues: 0 }) + p(r(L.linea2, { f: s.txt, sz: 14, c: gris || "555555" }), { jc: "center", despues: 0 });
  }
  return {
    header: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${NS}>${cab}</w:hdr>`,
    footer: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${NS}>${pie}</w:ftr>`,
  };
}

function cuerpo(tipo, estilo, empresa, color, marca = {}) {
  const s = conMarca(estilo, marca), c = hex(color), T = (t, o = {}) => r(t, { f: s.txt, sz: 22, ...o });
  const hoy = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  if (tipo === "carta") return [
    p(T(`${empresa.municipio || "Madrid"}, ${hoy}`), { jc: "right", antes: 240, despues: 360 }),
    p(T("[Nombre del destinatario]", { b: true }), { despues: 0 }), p(T("[Cargo · Empresa]"), { despues: 0 }), p(T("[Dirección]"), { despues: 360 }),
    p(T("Asunto: ", { b: true }) + T("[asunto de la carta]"), { despues: 240 }),
    p(T("Estimado/a [nombre]:"), { despues: 200 }),
    p(T("[Escriba aquí el texto de la carta.]"), { jc: "both", despues: 200 }),
    p(T("Atentamente,"), { antes: 240, despues: 720 }),
    p(T("[Nombre y apellidos]", { b: true }), { despues: 0 }), p(T(`[Cargo] · ${empresa.razon_social || ""}`), { despues: 0 }),
  ].join("");
  // Informe: portada + índice de apartados de ejemplo
  const H = (t) => p(r(t, { f: s.tit, sz: 28, b: true, c }), { antes: 360, despues: 160, ...(estilo === "clasico" ? { bb: c, bbsz: 4 } : {}) });
  return [
    p(T(" "), { antes: 2400 }),
    p(r("INFORME", { f: s.tit, sz: 20, caps: true, sp: 80, c }), { jc: estilo === "moderno" ? "left" : "center", despues: 120 }),
    p(r("[Título del informe]", { f: s.tit, sz: 52, b: true, c: estilo === "ejecutivo" ? c : "222222" }), { jc: estilo === "moderno" ? "left" : "center", despues: 200 }),
    p(T("[Subtítulo o asunto]", { c: "666666", sz: 26 }), { jc: estilo === "moderno" ? "left" : "center", despues: 1200 }),
    p(T(`Preparado por: ${empresa.razon_social || "[empresa]"}`), { jc: estilo === "moderno" ? "left" : "center", despues: 0 }),
    p(T(`Fecha: ${hoy}`), { jc: estilo === "moderno" ? "left" : "center", despues: 0 }),
    p(T("Confidencial", { i: true, c: "888888" }), { jc: estilo === "moderno" ? "left" : "center", despues: 0 }),
    '<w:p><w:r><w:br w:type="page"/></w:r></w:p>',
    H("1. Resumen ejecutivo"), p(T("[Conclusiones principales en pocas líneas.]"), { jc: "both" }),
    H("2. Antecedentes"), p(T("[Contexto y objeto del informe.]"), { jc: "both" }),
    H("3. Análisis"), p(T("[Desarrollo, datos y cifras.]"), { jc: "both" }),
    H("4. Conclusiones y recomendaciones"), p(T("[Qué se propone hacer.]"), { jc: "both" }),
  ].join("");
}

export async function docxCorporativo({ tipo, estilo, empresa = {}, color, logo, marca = {} }) {
  const conLogo = /^data:image\/(png|jpe?g)/.test(logo || "");
  const emu = conLogo ? await medidasLogo(logo, estilo === "minimal" ? 9 : estilo === "ejecutivo" ? 10 : 14) : null;
  const { header, footer } = cabeceraPie(estilo, empresa, color, conLogo, emu, marca);
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${cuerpo(tipo, estilo, empresa, color, marca)}<w:sectPr><w:headerReference w:type="default" r:id="rCab"/><w:footerReference w:type="default" r:id="rPie"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="2200" w:right="1418" w:bottom="1700" w:left="1418" w:header="600" w:footer="500" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const z = new JSZip();
  z.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>`);
  z.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  z.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rCab" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rPie" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`);
  z.file("word/document.xml", doc);
  z.file("word/header1.xml", header);
  z.file("word/footer1.xml", footer);
  if (conLogo) {
    const ext = /jpe?g/.test(logo.slice(0, 20)) ? "jpeg" : "png";
    z.file(`word/media/logo.${ext}`, logo.split(",")[1], { base64: true });
    z.file("word/_rels/header1.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.${ext}"/></Relationships>`);
  }
  return z.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

// ---------- Factura en PDF ----------
// factura = { serie, numero, fecha, cliente:{nombre,nif,domicilio}, lineas:[{concepto,cantidad,precio,iva}], retencion_pct, notas, qr (dataURL PNG opcional), leyendaQR }
export async function facturaPDF({ estilo, empresa = {}, color, logo, factura }) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const pg = doc.addPage([595.28, 841.89]);
  const serif = estilo === "clasico" || estilo === "ejecutivo";
  const F = await doc.embedFont(serif ? StandardFonts.TimesRoman : StandardFonts.Helvetica);
  const FB = await doc.embedFont(serif ? StandardFonts.TimesRomanBold : StandardFonts.HelveticaBold);
  const h = hex(color), C = rgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);
  const gris = rgb(0.42, 0.42, 0.42), negro = rgb(0.13, 0.13, 0.13), blanco = rgb(1, 1, 1);
  const W = 595.28, M = 50;
  const t = (s, x0, y, o = {}) => { const f = o.b ? FB : F, sz = o.sz || 9.5; let xx = x0; const txt = String(s ?? ""); if (o.der) xx = x0 - f.widthOfTextAtSize(txt, sz); if (o.centro) xx = x0 - f.widthOfTextAtSize(txt, sz) / 2; pg.drawText(txt, { x: xx, y, size: sz, font: f, color: o.c || negro }); };
  const eur = (v) => (Math.round((+v || 0) * 100) / 100).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  let logoImg = null;
  if (/^data:image\/(png|jpe?g)/.test(logo || "")) { const b = Uint8Array.from(atob(logo.split(",")[1]), (c) => c.charCodeAt(0)); logoImg = /jpe?g/.test(logo.slice(0, 20)) ? await doc.embedJpg(b) : await doc.embedPng(b); }
  const nombre = empresa.razon_social || "Nombre de la empresa", L = textoLegal(empresa);
  let y = 790;
  // Cabecera según estilo
  if (estilo === "ejecutivo") {
    pg.drawRectangle({ x: 0, y: 760, width: W, height: 82, color: C });
    if (logoImg) { const s = 44 / logoImg.height; pg.drawImage(logoImg, { x: M, y: 779, width: logoImg.width * s, height: 44 }); }
    t(nombre, logoImg ? M + logoImg.width * 44 / logoImg.height + 14 : M, 795, { b: true, sz: 17, c: blanco });
    t("FACTURA", W - M, 795, { b: true, sz: 17, c: blanco, der: true }); y = 735;
  } else if (estilo === "moderno") {
    pg.drawRectangle({ x: 0, y: 0, width: 8, height: 841.89, color: C });
    if (logoImg) { const s = 46 / logoImg.height; pg.drawImage(logoImg, { x: M, y: 770, width: logoImg.width * s, height: 46 }); } else t(nombre, M, 790, { b: true, sz: 16, c: C });
    t("FACTURA", W - M, 795, { b: true, sz: 22, c: C, der: true }); y = 745;
  } else if (estilo === "minimal") {
    if (logoImg) { const s = 30 / logoImg.height; pg.drawImage(logoImg, { x: M, y: 785, width: logoImg.width * s, height: 30 }); }
    t(nombre.toUpperCase(), W - M, 800, { sz: 8.5, c: gris, der: true }); t("Factura", M, 750, { sz: 26, c: negro }); y = 725;
  } else {
    if (logoImg) { const s = 46 / logoImg.height; pg.drawImage(logoImg, { x: W / 2 - logoImg.width * s / 2, y: 772, width: logoImg.width * s, height: 46 }); }
    t(nombre, W / 2, logoImg ? 755 : 790, { b: true, sz: 15, c: C, centro: true });
    pg.drawLine({ start: { x: M, y: logoImg ? 745 : 780 }, end: { x: W - M, y: logoImg ? 745 : 780 }, thickness: 0.8, color: C });
    t("FACTURA", W / 2, logoImg ? 725 : 760, { b: true, sz: 13, centro: true }); y = logoImg ? 700 : 735;
  }
  // Emisor y cliente
  const f = factura || {};
  t("EMISOR", M, y, { b: true, sz: 8, c: estilo === "minimal" ? gris : C });
  t("CLIENTE", 320, y, { b: true, sz: 8, c: estilo === "minimal" ? gris : C });
  const emi = [nombre, empresa.cif && `NIF ${empresa.cif}`, empresa.domicilio, [empresa.cp, empresa.municipio].filter(Boolean).join(" "), empresa.email].filter(Boolean);
  const cli = [f.cliente?.nombre || "[Cliente]", f.cliente?.nif && `NIF ${f.cliente.nif}`, f.cliente?.domicilio].filter(Boolean);
  emi.forEach((s, i) => t(s, M, y - 14 - i * 12, { b: i === 0 }));
  cli.forEach((s, i) => t(s, 320, y - 14 - i * 12, { b: i === 0 }));
  y -= 14 + Math.max(emi.length, cli.length) * 12 + 16;
  t(`Nº ${f.serie ? f.serie + "-" : ""}${f.numero || "[número]"}`, M, y, { b: true, sz: 10.5 }); t(`Fecha: ${f.fecha || "[fecha]"}`, 320, y, { sz: 10.5 });
  y -= 24;
  // Tabla de líneas
  const cols = [M, 330, 390, 455, W - M];
  if (estilo === "moderno" || estilo === "ejecutivo") pg.drawRectangle({ x: M - 4, y: y - 5, width: W - 2 * M + 8, height: 18, color: C });
  else pg.drawLine({ start: { x: M, y: y - 5 }, end: { x: W - M, y: y - 5 }, thickness: 0.8, color: estilo === "minimal" ? gris : C });
  const hc = estilo === "moderno" || estilo === "ejecutivo" ? blanco : negro;
  t("Concepto", cols[0], y, { b: true, c: hc }); t("Cant.", cols[2] - 6, y, { b: true, c: hc, der: true }); t("Precio", cols[3] - 6, y, { b: true, c: hc, der: true }); t("IVA", cols[3] + 22, y, { b: true, c: hc, der: true }); t("Importe", cols[4], y, { b: true, c: hc, der: true });
  y -= 20;
  const lineas = f.lineas?.length ? f.lineas : [{ concepto: "[Concepto del servicio]", cantidad: 1, precio: 0, iva: 21 }];
  let base = 0; const ivas = {};
  for (const l of lineas) {
    const imp = (+l.cantidad || 0) * (+l.precio || 0); base += imp; ivas[l.iva ?? 21] = (ivas[l.iva ?? 21] || 0) + imp;
    const palabras = String(l.concepto || "").split(" "); let fila = "", filas = [];
    for (const w of palabras) { if (F.widthOfTextAtSize(fila + " " + w, 9.5) > 270) { filas.push(fila); fila = w; } else fila = (fila + " " + w).trim(); }
    filas.push(fila);
    filas.forEach((s, i) => t(s, cols[0], y - i * 12));
    t(String(l.cantidad ?? 1), cols[2] - 6, y, { der: true }); t(eur(l.precio), cols[3] - 6, y, { der: true }); t(`${l.iva ?? 21}%`, cols[3] + 22, y, { der: true }); t(eur(imp), cols[4], y, { der: true });
    y -= 12 * filas.length + 8;
  }
  pg.drawLine({ start: { x: 320, y: y + 2 }, end: { x: W - M, y: y + 2 }, thickness: 0.5, color: gris });
  y -= 14;
  const cuotas = Object.entries(ivas).map(([p, b]) => [p, b, Math.round(b * +p) / 100]);
  const ret = Math.round(base * (+f.retencion_pct || 0)) / 100;
  const total = base + cuotas.reduce((s, c) => s + c[2], 0) - ret;
  t("Base imponible", 455, y, { der: true }); t(eur(base), W - M, y, { der: true }); y -= 14;
  cuotas.forEach(([p, b, c]) => { t(`IVA ${p}% s/ ${eur(b)}`, 455, y, { der: true }); t(eur(c), W - M, y, { der: true }); y -= 14; });
  if (ret) { t(`Retención IRPF ${f.retencion_pct}%`, 455, y, { der: true }); t("-" + eur(ret), W - M, y, { der: true }); y -= 14; }
  y -= 4;
  if (estilo !== "minimal") pg.drawRectangle({ x: 330, y: y - 6, width: W - M - 330 + 4, height: 20, color: estilo === "clasico" ? rgb(0.96, 0.96, 0.96) : C });
  t("TOTAL", 340, y, { b: true, sz: 11, c: estilo === "moderno" || estilo === "ejecutivo" ? blanco : negro }); t(eur(total), W - M, y, { b: true, sz: 11, c: estilo === "moderno" || estilo === "ejecutivo" ? blanco : negro, der: true });
  y -= 36;
  if (f.notas) { t("Observaciones", M, y, { b: true, sz: 8.5, c: gris }); String(f.notas).split("\n").forEach((s, i) => t(s, M, y - 12 - i * 11, { sz: 8.5 })); }
  if (empresa.iban) t(`Forma de pago: transferencia a ${empresa.iban.replace(/(.{4})/g, "$1 ").trim()}`, M, 120, { sz: 8.5 });
  // QR VeriFactu (si lo hay), arriba a la derecha bajo la cabecera, con su leyenda
  if (f.qr) {
    const q = await doc.embedPng(Uint8Array.from(atob(f.qr.split(",")[1]), (c) => c.charCodeAt(0)));
    pg.drawImage(q, { x: W - M - 70, y: 132, width: 70, height: 70 });
    if (f.leyendaQR) t(f.leyendaQR, W - M - 35, 122, { sz: 7, centro: true, c: gris });
  }
  // Pie legal
  if (estilo === "ejecutivo") pg.drawRectangle({ x: 0, y: 0, width: W, height: 44, color: C });
  else if (estilo !== "minimal") pg.drawLine({ start: { x: M, y: 50 }, end: { x: W - M, y: 50 }, thickness: 0.5, color: estilo === "moderno" ? C : gris });
  const pc = estilo === "ejecutivo" ? blanco : gris;
  const centrado = estilo === "clasico" || estilo === "ejecutivo";
  [L.linea1, L.linea2].filter(Boolean).forEach((s, i) => t(s.length > 150 ? s.slice(0, 147) + "…" : s, centrado ? W / 2 : M, 30 - i * 10, { sz: 7, c: pc, centro: centrado }));
  return doc.save();
}
