// Genera un Word (.docx) sencillo a partir de bloques {t:'title'|'sub'|'h'|'p'|'tabla'|'sig'|'salto', text, lead, a, b, filas}
// 'tabla': filas [[concepto, valor], …] en dos columnas (concepto en negrita); el valor puede llevar "\n".
// Un texto puede llevar varios párrafos separados por "\n" (el título en negrita va solo en el primero).
import JSZip from "jszip";

const x = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const run = (t, bold) =>
  '<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>' + (bold ? "<w:b/>" : "") +
  '<w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">' + x(t) + "</w:t></w:r>";
const para = (runs, jc = "both") =>
  '<w:p><w:pPr><w:spacing w:after="160" w:line="300" w:lineRule="auto"/><w:jc w:val="' + jc + '"/></w:pPr>' + runs + "</w:p>";
const runT = (t, bold) =>
  '<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>' + (bold ? "<w:b/>" : "") +
  '<w:sz w:val="21"/></w:rPr><w:t xml:space="preserve">' + x(t) + "</w:t></w:r>";
const paraT = (runs) => '<w:p><w:pPr><w:spacing w:before="40" w:after="40"/><w:jc w:val="left"/></w:pPr>' + runs + "</w:p>";
const celda = (ancho, contenido) => '<w:tc><w:tcPr><w:tcW w:w="' + ancho + '" w:type="dxa"/></w:tcPr>' + contenido + "</w:tc>";
const borde = (l) => '<w:' + l + ' w:val="single" w:sz="4" w:space="0" w:color="999999"/>';
const tabla = (filas) =>
  '<w:tbl><w:tblPr><w:tblW w:w="8787" w:type="dxa"/><w:tblBorders>' + ["top", "left", "bottom", "right", "insideH", "insideV"].map(borde).join("") +
  '</w:tblBorders><w:tblCellMar><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="2636"/><w:gridCol w:w="6151"/></w:tblGrid>' +
  filas.map(([k, v]) => "<w:tr>" + celda(2636, paraT(runT(k, true))) + celda(6151, String(v).split("\n").map((t) => paraT(runT(t))).join("")) + "</w:tr>").join("") +
  "</w:tbl>" + para("");

export async function bloquesADocx(bloques) {
  const body = [];
  bloques.forEach((b) => {
    if (b.t === "title" || b.t === "h") body.push(para(run(b.text, true), "center"));
    else if (b.t === "sub") body.push(para(run(b.text), "center"));
    else if (b.t === "salto") body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
    else if (b.t === "tabla") body.push(tabla(b.filas || []));
    else if (b.t === "sig") {
      body.push(para(""));
      [b.a, b.b].forEach((s) => {
        body.push(para(""));
        s.split("\n").forEach((l, i) => body.push(para(run(l, i === 0), "left")));
      });
    } else String(b.text).split("\n").forEach((t, i) => { if (i === 0 || t.trim()) body.push(para((i === 0 && b.lead ? run(b.lead + " ", true) : "") + run(t))); });
  });
  const doc =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    body.join("") +
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1701" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>';
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file("_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file("word/document.xml", doc);
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

export function bloquesATexto(bloques) {
  return bloques
    .filter((b) => b.t !== "salto")
    .map((b) => {
      if (b.t === "sig") return "\n\n" + b.a + "\n\n\n" + b.b;
      if (b.t === "tabla") return (b.filas || []).map(([k, v]) => k + ": " + String(v).replace(/\n/g, "; ")).join("\n");
      if (b.t === "h" || b.t === "title" || b.t === "sub") return "\n" + b.text + "\n";
      return (b.lead ? b.lead + " " : "") + String(b.text).split("\n").filter((t, i) => i === 0 || t.trim()).join("\n\n");
    })
    .join("\n\n")
    .trim();
}
