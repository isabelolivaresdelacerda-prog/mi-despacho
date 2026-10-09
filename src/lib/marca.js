// Marca de la empresa o del grupo: logo, colores y tipografías. Todo lo que genera Mi Despacho (la propia app,
// la papelería corporativa y los contratos en Word) sale con estos datos.
// Las tipografías son de las que hay en Word y además existen en Google Fonts (la web las carga de allí).
export const FUENTES = [
  { id: "Georgia", tipo: "serif", web: null },
  { id: "Times New Roman", tipo: "serif", web: null },
  { id: "Garamond", tipo: "serif", web: "EB Garamond" },
  { id: "Cambria", tipo: "serif", web: "Caladea" },
  { id: "Book Antiqua", tipo: "serif", web: "Libre Baskerville" },
  { id: "Playfair Display", tipo: "serif", web: "Playfair Display" },
  { id: "Lora", tipo: "serif", web: "Lora" },
  { id: "Merriweather", tipo: "serif", web: "Merriweather" },
  { id: "Calibri", tipo: "sans", web: "Carlito" },
  { id: "Arial", tipo: "sans", web: null },
  { id: "Verdana", tipo: "sans", web: null },
  { id: "Segoe UI", tipo: "sans", web: null },
  { id: "Montserrat", tipo: "sans", web: "Montserrat" },
  { id: "Lato", tipo: "sans", web: "Lato" },
  { id: "Open Sans", tipo: "sans", web: "Open Sans" },
  { id: "Roboto", tipo: "sans", web: "Roboto" },
  { id: "Raleway", tipo: "sans", web: "Raleway" },
];
export const MARCA_INICIAL = { color2: "", fuenteTit: "", fuenteTxt: "" };

// Pila CSS para una fuente (la de Google si la hay, la de sistema y un respaldo)
export function pilaCSS(id, respaldo) {
  if (!id) return respaldo;
  const f = FUENTES.find((x) => x.id === id);
  return [f?.web && `"${f.web}"`, `"${id}"`, f?.tipo === "sans" ? "system-ui, sans-serif" : "Georgia, serif"].filter(Boolean).join(", ");
}

// Carga en la página las fuentes de Google que use la marca (una sola vez)
export function cargarFuentes(...ids) {
  const fams = [...new Set(ids.map((id) => FUENTES.find((x) => x.id === id)?.web).filter(Boolean))];
  if (!fams.length || typeof document === "undefined") return;
  const href = "https://fonts.googleapis.com/css2?" + fams.map((f) => "family=" + f.replace(/ /g, "+") + ":wght@400;600;700").join("&") + "&display=swap";
  if (document.querySelector(`link[data-marca="${href}"]`)) return;
  const l = document.createElement("link"); l.rel = "stylesheet"; l.href = href; l.dataset.marca = href; document.head.appendChild(l);
}

// Datos de marca a partir de la configuración guardada
export const marcaDe = (config = {}) => ({ color: config.color, color2: config.marca?.color2 || "", fuenteTit: config.marca?.fuenteTit || "", fuenteTxt: config.marca?.fuenteTxt || "", logo: config.logo });
