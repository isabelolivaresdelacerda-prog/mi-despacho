// Descripción guiada del NEGOCIO en el contrato de cuentas en participación.
// El negocio es el elemento esencial del contrato (art. 239 CCom): debe quedar identificado
// con precisión para delimitar en qué resultados participa el partícipe.
// No usa IA: compone el texto a partir de los datos.

export const TIPOS_NEGOCIO = {
  promocion: "Promoción inmobiliaria",
  inmueble: "Adquisición y explotación o venta de un inmueble",
  espectaculo: "Concierto, gira, festival o musical",
  fabricacion: "Fabricación y venta de un producto",
  otro: "Otro negocio",
};

export const NEGOCIO_VACIO = {
  tipo: "promocion",
  denominacion: "",
  // inmuebles
  finca_dir: "", ref_catastral: "", registro: "", finca_registral: "",
  actuacion: "", licencia: "", estrategia: "reforma_venta", precio_adquisicion: "",
  // espectáculos
  formato: "concierto", titulo: "", artistas: "", calendario: "",
  // fabricación
  producto: "", instalaciones: "", mercados: "",
  // comunes
  descripcion_libre: "", ingresos: "", presupuesto: "", plazo_meses: "", anexo: false,
};

const eur = v => { const n = parseFloat(v); return isNaN(n) ? "" : n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " euros"; };
const X = "[●]";
const o = (v, etq) => (v && String(v).trim()) || (etq ? `[${etq}]` : X);

function finca(n) {
  let s = "sobre la finca sita en " + o(n.finca_dir, "ubicación de la finca");
  if (n.ref_catastral) s += ", con referencia catastral " + n.ref_catastral.trim();
  if (n.registro || n.finca_registral) s += ", inscrita en el Registro de la Propiedad " + o(n.registro, "Registro de la Propiedad") + " como finca registral n.º " + o(n.finca_registral, "n.º de finca");
  return s;
}

const FORMATOS = { concierto: "del concierto", gira: "de la gira", festival: "del festival", musical: "del espectáculo musical" };
const ESTRATEGIAS = {
  reforma_venta: "su adquisición, reforma y posterior venta",
  arrendamiento: "su adquisición y explotación en arrendamiento",
  venta: "su adquisición y posterior venta",
};

// Texto para el Expositivo I: «Que el Gestor desarrolla en nombre propio <texto> (en adelante, el «Negocio»).»
export function describirNegocio(n) {
  const den = n.denominacion?.trim() ? ` denominada «${n.denominacion.trim()}»` : "";
  let s;
  switch (n.tipo) {
    case "promocion":
      s = `la promoción inmobiliaria${den}, consistente en ${o(n.actuacion, "qué se va a construir")}, ${finca(n)}`;
      if (n.licencia?.trim()) s += `, que ${n.licencia.trim()}`;
      break;
    case "inmueble":
      s = `la operación inmobiliaria${den} relativa al inmueble sito en ${o(n.finca_dir, "ubicación de la finca")}`;
      if (n.ref_catastral) s += `, con referencia catastral ${n.ref_catastral.trim()}`;
      if (n.registro || n.finca_registral) s += `, inscrito en el Registro de la Propiedad ${o(n.registro, "Registro de la Propiedad")} como finca registral n.º ${o(n.finca_registral, "n.º de finca")}`;
      s += `, consistente en ${ESTRATEGIAS[n.estrategia] || ESTRATEGIAS.venta}`;
      if (eur(n.precio_adquisicion)) s += `, con un precio de adquisición previsto de ${eur(n.precio_adquisicion)}`;
      break;
    case "espectaculo":
      s = `la producción y explotación ${FORMATOS[n.formato] || "del espectáculo"} «${o(n.titulo, "título")}»`;
      if (n.artistas?.trim()) s += `, con la participación de ${n.artistas.trim()}`;
      s += `, que se celebrará ${o(n.calendario, "fechas y recintos")}`;
      break;
    case "fabricacion":
      s = `la fabricación y comercialización de ${o(n.producto, "producto")}`;
      if (n.instalaciones?.trim()) s += ` en ${n.instalaciones.trim()}`;
      if (n.mercados?.trim()) s += `, destinado a ${n.mercados.trim()}`;
      break;
    default:
      s = o(n.descripcion_libre, "descripción del negocio");
  }
  if (n.tipo !== "otro" && n.descripcion_libre?.trim()) s += `. ${n.descripcion_libre.trim().replace(/\.$/, "")}`;
  return s;
}

