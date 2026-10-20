// Ficheros para IMPORTAR en los formularios de la sede de la AEAT (botón «Importar»): modelos 303 y 130.
// Formato oficial «diseño de registro» (texto de posiciones fijas, ISO-8859-1), el mismo que crea el botón «Exportar»
// del formulario. Diseños: 303 ejercicio 2026 (Orden HAC/819/2024 y actualizaciones) y 130 (Orden HAP/258/2015).
// Posiciones tomadas del módulo libre l10n-spain (OCA), que sigue los diseños publicados por la AEAT.
// Después de importar, el formulario de la AEAT vuelve a validar todo: revisar siempre antes de presentar.

// ---- Formato de los campos ----
const sinTildes = (t) => t.replace(/[ÁÀÂÄ]/g, "A").replace(/[ÉÈÊË]/g, "E").replace(/[ÍÌÎÏ]/g, "I").replace(/[ÓÒÔÖ]/g, "O").replace(/[ÚÙÛÜ]/g, "U");
export function alfa(texto, largo) {
  let t = sinTildes(String(texto ?? "").toUpperCase()).replace(/[^A-Z0-9\s.,\-_&'´\\:;/()ÑÇ<>]/g, "");
  return t.slice(0, largo).padEnd(largo, " ");
}
// Números: alineados a la derecha, con ceros, sin coma (2 decimales implícitos); con signo, la primera posición es «N» si es negativo
export function numero(valor, largo, decimales = 0, conSigno = false) {
  const v = Math.round((+valor || 0) * 10 ** decimales);
  const cifras = largo - (conSigno ? 1 : 0);
  const s = String(Math.abs(v)).padStart(cifras, "0").slice(-cifras);
  return (conSigno ? (v < 0 ? "N" : "0") : "") + s;
}
function registro(spec, datos) {
  return spec.map(([t, largo, dec, signo, v, esCampo, si, no]) => {
    const val = esCampo ? (String(v).startsWith("b:") ? v === "b:true" : String(v).startsWith("s:") ? v.slice(2) : datos[v]) : v;
    if (t === "s") return alfa(val, largo);
    if (t === "b") return (val ? si : no).padEnd(largo, " ").slice(0, largo);
    if (t === "i") return val === "" || val == null ? " ".repeat(largo) : numero(val, largo, 0);
    return numero(val ?? 0, largo, dec, !!signo);
  }).join("");
}
// ISO-8859-1: todo es ASCII salvo Ñ y Ç (y ´), que caben en un byte
export function aBytes(texto) { const b = new Uint8Array(texto.length); for (let i = 0; i < texto.length; i++) b[i] = texto.charCodeAt(i) & 0xff; return b; }

// Nombre de persona física: «Apellidos, Nombre» o «Nombre Apellido Apellido»
export function partirNombre(n) {
  const s = String(n || "").trim();
  if (s.includes(",")) { const [ap, no] = s.split(","); return { apellidos: ap.trim(), nombre: no.trim() }; }
  const p = s.split(/\s+/);
  return p.length > 1 ? { nombre: p[0], apellidos: p.slice(1).join(" ") } : { nombre: s, apellidos: s };
}
const cabeceraAUX = (nifDesarrollo) => "<AUX>" + " ".repeat(70) + "MDES" + " ".repeat(4) + alfa(nifDesarrollo, 9) + " ".repeat(213) + "</AUX>";
const limpiaNIF = (n) => String(n || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const limpiaIBAN = (i) => String(i || "").toUpperCase().replace(/\s+/g, "");

// ---- Modelo 303 (2026) ----
const P303_01 = [["s", 2, 0, 0, "<T", 0, "X", " "], ["s", 3, 0, 0, "303", 0, "X", " "], ["s", 5, 0, 0, "01000", 0, "X", " "], ["s", 1, 0, 0, ">", 0, "X", " "], ["s", 1, 0, 0, "", 0, "X", " "], ["s", 1, 0, 0, "tipo", 1, "X", " "], ["s", 9, 0, 0, "nif", 1, "X", " "], ["s", 80, 0, 0, "nombre", 1, "X", " "], ["s", 4, 0, 0, "anio", 1, "X", " "], ["s", 2, 0, 0, "periodo", 1, "X", " "], ["s", 1, 0, 0, "2", 0, "X", " "], ["b", 1, 0, 0, "b:false", 1, "1", "2"], ["s", 1, 0, 0, "3", 0, "X", " "], ["s", 1, 0, 0, "2", 0, "X", " "], ["s", 1, 0, 0, "2", 0, "X", " "], ["s", 1, 0, 0, "2", 0, "X", " "], ["s", 1, 0, 0, "2", 0, "X", " "], ["s", 1, 0, 0, "2", 0, "X", " "], ["s", 1, 0, 0, "2", 0, "X", " "], ["s", 8, 0, 0, "", 0, "X", " "], ["s", 1, 0, 0, "", 0, "X", " "], ["b", 1, 0, 0, "b:false", 1, "1", "2"], ["i", 1, 0, 0, "ex390", 1, "X", " "], ["i", 1, 0, 0, "vol390", 1, "X", " "], ["i", 1, 0, 0, "petrol", 1, "X", ""], ["n", 17, 2, 0, "c150", 1, "X", " "], ["s", 5, 2, 0, "00000", 0, "X", " "], ["n", 17, 2, 0, "c152", 1, "X", " "], ["n", 17, 2, 0, "c165", 1, "X", " "], ["s", 5, 2, 0, "00000", 0, "X", " "], ["n", 17, 2, 0, "c167", 1, "X", " "], ["n", 17, 2, 0, "c1", 1, "X", " "], ["s", 5, 2, 0, "00400", 0, "X", " "], ["n", 17, 2, 0, "c3", 1, "X", " "], ["n", 17, 2, 0, "c153", 1, "X", " "], ["s", 5, 2, 0, "00000", 0, "X", " "], ["n", 17, 2, 0, "c155", 1, "X", " "], ["n", 17, 2, 0, "c4", 1, "X", " "], ["s", 5, 2, 0, "01000", 0, "X", " "], ["n", 17, 2, 0, "c6", 1, "X", " "], ["n", 17, 2, 0, "c7", 1, "X", " "], ["s", 5, 2, 0, "02100", 0, "X", " "], ["n", 17, 2, 0, "c9", 1, "X", " "], ["n", 17, 2, 0, "c10", 1, "X", " "], ["n", 17, 2, 0, "c11", 1, "X", " "], ["n", 17, 2, 0, "c12", 1, "X", " "], ["n", 17, 2, 0, "c13", 1, "X", " "], ["n", 17, 2, 1, "c14", 1, "X", " "], ["n", 17, 2, 1, "c15", 1, "X", " "], ["n", 17, 2, 0, "c156", 1, "X", " "], ["s", 5, 2, 0, "00175", 0, "X", " "], ["n", 17, 2, 0, "c158", 1, "X", " "], ["n", 17, 2, 0, "c168", 1, "X", " "], ["s", 5, 2, 0, "00050", 0, "X", " "], ["n", 17, 2, 0, "c170", 1, "X", " "], ["n", 17, 2, 0, "c16", 1, "X", " "], ["n", 5, 2, 0, "00000", 0, "X", " "], ["n", 17, 2, 0, "c18", 1, "X", " "], ["n", 17, 2, 0, "c19", 1, "X", " "], ["s", 5, 2, 0, "00140", 0, "X", " "], ["n", 17, 2, 0, "c21", 1, "X", " "], ["n", 17, 2, 0, "c22", 1, "X", " "], ["s", 5, 2, 0, "00520", 0, "X", " "], ["n", 17, 2, 0, "c24", 1, "X", " "], ["n", 17, 2, 1, "c25", 1, "X", " "], ["n", 17, 2, 1, "c26", 1, "X", " "], ["n", 17, 2, 1, "c27", 1, "X", " "], ["n", 17, 2, 0, "c28", 1, "X", " "], ["n", 17, 2, 0, "c29", 1, "X", " "], ["n", 17, 2, 0, "c30", 1, "X", " "], ["n", 17, 2, 0, "c31", 1, "X", " "], ["n", 17, 2, 0, "c32", 1, "X", " "], ["n", 17, 2, 0, "c33", 1, "X", " "], ["n", 17, 2, 0, "c34", 1, "X", " "], ["n", 17, 2, 0, "c35", 1, "X", " "], ["n", 17, 2, 0, "c36", 1, "X", " "], ["n", 17, 2, 0, "c37", 1, "X", " "], ["n", 17, 2, 0, "c38", 1, "X", " "], ["n", 17, 2, 0, "c39", 1, "X", " "], ["n", 17, 2, 1, "c40", 1, "X", " "], ["n", 17, 2, 1, "c41", 1, "X", " "], ["n", 17, 2, 1, "c42", 1, "X", " "], ["n", 17, 2, 1, "c43", 1, "X", " "], ["n", 17, 2, 1, "0", 0, "X", " "], ["n", 17, 2, 1, "c45", 1, "X", " "], ["n", 17, 2, 1, "c46", 1, "X", " "], ["s", 521, 0, 0, "", 0, "X", " "], ["s", 13, 0, 0, "", 0, "X", " "], ["s", 12, 0, 0, "</T30301000>", 0, "X", " "]];
const P303_03 = [["s", 2, 0, 0, "<T", 0, "X", " "], ["s", 3, 0, 0, "303", 0, "X", " "], ["s", 5, 0, 0, "03000", 0, "X", " "], ["s", 1, 0, 0, ">", 0, "X", " "], ["n", 17, 2, 1, "c59", 1, "X", " "], ["n", 17, 2, 1, "c60", 1, "X", " "], ["n", 17, 2, 1, "c120", 1, "X", " "], ["n", 17, 2, 1, "c122", 1, "X", " "], ["n", 17, 2, 1, "c123", 1, "X", " "], ["n", 17, 2, 1, "c124", 1, "X", " "], ["n", 17, 2, 1, "c62", 1, "X", " "], ["n", 17, 2, 1, "c63", 1, "X", " "], ["n", 17, 2, 1, "c74", 1, "X", " "], ["n", 17, 2, 1, "c75", 1, "X", " "], ["n", 17, 2, 1, "0", 0, "X", " "], ["n", 17, 2, 1, "c46", 1, "X", " "], ["n", 5, 2, 0, "c65", 1, "X", " "], ["n", 17, 2, 1, "c66", 1, "X", " "], ["n", 17, 2, 0, "c77", 1, "X", " "], ["n", 17, 2, 0, "c110", 1, "X", " "], ["n", 17, 2, 0, "c78", 1, "X", " "], ["n", 17, 2, 0, "c87", 1, "X", " "], ["n", 17, 2, 1, "c68", 1, "X", " "], ["n", 17, 2, 1, "0", 0, "X", " "], ["n", 17, 2, 1, "c69", 1, "X", " "], ["n", 17, 2, 1, "c70", 1, "X", " "], ["n", 17, 2, 1, "0", 0, "X", " "], ["n", 17, 2, 1, "c112", 1, "X", ""], ["n", 17, 2, 1, "c71", 1, "X", " "], ["b", 1, 0, 0, "sinActividad", 1, "X", " "], ["b", 1, 0, 0, "b:false", 1, "X", " "], ["s", 13, 0, 0, "s:", 1, "X", " "], ["b", 1, 0, 0, "b:false", 1, "X", " "], ["n", 17, 2, 1, "0", 0, "X", " "], ["b", 1, 0, 0, "b:false", 1, "X", " "], ["b", 1, 0, 0, "b:false", 1, "X", " "], ["s", 546, 0, 0, "", 0, "X", " "], ["s", 12, 0, 0, "</T30303000>", 0, "X", " "]];

// c: resultado de casillas303() con sus valores sueltos; id: { nif, nombre, anio, tramo, iban }
export function fichero303(c, id) {
  const v = c.valores, periodo = `${id.tramo}T`, cuarto = id.tramo === "4";
  const res = v.c71;
  const iban = limpiaIBAN(id.iban);
  const tipo = res > 0 ? (iban ? "U" : "I") : res < 0 ? (cuarto ? (iban ? "D" : "C") : "C") : "N";
  const nom = partirNombre(id.nombre);
  const datos = {
    ...v, tipo, nif: limpiaNIF(id.nif), nombre: `${nom.apellidos} ${nom.nombre}`.trim(), anio: String(id.anio), periodo,
    ex390: cuarto ? 2 : 0, vol390: 0, petrol: 0, c65: 100, c66: v.c46, c77: 0, c68: 0, c70: 0, c112: 0, sinActividad: tipo === "N",
  };
  const did = "<T303DID00>" + alfa("", 11) + alfa(["U", "D"].includes(tipo) ? iban : "", 34) + alfa("", 70) + alfa("", 35) + alfa("", 30) + alfa("", 2)
    + numero(tipo === "D" ? 1 : 0, 1) + " ".repeat(617) + "</T303DID00>";
  const texto = `<T3030${id.anio}${periodo}0000>` + cabeceraAUX(id.nif) + registro(P303_01, datos) + registro(P303_03, datos) + did + `</T3030${id.anio}${periodo}0000>`;
  return { texto, nombre: `${limpiaNIF(id.nif)}${id.anio}${periodo}.303`, tipo };
}

// ---- Modelo 130 ----
// k: resultado de calculo130(); id: { nif, nombre, anio, tramo, iban }
export function fichero130(k, id) {
  const periodo = `${id.tramo}T`, cuarto = id.tramo === "4", iban = limpiaIBAN(id.iban);
  const c07 = k.resultado, c12 = Math.max(0, c07), c13 = 0, c14 = c12 - c13, c15 = 0, c16 = 0, c17 = c14 - c15 - c16, c18 = 0, c19 = c17 - c18;
  const tipo = c19 > 0 ? (iban ? "U" : "I") : c19 < 0 ? (cuarto ? "N" : "B") : "N";
  const nom = partirNombre(id.nombre);
  const n = (x) => numero(x, 17, 2), ns = (x) => numero(x, 17, 2, true);
  const pagina = "<T13001000>" + " " + tipo + alfa(limpiaNIF(id.nif), 9) + alfa(nom.apellidos, 60) + alfa(nom.nombre, 20) + alfa(id.anio, 4) + alfa(periodo, 2)
    + n(k.ingresos) + n(k.gastos) + ns(k.rendimiento) + n(k.c04) + n(k.anteriores) + n(k.retenciones) + ns(c07)
    + n(0) + n(0) + n(0) + ns(0)
    + n(c12) + ns(c13) + n(c14) + n(c15) + n(c16) + ns(c17) + n(c18) + ns(c19)
    + " " + alfa("", 13) + alfa(tipo === "U" ? iban : "", 34) + " ".repeat(96) + " ".repeat(13) + "</T13001000>";
  const texto = `<T1300${id.anio}${periodo}0000>` + cabeceraAUX(id.nif) + pagina + `</T1300${id.anio}${periodo}0000>`;
  return { texto, nombre: `${limpiaNIF(id.nif)}${id.anio}${periodo}.130`, tipo, c19 };
}

export function descargarFichero({ texto, nombre }) {
  const url = URL.createObjectURL(new Blob([aBytes(texto)], { type: "application/octet-stream" }));
  const a = document.createElement("a"); a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
