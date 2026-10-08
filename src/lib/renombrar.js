// Renombrar documentos con el formato de la empresa:
//   [PREFIJO]AAMMDD - TÍTULO                                   (general)
//   [PREFIJO]AAMMDD - ESCRITURA/TÍTULO PROTOCOLO-INICIALES     (escrituras: «BI260423 - AMPLIACIÓN DE CAPITAL 1648-EDF»)
//   [PREFIJO]AAMMDD - CONTRATO DE … - CON QUIÉN                 (contratos)
import { preguntarIA } from "../ia-navegador.js";

const ext = (n) => (n.match(/\.[^.]+$/) || [""])[0];
export const cumpleFormato = (n) => /^[A-Z]{0,4}\d{6} - .+/.test(n);
// Iniciales: «Enrique Delgado Fernández» → «EDF» (sin «de», «la», «del», «y»)
export const iniciales = (nombre) => String(nombre || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/^(d\.?|don|dona|dña\.?|doña)\s+/i, "").split(/\s+/).filter((w) => w && !/^(de|del|la|las|los|y|i|e)$/i.test(w)).map((w) => w[0].toUpperCase()).join("");
// Prefijo por defecto: iniciales de la razón social sin la forma jurídica («Beatriz Inversiones, S.L.» → «BI»)
export const prefijoEmpresa = (razon) => iniciales(String(razon || "").replace(/,?\s*(s\.?\s?l\.?\s?u?\.?|s\.?\s?a\.?|slp|asociaci[oó]n|fundaci[oó]n)\s*$/i, ""));
const aammdd = (f) => { const m = String(f || "").match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/); if (!m) return ""; const y = m[3].length === 2 ? m[3] : m[3].slice(2); return y + m[2].padStart(2, "0") + m[1].padStart(2, "0"); };
const limpio = (t) => String(t || "").replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();

export function nombreSegunFormato(info, prefijo, extension) {
  const fecha = aammdd(info.fecha);
  const titulo = limpio(info.titulo).toUpperCase();
  let cuerpo = titulo || "DOCUMENTO";
  if (info.clase === "escritura") {
    const ref = [info.protocolo && String(info.protocolo).replace(/\D/g, ""), iniciales(info.notario)].filter(Boolean).join("-");
    cuerpo = `${titulo.replace(/^ESCRITURA (DE )?/, "")}${ref ? " " + ref : ""}`;
  } else if (info.clase === "contrato") {
    const t = /^CONTRATO/.test(titulo) ? titulo : `CONTRATO DE ${titulo}`;
    cuerpo = `${t}${info.contraparte ? " - " + limpio(info.contraparte).toUpperCase() : ""}`;
  } else if (info.contraparte && !titulo.includes(limpio(info.contraparte).toUpperCase())) cuerpo = `${titulo} - ${limpio(info.contraparte).toUpperCase()}`;
  return `${fecha ? (prefijo || "") + fecha + " - " : ""}${cuerpo}`.slice(0, 150) + extension;
}

const PROMPT = (propia) => `Lee este documento de la empresa «${propia || "nuestra empresa"}» y responde SOLO con JSON:
{"clase":"escritura|contrato|acta|certificado|factura|impuesto|otro","fecha":"dd/mm/aaaa","titulo":"","notario":"","protocolo":"","contraparte":""}
Reglas: fecha = la del documento (otorgamiento de la escritura, firma del contrato, fecha del acta o certificado). titulo = muy corto y en español, como «AMPLIACIÓN DE CAPITAL», «CONSTITUCIÓN», «COMPRAVENTA SOLAR MANZANA 19», «ARRENDAMIENTO DE LOCAL», «ACTA TITULAR REAL», «CIF DEFINITIVO». notario y protocolo solo si es una escritura o acta notarial. contraparte = la otra parte del contrato (no nuestra empresa). No inventes nada.
TEXTO:
`;

