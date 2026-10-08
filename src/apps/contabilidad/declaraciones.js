// Lee los justificantes de presentación de la AEAT («CotejoDocIdSv.pdf», PDF del modelo) de la carpeta «impuestos»:
// modelo, ejercicio, periodo, fecha, nº de justificante, resultado y las casillas. Sin IA: el formato es fijo.
import { num } from "./datos.js";

export function leerDeclaracion(t) {
  const modelo = (t.match(/Modelo\s+(\d{3})\b/) || [])[1];
  if (!modelo) return null;
  const per = t.match(/Ejercicio\s+(\d{4})\s+Per[ií]odo\s+([1-4]T|0[1-9]|1[0-2]|0A)/i) || t.match(/\b(20\d{2})\s+([1-4]T)\b/);
  const fp = t.match(/Presentaci[oó]n realizada el:\s*(\d{2})-(\d{2})-(\d{4})/);
  const casillas = {};
  for (const m of t.matchAll(/(?:\.{3,}|\))\s*(\d{2,3})\s+(-?[\d.]+,\d{2})(?:\s+(\d{2,3})\s+(-?[\d.]+,\d{2}))?/g)) { casillas[m[1]] = num(m[2]); if (m[3]) casillas[m[3]] = num(m[4]); }
  const imp = t.match(/IMPORTE:\s*(-?[\d.]+,\d{2})/);
  const res = /A COMPENSAR/i.test(t) ? "compensar" : /A DEVOLVER|DEVOLUCI[OÓ]N/i.test(t) ? "devolver" : /INGRESAR/i.test(t) ? "ingresar" : /NEGATIVA|SIN ACTIVIDAD/i.test(t) ? "cero" : "";
  let importe = imp ? num(imp[1]) : 0;
  if (!importe && modelo === "303") importe = Math.abs(casillas["71"] ?? casillas["69"] ?? casillas["46"] ?? 0);
  return {
    modelo, anio: per ? +per[1] : null, tramo: per ? String(per[2]).replace(/T$/i, "") : null,
    fecha: fp ? `${fp[3]}-${fp[2]}-${fp[1]}` : "", justificante: (t.match(/N[uú]mero de justificante:\s*(\d+)/i) || [])[1] || "",
    resultado: res, importe, casillas,
    ivaRep: modelo === "303" ? casillas["27"] ?? null : null, ivaSop: modelo === "303" ? casillas["45"] ?? casillas["29"] ?? null : null,
    baseSop: modelo === "303" ? casillas["28"] ?? null : null,
  };
}
