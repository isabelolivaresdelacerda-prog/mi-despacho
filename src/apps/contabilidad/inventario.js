// Inventario de la carpeta de la empresa: la app recorre todas las carpetas (001 corporate, 002, 003…),
// guarda un registro de lo que hay (ruta, tamaño, fecha) y solo lee con la IA lo nuevo o lo que ha cambiado.
// Los documentos con efecto contable (ampliaciones de capital, préstamos, compraventas, contratos con pagos…)
// se vinculan solos a la contabilidad, marcados para que una persona los revise.
import { leerJSON, escribirJSON, num, TIPOS_VINCULO, leerVinculados, guardarVinculados } from "./datos.js";
import { preguntarIA } from "../../ia-navegador.js";

const ARCHIVO = "inventario_documentos.json";
const SALTAR = /^(programa|para la gestoria|contabilidad\b|contabilidad -|app|node_modules|\.|~\$|desktop\.ini|thumbs\.db|_antiguo)/i;
// Versiones del mismo documento (copia OCR, firmado, «(2)», «_Copiar»…): se tratan como uno solo
const raizNombre = (n) => plano(n).replace(/\.[^.]+$/, "").replace(/(_ocr|_copiar|_con firma digital|[ _-]*firmado( por ambas partes)?|\s*\(\d+\)|\s*copia)+$/g, "").replace(/^[a-z]{0,4}\d{6}\s*-\s*/, "").trim();
const prioridad = (n) => (/firmad|firma digital/i.test(n) ? 3 : 0) + (/_ocr/i.test(n) ? -1 : 0) + (/\(\d+\)|copiar/i.test(n) ? -2 : 0);
const DOCS = /\.(pdf|docx?|odt|jpe?g|png)$/i;
const plano = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

async function recorrer(dir, ruta = [], out = [], prof = 0) {
  for await (const [n, h] of dir.entries()) {
    if (SALTAR.test(n)) continue;
    if (h.kind === "directory") { if (prof < 6) await recorrer(h, [...ruta, n], out, prof + 1); continue; }
    if (!DOCS.test(n)) continue;
    const f = await h.getFile();
    out.push({ ruta, nombre: n, size: f.size, mtime: f.lastModified, h });
  }
  return out;
}

// Primera clasificación por el nombre y la carpeta (sin IA)
export function clasificar(nombre, ruta = []) {
  const t = plano(nombre), r = plano(ruta.join("/"));
  const R = [
    [/constituci/, "constitucion"], [/ampliaci\w* de capital|aumento de capital|ampliacion capital/, "ampliacion"], [/aportaci/, "aportacion"],
    [/prestamo|hipoteca|financiaci|poliza de credito|credito/, "prestamo_recibido"], [/arras/, "arras"],
    [/compraventa|escritura de compra|adquisici|compra de (suelo|finca|solar|parcela)/, "compraventa"],
    [/arrendamiento|alquiler/, "contrato_pago"], [/seguro|poliza/, "seguro"],
    [/cuentas en participaci/, "otro"], [/contrato|encargo|honorarios|presupuesto/, "contrato_pago"],
  ];
  for (const [re, tipo] of R) if (re.test(t)) return { tipo, contable: true };
  if (/estatutos|acta|titular real|\bcif\b|\bnif\b|poder|certificad|nota simple|libro|registro|modelo|statut|logo|imagen/.test(t)) return { tipo: "informativo", contable: false };
  if (/(^|\/)(old|antiguo|borradores?|imagenes|notas simples|doc socios|imagen corporativa)(\/|$)/.test(r) || /\.(jpe?g|png)$/.test(t)) return { tipo: "informativo", contable: false };
  return { tipo: "desconocido", contable: false };
}

