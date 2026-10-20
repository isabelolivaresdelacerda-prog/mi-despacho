// Forma jurídica de la entidad: cambia el plan contable, los impuestos, el calendario y los textos.
import { EDICION_AUTONOMO } from "../edicion.js";
export const FORMAS = {
  autonomo: "Autónomo (persona física)",
  sl: "Sociedad limitada (S.L. / S.L.U.)",
  sa: "Sociedad anónima (S.A.)",
  asociacion: "Asociación",
  fundacion: "Fundación",
};
// Forma de la entidad: la guardada en Ajustes; si no hay, la de la edición (autónomo) o S.L.
export const formaDe = (config) => config?.empresa?.forma || (EDICION_AUTONOMO ? "autonomo" : "sl");
export const esESFL = (config) => ["asociacion", "fundacion"].includes(formaDe(config));
export const esAutonomo = (config) => formaDe(config) === "autonomo";
// Opciones fiscales de un autónomo (estimación directa)
export const OPCIONES_AUTONOMO = [
  ["profesional", "Actividad profesional (abogado, consultor, diseñador…): mis facturas a empresas y autónomos llevan retención de IRPF"],
  ["nuevoAutonomo", "Empecé la actividad hace menos de 3 años: retención reducida del 7 % (en lugar del 15 %)"],
  ["exento130", "No presento el modelo 130: al menos el 70 % de mis ingresos del año anterior llevaron retención"],
  ["normal", "Estimación directa normal (sin el 5 % de gastos de difícil justificación de la simplificada)"],
  ["ivaExenta", "Mi actividad está exenta de IVA (sanidad, enseñanza…): no presento el modelo 303"],
];
// Opciones fiscales de una entidad sin fines lucrativos
export const OPCIONES_ESFL = [
  ["utilidadPublica", "Declarada de utilidad pública"],
  ["ley49", "Acogida al régimen fiscal especial de la Ley 49/2002 (presenta el modelo 182 de donativos)"],
  ["ivaExenta", "Todas sus actividades están exentas de IVA (no presenta el modelo 303)"],
  ["actividadEconomica", "Tiene actividades económicas (patrocinios, ventas, servicios con precio)"],
];
// Plan contable por defecto según la forma
export const planPorDefecto = (config) => config?.planContable || (esESFL(config) ? "esfl" : "pymes");
// Textos que cambian según la forma
export const textos = (config) => esAutonomo(config)
  ? { entidad: "tu actividad", resultado: "Rendimiento neto", pyg: "Rendimiento de la actividad (ingresos y gastos)" }
  : esESFL(config) ? { entidad: "la entidad", resultado: "Excedente", pyg: "Cuenta de resultados" }
  : { entidad: "la empresa", resultado: "Resultado", pyg: "Cuenta de pérdidas y ganancias" };
// Opciones para impuestos y calendario: las del calendario + las de la forma jurídica
export const opcionesFiscales = (config) => ({ ...(config?.calendario || {}), forma: formaDe(config), esfl: esESFL(config), ...(config?.empresa?.esfl || {}),
  autonomo: esAutonomo(config), ...(esAutonomo(config) ? config?.empresa?.autonomo || {} : {}) });