// Párrafo adicional para el Expositivo (va después del I). Devuelve "" si no hay datos.
export function estimacionesNegocio(n) {
  const partes = [];
  if (n.ingresos?.trim()) partes.push(`Los ingresos del Negocio procederán principalmente de ${n.ingresos.trim().replace(/\.$/, "")}`);
  const p = eur(n.presupuesto), m = parseInt(n.plazo_meses, 10);
  if (p || m) {
    let t = "El Gestor estima";
    if (p) t += ` un presupuesto total de ${p}`;
    if (p && m) t += " y";
    if (m) t += ` un plazo de ejecución de ${m} meses`;
    partes.push(t + ", estimaciones que tienen carácter orientativo y no constituyen garantía de resultado");
  }
  return partes.length ? partes.join(". ") + "." : "";
}

// Frase para la cláusula de objeto: delimita el perímetro de la participación
export function perimetroNegocio(n) {
  return "La participación se limita exclusivamente al Negocio" + (n.anexo ? ", tal como se describe en el Expositivo I y en el Anexo I," : " descrito en el Expositivo I") +
    " y no se extiende a las demás actividades del Gestor.";
}

// Anexo I opcional: ficha del negocio con todos los datos
export function anexoNegocio(n) {
  if (!n.anexo) return null;
  const filas = [["Tipo de negocio", TIPOS_NEGOCIO[n.tipo]]];
  const add = (k, v) => v && String(v).trim() && filas.push([k, String(v).trim()]);
  add("Denominación", n.denominacion);
  if (n.tipo === "promocion" || n.tipo === "inmueble") {
    add("Ubicación", n.finca_dir); add("Referencia catastral", n.ref_catastral);
    add("Registro de la Propiedad", n.registro); add("Finca registral", n.finca_registral);
    if (n.tipo === "promocion") { add("Actuación", n.actuacion); add("Situación urbanística / licencia", n.licencia); }
    else { add("Estrategia", ESTRATEGIAS[n.estrategia]); add("Precio de adquisición previsto", eur(n.precio_adquisicion)); }
  }
  if (n.tipo === "espectaculo") { add("Formato", n.formato); add("Título", n.titulo); add("Artistas", n.artistas); add("Fechas y recintos", n.calendario); }
  if (n.tipo === "fabricacion") { add("Producto", n.producto); add("Instalaciones", n.instalaciones); add("Mercados", n.mercados); }
  add("Descripción", n.descripcion_libre); add("Fuentes de ingresos", n.ingresos);
  add("Presupuesto estimado", eur(n.presupuesto)); add("Plazo estimado", n.plazo_meses && `${n.plazo_meses} meses`);
  return { titulo: "ANEXO I. DESCRIPCIÓN DEL NEGOCIO", filas };
}

// Avisos de calidad: lo que falta para que el negocio quede bien identificado
export function avisosNegocio(n) {
  const a = [];
  const vacio = v => !v || !String(v).trim();
  if ((n.tipo === "promocion" || n.tipo === "inmueble") && vacio(n.finca_dir, "ubicación de la finca")) a.push("Indica dónde está la finca o el inmueble.");
  if ((n.tipo === "promocion" || n.tipo === "inmueble") && vacio(n.ref_catastral) && vacio(n.finca_registral, "n.º de finca")) a.push("Añade la referencia catastral o los datos registrales: identifican la finca sin duda.");
  if (n.tipo === "promocion" && vacio(n.actuacion, "qué se va a construir")) a.push("Describe la actuación (por ejemplo, número de viviendas y usos).");
  if (n.tipo === "espectaculo" && vacio(n.titulo, "título")) a.push("Indica el título del espectáculo o de la gira.");
  if (n.tipo === "espectaculo" && vacio(n.calendario, "fechas y recintos")) a.push("Indica fechas y recintos, aunque sean provisionales.");
  if (n.tipo === "fabricacion" && vacio(n.producto, "producto")) a.push("Indica qué producto se fabrica.");
  if (n.tipo === "otro" && String(n.descripcion_libre || "").trim().split(/\s+/).length < 12) a.push("La descripción es muy breve: explica qué actividad es, dónde se desarrolla y cómo genera ingresos.");
  if (vacio(n.ingresos)) a.push("Indica de dónde vienen los ingresos: es la base para calcular el beneficio que se reparte.");
  return a;
}
