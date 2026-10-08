// Correos de Mi Despacho: se abren en Outlook (o el programa de correo del PC) ya redactados,
// para que el usuario los revise, los cambie si quiere y pulse Enviar. Mi Despacho no envía nada por su cuenta.
//
// - Sin adjuntos: enlace mailto: (abre el programa de correo predeterminado).
// - Con adjuntos: se genera un borrador .eml con la cabecera "X-Unsent: 1". Al abrirlo, Outlook lo muestra
//   como un correo NUEVO editable, con el adjunto ya puesto.

const CLAVE = "md-plantillas-correo-v1";

// Variables disponibles en todas las plantillas: {{remitente}}, {{destinatario}}, {{empresa}},
// {{documento}}, {{periodo}}, {{enlace}}, {{fecha}}
export const PLANTILLAS_BASE = {
  contrato_firma: {
    nombre: "Enviar un contrato para revisar y firmar",
    asunto: "{{documento}} – {{empresa}}",
    cuerpo: "Hola, {{destinatario}}:\n\nTe adjunto el {{documento}} para que lo revises. Si estás de acuerdo, puedes firmarlo en Mi Despacho.\n\nCualquier duda, me dices.\n\nUn saludo,\n{{remitente}}",
  },
  contrato_firmado: {
    nombre: "Enviar un contrato ya firmado",
    asunto: "{{documento}} firmado – {{empresa}}",
    cuerpo: "Hola, {{destinatario}}:\n\nTe adjunto el {{documento}} firmado por ambas partes, con su hoja de evidencias. Guárdalo con la documentación de la empresa.\n\nUn saludo,\n{{remitente}}",
  },
  contabilidad_lista: {
    nombre: "Avisar a la gestoría de que la contabilidad está lista",
    asunto: "Contabilidad {{periodo}} lista – {{empresa}}",
    cuerpo: "Hola, {{destinatario}}:\n\nLa contabilidad de {{empresa}} del periodo {{periodo}} ya está lista en la carpeta compartida:\n{{enlace}}\n\nQuedo a tu disposición para lo que necesites.\n\nUn saludo,\n{{remitente}}",
  },
  contabilidad_revisada: {
    nombre: "Avisar al cliente de que la contabilidad está revisada",
    asunto: "Contabilidad {{periodo}} revisada – {{empresa}}",
    cuerpo: "Hola, {{destinatario}}:\n\nHemos revisado la contabilidad de {{empresa}} del periodo {{periodo}}. Tienes las notas y lo que falta en la carpeta compartida:\n{{enlace}}\n\nUn saludo,\n{{remitente}}",
  },
  documentacion_pendiente: {
    nombre: "Pedir documentación pendiente",
    asunto: "Documentación pendiente {{periodo}} – {{empresa}}",
    cuerpo: "Hola, {{destinatario}}:\n\nPara cerrar el periodo {{periodo}} de {{empresa}} nos falta la siguiente documentación:\n\n- \n\nPuedes dejarla en la carpeta compartida:\n{{enlace}}\n\nGracias y un saludo,\n{{remitente}}",
  },
};

export function plantillas() {
  let propias = {};
  try { propias = JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch { /* sin almacenamiento */ }
  const r = {};
  for (const [k, v] of Object.entries(PLANTILLAS_BASE)) r[k] = { ...v, ...(propias[k] || {}), modificada: !!propias[k] };
  return r;
}

export function guardarPlantilla(id, { asunto, cuerpo }) {
  let propias = {};
  try { propias = JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch { /* nada */ }
  propias[id] = { asunto, cuerpo };
  try { localStorage.setItem(CLAVE, JSON.stringify(propias)); } catch { /* nada */ }
}

export function restaurarPlantilla(id) {
  let propias = {};
  try { propias = JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch { /* nada */ }
  delete propias[id];
  try { localStorage.setItem(CLAVE, JSON.stringify(propias)); } catch { /* nada */ }
}

export const mayus = t => t.charAt(0).toUpperCase() + t.slice(1);

export function rellenarPlantilla(texto, vars) {
  const base = { fecha: new Date().toLocaleDateString("es-ES"), ...vars };
  return texto.replace(/\{\{(\w+)\}\}/g, (_, k) => (base[k] ?? "").toString()).replace(/\n{3,}/g, "\n\n");
}

// ---------- borrador .eml ----------
const b64utf8 = s => btoa(unescape(encodeURIComponent(s)));
const cabecera = s => /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64utf8(s)}?=`;
const trocear = s => s.replace(/.{1,76}/g, "$&\r\n");

async function blobB64(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

async function crearEml({ para, cc, asunto, cuerpo, adjuntos }) {
  const limite = "md_" + Math.random().toString(36).slice(2);
  const l = [
    "MIME-Version: 1.0",
    "X-Unsent: 1",
    `To: ${para || ""}`,
    ...(cc ? [`Cc: ${cc}`] : []),
    `Subject: ${cabecera(asunto)}`,
    `Content-Type: multipart/mixed; boundary="${limite}"`,
    "",
    `--${limite}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    trocear(b64utf8(cuerpo.replace(/\n/g, "\r\n"))),
  ];
  for (const a of adjuntos) {
    l.push(`--${limite}`,
      `Content-Type: ${a.blob.type || "application/octet-stream"}; name="${cabecera(a.nombre)}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${cabecera(a.nombre)}"`,
      "",
      trocear(await blobB64(a.blob)));
  }
  l.push(`--${limite}--`, "");
  return new Blob([l.join("\r\n")], { type: "message/rfc822" });
}

// Abre el correo. Devuelve "mailto" o "eml" según el método usado.
export async function abrirCorreo({ plantilla, vars = {}, para = "", cc = "", adjuntos = [] }) {
  const p = plantillas()[plantilla];
  const asunto = mayus(rellenarPlantilla(p.asunto, vars));
  const cuerpo = rellenarPlantilla(p.cuerpo, vars);
  if (!adjuntos.length) {
    const q = new URLSearchParams();
    if (cc) q.set("cc", cc);
    q.set("subject", asunto); q.set("body", cuerpo);
    window.location.href = `mailto:${encodeURIComponent(para)}?${q.toString().replace(/\+/g, "%20")}`;
    return "mailto";
  }
  const eml = await crearEml({ para, cc, asunto, cuerpo, adjuntos });
  const url = URL.createObjectURL(eml);
  const a = document.createElement("a");
  a.href = url; a.download = `${asunto.replace(/[\\/:*?"<>|]/g, "").slice(0, 80)}.eml`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "eml";
}
