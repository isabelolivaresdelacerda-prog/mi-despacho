// Edición de la app según dónde se publica. En Vercel: variable VITE_EDICION.
// - "" (por defecto): Mi Despacho para sociedades y gestorías.
// - "autonomo": Mi Despacho para un autónomo (persona física): carpetas, contabilidad e impuestos de autónomo.
export const EDICION = (import.meta.env?.VITE_EDICION || "").toLowerCase();
export const EDICION_AUTONOMO = EDICION === "autonomo";
