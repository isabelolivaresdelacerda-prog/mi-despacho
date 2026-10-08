// Datos legales de la empresa: se usan en la papelería corporativa (facturas, cartas, informes) y en los contratos.
export const EMPRESA_VACIA = {
  razon_social: "", cif: "", domicilio: "", cp: "", municipio: "", provincia: "",
  registro: "", tomo: "", folio: "", hoja: "", inscripcion: "",
  email: "", telefono: "", web: "", iban: "",
};

// Validación de NIF/CIF/NIE español
export function nifValido(v) {
  const s = String(v || "").toUpperCase().replace(/[\s.-]/g, "");
  const L = "TRWAGMYFPDXBNJZSQVHLCKE";
  if (/^\d{8}[A-Z]$/.test(s)) return L[+s.slice(0, 8) % 23] === s[8];
  if (/^[XYZ]\d{7}[A-Z]$/.test(s)) return L[+("XYZ".indexOf(s[0]) + s.slice(1, 8)) % 23] === s[8];
  if (/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(s)) {
    let t = 0; s.slice(1, 8).split("").map(Number).forEach((n, i) => { if (i % 2 === 0) { const x = n * 2; t += Math.floor(x / 10) + (x % 10); } else t += n; });
    const c = (10 - (t % 10)) % 10;
    return s[8] === String(c) || s[8] === "JABCDEFGHI"[c];
  }
  return false;
}

export function ibanValido(v) {
  const s = String(v || "").toUpperCase().replace(/\s/g, "");
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  const r = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, (c) => c.charCodeAt(0) - 55);
  let m = 0; for (const d of r) m = (m * 10 + +d) % 97;
  return m === 1;
}

export const domicilioCompleto = (e) => [e.domicilio, [e.cp, e.municipio].filter(Boolean).join(" "), e.provincia && e.provincia !== e.municipio ? `(${e.provincia})` : ""].filter(Boolean).join(", ");

// Pie mercantil obligatorio (art. 24 del Reglamento del Registro Mercantil)
export function pieMercantil(e) {
  if (!e?.razon_social) return "";
  const ins = e.registro ? [`Inscrita en el Registro Mercantil de ${e.registro}`, e.tomo && `tomo ${e.tomo}`, e.folio && `folio ${e.folio}`, e.hoja && `hoja ${e.hoja}`, e.inscripcion && `inscripción ${e.inscripcion}`].filter(Boolean).join(", ") : "";
  return [e.razon_social, e.cif && `CIF ${e.cif.toUpperCase()}`, domicilioCompleto(e) && `Domicilio social: ${domicilioCompleto(e)}`, ins].filter(Boolean).join(" · ");
}
