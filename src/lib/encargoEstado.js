// ¿Está firmado el contrato de encargo del tratamiento con la gestoría?
// Fuentes: el contrato firmado en Mi Despacho (este navegador) o la confirmación de que se firmó fuera (papel / otra plataforma).
const CLAVE_CONTRATO = "md-contrato-encargo-v2";
const CLAVE_EXTERNO = "md-encargo-externo";

export function estadoEncargo() {
  let c = null, ext = null;
  try { c = JSON.parse(localStorage.getItem(CLAVE_CONTRATO)); } catch { /* nada */ }
  try { ext = JSON.parse(localStorage.getItem(CLAVE_EXTERNO)); } catch { /* nada */ }
  const d = c?.datos, firmas = c?.expediente?.firmas || [];
  const esGestoria = !d?.tipo || d.tipo === "gestoria";
  if (d && esGestoria && firmas.length === 2) {
    const ult = firmas[firmas.length - 1];
    return { estado: "firmado", origen: "Mi Despacho", gestoria: d.enc?.razon_social, email: d.enc?.email_rgpd, fecha: ult.fecha_local, laboral: !!d.laboral };
  }
  if (ext?.fecha) return { estado: "firmado", origen: "fuera de Mi Despacho", gestoria: ext.gestoria, email: ext.email, fecha: ext.fecha };
  if (d && esGestoria && firmas.length === 1) return { estado: "a_medias", gestoria: d.enc?.razon_social, email: d.enc?.email_rgpd };
  if (d && esGestoria && c?.expediente) return { estado: "sin_firmar", gestoria: d.enc?.razon_social, email: d.enc?.email_rgpd };
  return { estado: "no_existe", gestoria: d?.enc?.razon_social, email: d?.enc?.email_rgpd };
}

export function marcarFirmadoFuera({ gestoria, email, fecha }) {
  try { localStorage.setItem(CLAVE_EXTERNO, JSON.stringify({ gestoria, email, fecha, marcado: new Date().toISOString() })); } catch { /* nada */ }
}
