// Libro de facturas numerado y un único PDF con todas las facturas en ese orden, cada una sellada con su número del libro.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { fechaOrden, eur } from "./datos.js";

const normal = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7E€]/g, " ").replace(/€/g, "EUR");

export function numerarLibro(facturas, ter = "proveedor") {
  return facturas.filter((f) => !f._duplicadoDe && !f.noFactura && f.total)
    .sort((a, b) => fechaOrden(a.fecha).localeCompare(fechaOrden(b.fecha)) || String(a.numero || "").localeCompare(String(b.numero || "")))
    .map((f, i) => ({ ...f, _n: i + 1, _ter: f[ter] || "" }));
}

export function libroCSV(libro, emitidas = false) {
  const cab = ["Nº libro", "Fecha", "Número", emitidas ? "Cliente" : "Proveedor", "NIF", "Base", "% IVA", "IVA", "% Ret.", "Retención", "Total", "Cuenta", emitidas ? "Cobrada" : "Pagada", "Archivo"];
  const n = (x) => (x == null || x === "" ? "" : String(Math.round(Number(x) * 100) / 100).replace(".", ","));
  const filas = libro.map((f) => [f._n, f.fecha, f.numero, f._ter, f[emitidas ? "nif_cliente" : "nif_proveedor"] || "", n(f.base), n(f.iva_pct), n(f.iva_importe), n(f.retencion_pct), n(f.retencion_importe), n(f.total), f.cuenta_pgc || "", (emitidas ? f._cobro : f._pago) ? "Sí" : "No", f.archivo]);
  return "﻿" + [cab, ...filas].map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
}

export async function libroPDF(libro, { titulo, empresa, emitidas = false, onPaso } = {}) {
  const pdf = await PDFDocument.create();
  const fN = await pdf.embedFont(StandardFonts.Helvetica), fB = await pdf.embedFont(StandardFonts.HelveticaBold);
  // 1) Portada con el libro
  const cols = [[28, "N"], [52, "Fecha"], [108, "Numero"], [185, emitidas ? "Cliente" : "Proveedor"], [380, "Base"], [440, "IVA"], [490, "Ret."], [540, "Total"]];
  let pg = pdf.addPage([595, 842]), y = 800;
  const cab = () => { pg.drawText(normal(`${titulo}`), { x: 28, y, size: 14, font: fB }); y -= 16; pg.drawText(normal(empresa || ""), { x: 28, y, size: 9, font: fN, color: rgb(0.35, 0.35, 0.35) }); y -= 22; cols.forEach(([x, t]) => pg.drawText(t, { x, y, size: 8, font: fB })); y -= 4; pg.drawLine({ start: { x: 28, y }, end: { x: 567, y }, thickness: 0.5 }); y -= 12; };
  cab();
  const der = (t, x, yy) => pg.drawText(t, { x: x + 40 - fN.widthOfTextAtSize(t, 8), y: yy, size: 8, font: fN });
  let tb = 0, ti = 0, tr = 0, tt = 0;
  for (const f of libro) {
    if (y < 40) { pg = pdf.addPage([595, 842]); y = 800; cab(); }
    pg.drawText(String(f._n), { x: 28, y, size: 8, font: fN });
    pg.drawText(normal(f.fecha), { x: 52, y, size: 8, font: fN });
    pg.drawText(normal(f.numero).slice(0, 16), { x: 108, y, size: 8, font: fN });
    pg.drawText(normal(f._ter).slice(0, 38), { x: 185, y, size: 8, font: fN });
    der(eur(f.base).replace("€", "").trim(), 360, y); der(eur(f.iva_importe).replace("€", "").trim(), 420, y); der(f.retencion_importe ? eur(f.retencion_importe).replace("€", "").trim() : "", 470, y); der(eur(f.total).replace("€", "").trim(), 527, y);
    tb += f.base || 0; ti += f.iva_importe || 0; tr += f.retencion_importe || 0; tt += f.total || 0;
    y -= 13;
  }
  pg.drawLine({ start: { x: 28, y: y + 8 }, end: { x: 567, y: y + 8 }, thickness: 0.5 });
  pg.drawText("Totales", { x: 185, y: y - 4, size: 8, font: fB });
  [[tb, 360], [ti, 420], [tr, 470], [tt, 527]].forEach(([v, x]) => der(eur(v).replace("€", "").trim(), x, y - 4));
  // 2) Cada factura, sellada con su número del libro
  const avisos = [];
  for (const f of libro) {
    onPaso?.(`Añadiendo la factura ${f._n} de ${libro.length}…`);
    const sello = normal(`Libro n. ${f._n} - ${f.fecha} - ${f._ter}`).slice(0, 90);
    try {
      const file = await f._arch.h.getFile(), bytes = new Uint8Array(await file.arrayBuffer());
      let paginas = [];
      if (/\.pdf$/i.test(f.archivo)) { const src = await PDFDocument.load(bytes, { ignoreEncryption: true }); paginas = await pdf.copyPages(src, src.getPageIndices()); paginas.forEach((p) => pdf.addPage(p)); }
      else { const img = /\.png$/i.test(f.archivo) ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes); const p = pdf.addPage([595, 842]); const e = Math.min(555 / img.width, 780 / img.height); p.drawImage(img, { x: 20, y: 820 - img.height * e, width: img.width * e, height: img.height * e }); paginas = [p]; }
      paginas.forEach((p, i) => {
        const { width, height } = p.getSize(), t = i ? `${sello} (pag. ${i + 1})` : sello, w = fB.widthOfTextAtSize(t, 9);
        p.drawRectangle({ x: width - w - 22, y: height - 24, width: w + 12, height: 16, color: rgb(1, 1, 0.85), borderColor: rgb(0.6, 0.5, 0), borderWidth: 0.6 });
        p.drawText(t, { x: width - w - 16, y: height - 19, size: 9, font: fB, color: rgb(0.3, 0.2, 0) });
      });
    } catch (e) { avisos.push(`${f._n} ${f.archivo}: ${e.message || e}`); const p = pdf.addPage([595, 842]); p.drawText(normal(`${sello}: no se ha podido incluir el documento (${f.archivo})`), { x: 28, y: 800, size: 10, font: fB }); }
  }
  return { bytes: await pdf.save(), avisos };
}
