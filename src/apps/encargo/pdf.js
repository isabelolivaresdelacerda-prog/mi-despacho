// PDF del contrato de encargo y hoja de evidencias de firma. La maquetación es la común de los contratos (lib/contratoPDF.js).
import { MODELO, VERSION_CONTRATO, rellenar, banderas } from "./modelo.js";
import { pdfContrato, pdfFirmado, sha256Hex } from "../../lib/contratoPDF.js";

export { sha256Hex };

// Texto del contrato ya rellenado, en bloques del modelo
export function bloquesRellenos(datos) {
  const f = banderas(datos);
  return MODELO
    .filter(b => !b.si || f[b.si])
    .map(b => ({
      ...b,
      texto: b.texto ? rellenar(b.texto, datos) : b.texto,
      items: b.items ? b.items.map(t => rellenar(t, datos)) : b.items,
    }));
}

// 1) PDF del contrato (sin firmas). Su huella SHA-256 es lo que se firma.
export function generarContratoPDF(datos, bloques) {
  return pdfContrato(bloques, {
    titulo: "RGPD - Contrato de encargo del tratamiento de datos personales",
    asunto: `${datos.resp?.razon_social || ""} / ${datos.enc?.razon_social || ""}`,
    pie: `RGPD - Contrato de encargo del tratamiento · modelo v${VERSION_CONTRATO}`,
    fecha_generacion: datos.fecha_generacion,
  });
}

// 2) PDF final: contrato + hoja de evidencias con todas las firmas registradas
export function generarPDFFirmado(contratoBytes, hashContrato, datos, firmas) {
  return pdfFirmado(contratoBytes, hashContrato, {
    documento: `RGPD - Contrato de encargo del tratamiento — modelo v${VERSION_CONTRATO}`,
    anexa: "Anexa al contrato de encargo del tratamiento de datos personales",
    partes: `${datos.resp.razon_social} (${datos.resp.nif}) — Responsable · ${datos.enc.razon_social} (${datos.enc.nif}) — Encargado`,
    rol: (r) => (r === "resp" ? "Responsable del Tratamiento" : "Encargado del Tratamiento"),
  }, firmas);
}