// Lee el documento (PDF con texto) y propone el nombre; si no se puede leer, propone a partir del nombre actual
// Propuesta inmediata, sin leer el documento (fecha del archivo y nombre actual)
export function propuestaRapida(file, nombreActual, prefijo) {
  const base = nombreActual.replace(/\.[^.]+$/, "").replace(/^[A-Z]{0,4}\d{6}\s*-\s*/, "");
  const f = new Date(file?.lastModified || Date.now());
  const info = { clase: /escritura|esc\b/i.test(base) ? "escritura" : /contrato/i.test(base) ? "contrato" : "otro", fecha: `${f.getDate()}/${f.getMonth() + 1}/${f.getFullYear()}`, titulo: base };
  return nombreSegunFormato(info, prefijo, ext(nombreActual).toLowerCase());
}

export async function proponerNombre(file, nombreActual, { propia, prefijo } = {}) {
  let info = null, metodo = "por el nombre actual";
  if (/\.pdf$/i.test(nombreActual)) {
    try {
      const { textoPDF } = await import("../apps/contabilidad/leer.js");
      const texto = await textoPDF(file, 4);
      if (texto.length > 40) {
        // La IA tiene 40 s; si no responde (apagada o colgada), se propone sin ella
        const r = await Promise.race([preguntarIA(PROMPT(propia) + texto.slice(0, 7000), { maxTokens: 300, json: true }), new Promise((ok) => setTimeout(() => ok({ estado: "tiempo" }), 40000))]);
        const m = r.estado === "ok" && String(r.texto).match(/\{[\s\S]*\}/);
        if (m) { info = JSON.parse(m[0]); metodo = `IA (${r.ia})`; }
      }
    } catch { /* sigue sin IA */ }
  }
  if (!info) {
    const base = nombreActual.replace(/\.[^.]+$/, "").replace(/^[A-Z]{0,4}\d{6}\s*-\s*/, "");
    const f = new Date(file.lastModified);
    info = { clase: /escritura|esc\b/i.test(base) ? "escritura" : /contrato/i.test(base) ? "contrato" : "otro", fecha: `${f.getDate()}/${f.getMonth() + 1}/${f.getFullYear()}`, titulo: base };
    metodo = "sin IA: revisa la fecha (es la del archivo)";
  }
  return { nombre: nombreSegunFormato(info, prefijo, ext(nombreActual).toLowerCase()), info, metodo };
}

// Cambia el nombre de un archivo dentro de su carpeta (sin sobrescribir nunca otro). Pide permiso de escritura si hace falta.
export async function renombrarArchivo(dir, nombreActual, nuevo) {
  if (nombreActual === nuevo) return nuevo;
  if (!dir) throw new Error("No encuentro la carpeta. Vuelve a abrirla.");
  if (dir.queryPermission && (await dir.queryPermission({ mode: "readwrite" })) !== "granted" && (await dir.requestPermission({ mode: "readwrite" })) !== "granted")
    throw new Error("Sin permiso para cambiar archivos en esta carpeta. Pulsa «Permitir» cuando Chrome lo pregunte.");
  let final = nuevo;
  const [b, e] = nuevo.match(/^(.*?)(\.[^.]+)?$/).slice(1);
  for (let i = 2; i < 100; i++) { try { await dir.getFileHandle(final); final = `${b} (${i})${e || ""}`; } catch { break; } }
  const h = await dir.getFileHandle(nombreActual);
  if (typeof h.move === "function") { try { await h.move(final); return final; } catch { /* algunos Chrome no lo permiten en disco: se copia */ } }
  const f = await h.getFile();
  const w = await (await dir.getFileHandle(final, { create: true })).createWritable(); await w.write(f); await w.close();
  try { await dir.removeEntry(nombreActual); } catch { throw new Error(`Copiado como «${final}», pero no he podido quitar el original (¿está abierto en otro programa?).`); }
  return final;
}
