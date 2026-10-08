// Genera un Word (.docx) sencillo a partir de bloques {t:'title'|'h'|'p'|'sig', text, lead, a, b}
import JSZip from "jszip";

const x = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const run = (t, bold) =>
  '<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>' + (bold ? "<w:b/>" : "") +
  '<w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">' + x(t) + "</w:t></w:r>";
const para = (runs, jc = "both") =>
  '<w:p><w:pPr><w:spacing w:after="160" w:line="300" w:lineRule="auto"/><w:jc w:val="' + jc + '"/></w:pPr>' + runs + "</w:p>";

export async function bloquesADocx(bloques) {
  const body = [];
  bloques.forEach((b) => {
    if (b.t === "title" || b.t === "h") body.push(para(run(b.text, true), "center"));
    else if (b.t === "sig") {
      body.push(para(""));
      [b.a, b.b].forEach((s) => {
        body.push(para(""));
        s.split("\n").forEach((l, i) => body.push(para(run(l, i === 0), "left")));
      });
    } else body.push(para((b.lead ? run(b.lead + " ", true) : "") + run(b.text)));
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
    .map((b) => {
      if (b.t === "sig") return "\n\n" + b.a + "\n\n\n" + b.b;
      if (b.t === "h" || b.t === "title") return "\n" + b.text + "\n";
      return (b.lead ? b.lead + " " : "") + b.text;
    })
    .join("\n\n")
    .trim();
}