const PROMPT = (propia) => `Eres contable en España. Lee el texto de este documento de la empresa «${propia?.nombre || "nuestra empresa"}» y responde SOLO con JSON:
{"tipo":"constitucion|ampliacion|aportacion|prestamo_recibido|arras|compraventa|contrato_pago|contrato_cobro|cuotas_prestamo|seguro|otro|sin_efecto_contable","fecha":"dd/mm/aaaa","importe":0,"periodicidad":"mensual|trimestral|semestral|anual|","inicio":"dd/mm/aaaa","fin":"dd/mm/aaaa","tercero":"","resumen":""}
Reglas: importe = la cantidad principal (capital desembolsado incluida la prima en una ampliación; precio en una compraventa; principal en un préstamo; importe de CADA cuota si hay pagos periódicos). contrato_pago si nuestra empresa paga; contrato_cobro si cobra. tercero = la otra parte (socio, banco, vendedor, proveedor). Si el documento no tiene efecto contable (estatutos, actas sin dinero, certificados), tipo "sin_efecto_contable". No inventes: si no aparece, déjalo vacío o 0.
TEXTO:
`;

async function analizar(doc, propia) {
  if (!/\.(pdf|jpe?g|png)$/i.test(doc.nombre)) return null;
  try {
    const { textoPDF, textoImagen } = await import("./leer.js");
    const f = await doc.h.getFile();
    const texto = /\.pdf$/i.test(doc.nombre) ? await textoPDF(f, 6) : await textoImagen(f);
    if (texto.length < 40) return { sinTexto: true };
    const r = await preguntarIA(PROMPT(propia) + texto.slice(0, 9000), { maxTokens: 450, json: true });
    if (r.estado !== "ok") return { sinIA: true };
    const m = String(r.texto).match(/\{[\s\S]*\}/);
    return m ? { ...JSON.parse(m[0]), ia: r.ia } : null;
  } catch { return null; }
}

