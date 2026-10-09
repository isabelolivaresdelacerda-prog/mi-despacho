// Números en letras (español), para importes y plazos de los contratos.
const UNI = ["", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE", "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE", "VEINTE"];
const DEC = ["", "", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
const CEN = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];
const VEINTI = { 2: "DÓS", 3: "TRÉS", 6: "SÉIS" };

// 0 a 999. apocope: "UN" en lugar de "UNO" (un millón, veintiún mil, un euro…)
function hasta999(n, apocope) {
  if (n === 0) return "";
  if (n === 100) return "CIEN";
  let s = "";
  const c = Math.floor(n / 100), r = n % 100;
  if (c > 0) s += CEN[c] + " ";
  if (r > 0) {
    if (r <= 20) s += apocope && r === 1 ? "UN" : UNI[r];
    else {
      const d = Math.floor(r / 10), u = r % 10;
      if (d === 2) s += "VEINTI" + (apocope && u === 1 ? "ÚN" : VEINTI[u] || UNI[u]);
      else { s += DEC[d]; if (u > 0) s += " Y " + (apocope && u === 1 ? "UN" : UNI[u]); }
    }
  }
  return s.trim();
}

// Entero en letras mayúsculas. Ej.: 2500000 → "DOS MILLONES QUINIENTOS MIL"
export function numeroEnLetras(n, apocope = true) {
  n = Math.round(Math.abs(Number(n) || 0));
  if (n === 0) return "CERO";
  const milesMillones = Math.floor(n / 1e9);
  const millones = Math.floor((n % 1e9) / 1e6);
  const miles = Math.floor((n % 1e6) / 1000);
  const resto = n % 1000;
  const partes = [];
  if (milesMillones > 0) partes.push((milesMillones === 1 ? "MIL" : hasta999(milesMillones, true) + " MIL") + (millones === 0 ? " MILLONES" : ""));
  if (millones > 0) partes.push(millones === 1 && milesMillones === 0 ? "UN MILLÓN" : hasta999(millones, true) + " MILLONES");
  if (miles > 0) partes.push(miles === 1 ? "MIL" : hasta999(miles, true) + " MIL");
  if (resto > 0) partes.push(hasta999(resto, apocope));
  return partes.join(" ").trim();
}

// Importe en euros en letras. Ej.: 1000000 → "UN MILLÓN DE EUROS"; 1500,50 → "MIL QUINIENTOS EUROS CON CINCUENTA CÉNTIMOS"
export function eurosEnLetras(v) {
  const total = Math.round(Math.abs(Number(v) || 0) * 100);
  const e = Math.floor(total / 100), c = total % 100;
  let s = numeroEnLetras(e);
  if (e > 0 && e % 1e6 === 0) s += " DE"; // "UN MILLÓN DE EUROS"
  s += e === 1 ? " EURO" : " EUROS";
  if (c > 0) s += " CON " + numeroEnLetras(c) + (c === 1 ? " CÉNTIMO" : " CÉNTIMOS");
  return s;
}

// Número pequeño en minúsculas con la cifra entre paréntesis. Ej.: 15 → "quince (15)"
export const cifraYLetras = (n) => numeroEnLetras(n).toLowerCase() + " (" + Math.round(Number(n)) + ")";
