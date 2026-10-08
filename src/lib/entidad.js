// Forma jurídica de la entidad: cambia el plan contable, los impuestos, el calendario y los textos.
export const FORMAS = {
  sl: "Sociedad limitada (S.L. / S.L.U.)",
  sa: "Sociedad anónima (S.A.)",
  asociacion: "Asociación",
  fundacion: "Fundación",
};
export const esESFL = (config) => ["asociacion", "fundacion"].includes(config?.empresa?.forma);
// Opciones fiscales de una entidad sin fines lucrativos
export const OPCIONES_ESFL = [
  ["utilidadPublica", "Declarada de utilidad pública"],
  ["ley49", "Acogida al régimen fiscal especial de la Ley 49/2002 (presenta el modelo 182 de donativos)"],
  ["ivaExenta", "Todas sus actividades están exentas de IVA (no presenta el modelo 303)"],
  ["actividadEconomica", "Tiene actividades económicas (patrocinios, ventas, servicios con precio)"],
];
// Plan contable por defecto según la forma
export const planPorDefecto = (config) => config?.planContable || (esESFL(config) ? "esfl" : "pymes");
// Opciones para impuestos y calendario: las del calendario + las de la forma jurídica
export const opcionesFiscales = (config) => ({ ...(config?.calendario || {}), forma: config?.empresa?.forma || "sl", esfl: esESFL(config), ...(config?.empresa?.esfl || {}) });