// Revisa la carpeta: devuelve { total, nuevos: [...], vinculados: n }. onPaso(texto) informa del progreso.
export async function revisarCarpeta({ empresa, raiz, propia, onPaso, reintentar = false }) {
  const inv = await leerJSON(raiz, ARCHIVO, { docs: {} });
  const docs = await recorrer(empresa);
  const nuevos = [];
  const visto = new Date().toISOString();
  for (const d of docs) {
    const k = [...d.ruta, d.nombre].join("/");
    const prev = inv.docs[k];
    if (prev && prev.size === d.size && prev.mtime === d.mtime) continue;
    nuevos.push({ ...d, k, cambiado: !!prev });
  }
  const vinc = await leerVinculados(raiz);
  // Documentos renombrados o movidos: mismo tamaño que uno que ya no está → se actualiza el registro y el vínculo
  const actualesK = new Set(docs.map((d) => [...d.ruta, d.nombre].join("/")));
  const desaparecidos = Object.entries(inv.docs).filter(([k]) => !actualesK.has(k));
  let cambiosVinc = false;
  for (const d of [...nuevos]) {
    if (d.cambiado) continue;
    const mismos = desaparecidos.filter(([, x]) => x.size === d.size);
    const viejo = mismos.find(([, x]) => x.mtime === d.mtime) || (mismos.length === 1 ? mismos[0] : null);
    if (!viejo) continue;
    const [kv, xv] = viejo;
    inv.docs[d.k] = { ...xv, ruta: d.ruta, nombre: d.nombre, mtime: d.mtime, renombradoDe: kv };
    delete inv.docs[kv];
    for (const v of vinc) if ([...v.ruta, v.archivo].join("/") === kv) { v.ruta = d.ruta; v.archivo = d.nombre; cambiosVinc = true; }
    nuevos.splice(nuevos.indexOf(d), 1);
    desaparecidos.splice(desaparecidos.indexOf(viejo), 1);
  }
  // Limpieza de revisiones antiguas: los vínculos hechos solo por el nombre (sin que la IA leyera el documento) se quitan
  // y esos documentos, junto con los «sin clasificar», se vuelven a leer ahora (con OCR y la IA).
  const autoNombre = (v) => reintentar && v.propuestoIA && !v.revisado && /por el nombre|sin texto|sin IA/i.test(v.ia || "");
  const quitar = new Set(vinc.filter(autoNombre).map((v) => [...v.ruta, v.archivo].join("/")));
  if (quitar.size) { for (let j = vinc.length - 1; j >= 0; j--) if (autoNombre(vinc[j])) vinc.splice(j, 1); cambiosVinc = true; }
  const yaVinc = new Set(vinc.map((v) => [...v.ruta, v.archivo].join("/")));
  const yaEnCola = new Set(nuevos.map((d) => d.k));
  for (const d of docs) {
    const k = [...d.ruta, d.nombre].join("/"), prev = inv.docs[k];
    if (yaEnCola.has(k) || !prev || !reintentar) continue;
    if (quitar.has(k) || prev.estado === "sin clasificar" || prev.estado === "pendiente de IA" || /app\/|node_modules/.test(k)) { nuevos.push({ ...d, k, cambiado: true }); yaEnCola.add(k); }
  }
  for (const k of Object.keys(inv.docs)) if (/^(app|node_modules)\//.test(k)) delete inv.docs[k];
  // Grupos de versiones: solo se lee y vincula la mejor (la firmada; si no, la original)
  const grupos = {};
  for (const d of docs) { const g = [...d.ruta, raizNombre(d.nombre)].join("/"); (grupos[g] ||= []).push(d); }
  const principal = new Set(Object.values(grupos).map((l) => l.sort((a, b) => prioridad(b.nombre) - prioridad(a.nombre) || a.nombre.length - b.nombre.length)[0]).map((d) => [...d.ruta, d.nombre].join("/")));
  let n = 0, i = 0;
  for (const d of nuevos) {
    i++;
    const c = clasificar(d.nombre, d.ruta);
    if (!principal.has(d.k)) { inv.docs[d.k] = { ruta: d.ruta, nombre: d.nombre, size: d.size, mtime: d.mtime, visto, tipo: c.tipo, resumen: "", estado: "versión de otro documento" }; continue; }
    let a = null;
    if (c.tipo !== "informativo") { onPaso?.(`Leyendo ${i} de ${nuevos.length}: ${d.nombre}`); a = await analizar(d, propia); }
    // Solo se vincula lo que la IA ha LEÍDO y tiene efecto contable con importe; por el nombre nunca
    const leido = a && !a.sinIA && !a.sinTexto && a.tipo;
    const tipo = leido && a.tipo !== "sin_efecto_contable" && TIPOS_VINCULO[a.tipo] && num(a.importe) > 0 ? a.tipo : null;
    const reg = { ruta: d.ruta, nombre: d.nombre, size: d.size, mtime: d.mtime, visto, tipo: tipo || (leido ? a.tipo : c.tipo), resumen: a?.resumen || "", estado: "revisado" };
    if (tipo && !yaVinc.has(d.k)) {
      const importe = num(a?.importe);
      const t = TIPOS_VINCULO[tipo];
      vinc.push({ id: crypto.randomUUID(), ruta: d.ruta, archivo: d.nombre, tipo, fecha: a?.fecha || "", importe: importe || "", periodicidad: a?.periodicidad || "mensual", inicio: a?.inicio || (t.periodico ? a?.fecha || "" : ""), fin: a?.fin || "", tercero: a?.tercero || "", cuenta: "", notas: a?.resumen || "",
        propuestoIA: true, revisado: false, ia: a?.ia || (a?.sinIA ? "sin IA (por el nombre)" : a?.sinTexto ? "sin texto (escaneado)" : "por el nombre") });
      reg.estado = "vinculado"; n++;
    } else if (!tipo) reg.estado = c.tipo === "informativo" || leido || !/\.(pdf|jpe?g|png)$/i.test(d.nombre) ? "sin efecto contable" : a?.sinIA ? "pendiente de IA" : "sin clasificar";
    inv.docs[d.k] = reg;
  }
  // Los que ya no están (movidos o borrados)
  const actuales = new Set(docs.map((d) => [...d.ruta, d.nombre].join("/")));
  for (const k of Object.keys(inv.docs)) if (!actuales.has(k)) inv.docs[k].estado = "ya no está";
  inv.actualizado = visto; inv.total = docs.length;
  inv.historial = [...(inv.historial || []).slice(-50), { fecha: visto, total: docs.length, nuevos: nuevos.length, vinculados: n }];
  await escribirJSON(raiz, ARCHIVO, inv);
  if (n || cambiosVinc) await guardarVinculados(raiz, vinc);
  return { total: docs.length, nuevos, vinculados: n, inventario: inv };
}

export async function leerInventario(raiz) { return leerJSON(raiz, ARCHIVO, { docs: {} }); }
