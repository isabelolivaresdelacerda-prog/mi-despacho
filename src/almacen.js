// Todo se guarda solo en el navegador de cada usuaria.
const CLAVE = "mi-despacho-config";

export const CONFIG_INICIAL = {
  configurado: false,
  tipo: "empresa",        // "gestoria" | "empresa"
  nombre: "",
  logo: "",               // imagen en base64
  color: "#7A1F2B",       // color principal
  fondo: "#F3EEE6",       // color de fondo
  nube: "google",         // "google" | "onedrive"
  carpetas: {             // enlaces a carpetas de la nube de cada usuaria
    contratos: "",
    contabilidad: "",
  },
  appContabilidad: "",    // dirección de su app de contabilidad (p. ej. http://127.0.0.1:5000)
  apps: { contabilidad: true, contratos: true }, // apps contratadas (de momento, todas)
};

export function leerConfig() {
  try {
    const c = JSON.parse(localStorage.getItem(CLAVE));
    return c ? { ...CONFIG_INICIAL, ...c, carpetas: { ...CONFIG_INICIAL.carpetas, ...(c.carpetas || {}) }, apps: { ...CONFIG_INICIAL.apps, ...(c.apps || {}) } } : { ...CONFIG_INICIAL };
  } catch {
    return { ...CONFIG_INICIAL };
  }
}

export function guardarConfig(c) {
  try { localStorage.setItem(CLAVE, JSON.stringify(c)); return true; } catch { return false; }
}

export const TIPOS = {
  gestoria: { nombre: "Gestoría", texto: "Llevo la contabilidad y los papeles de mis clientes." },
  empresa: { nombre: "Empresa", texto: "Gestiono mi propia empresa." },
};

export const local = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
