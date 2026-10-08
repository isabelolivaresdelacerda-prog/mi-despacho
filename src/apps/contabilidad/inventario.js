// Inventario de la carpeta de la empresa: la app recorre todas las carpetas (001 corporate, 002, 003…),
// guarda un registro de lo que hay (ruta, tamaño, fecha) y solo lee con la IA lo nuevo o lo que ha cambiado.
// Los documentos con efecto contable (ampliaciones de capital, préstamos, compraventas, contratos con pagos…)
// se vinculan solos a la contabilidad, marcados para que una persona los revise.
import { leerJSON, escribirJSON, num, TIPOS_VINCULO, leerVinculados, guardarVinculados } from "./datos.js";
import { preguntarIA } from "../../ia-navegador.js";

const ARCHIVO = "inventario_documentos.json";
const SALTAR = /^(programa|para la gestoria|contabilidad\b|contabilidad -|\.|~\$|desktop\.ini|thumbs\.db)/i;
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
  if (/003 financ/.test(r)) return { tipo: "prestamo_recibido", contable: true };
  if (/002 acqui/.test(r)) return { tipo: "compraventa", contable: true };
  return { tipo: "desconocido", contable: false };
}

const PROMPT = (propia) => `Eres contable en España. Lee el texto de este documento de la empresa «${propia?.nombre || "nuestra empresa"}» y responde SOLO con JSON:
{"tipo":"constitucion|ampliacion|aportacion|prestamo_recibido|arras|compraventa|contrato_pago|contrato_cobro|cuotas_prestamo|seguro|otro|sin_efecto_contable","fecha":"dd/mm/aaaa","importe":0,"periodicidad":"mensual|trimestral|semestral|anual|","inicio":"dd/mm/aaaa","fin":"dd/mm/aaaa","tercero":"","resumen":""}
Reglas: importe = la cantidad principal (capital desembolsado incluida la prima en una ampliación; precio en una compraventa; principal en un préstamo; importe de CADA cuota si hay pagos periódicos). contrato_pago si nuestra empresa paga; contrato_cobro si cobra. tercero = la otra parte (socio, banco, vendedor, proveedor). Si el documento no tiene efecto contable (estatutos, actas sin dinero, certificados), tipo "sin_efecto_contable". No inventes: si no aparece, déjalo vacío o 0.
TEXTO:
`;

async function analizar(doc, propia) {
  if (!/\.pdf$/i.test(doc.nombre)) return null;
  try {
    const { textoPDF } = await import("./leer.js");
    const texto = await textoPDF(await doc.h.getFile(), 6);
    if (texto.length < 40) return { sinTexto: true };
    const r = await preguntarIA(PROMPT(propia) + texto.slice(0, 9000), { maxTokens: 450, json: true });
    if (r.estado !== "ok") return { sinIA: true };
    const m = String(r.texto).match(/\{[\s\S]*\}/);
    return m ? { ...JSON.parse(m[0]), ia: r.ia } : null;
  } catch { return null; }
}

// Revisa la carpeta: devuelve { total, nuevos: [...], vinculados: n }. onPaso(texto) informa del progreso.
export async function revisarCarpeta({ empresa, raiz, propia, onPaso }) {
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
  const yaVinc = new Set(vinc.map((v) => [...v.ruta, v.archivo].join("/")));
  let n = 0, i = 0;
  for (const d of nuevos) {
    i++;
    const c = clasificar(d.nombre, d.ruta);
    let a = null;
    if (c.contable || c.tipo === "desconocido") { onPaso?.(`Leyendo ${i} de ${nuevos.length}: ${d.nombre}`); a = await analizar(d, propia); }
    const tipo = a?.tipo && a.tipo !== "sin_efecto_contable" && TIPOS_VINCULO[a.tipo] ? a.tipo : a?.tipo === "sin_efecto_contable" ? null : c.contable ? c.tipo : null;
    const reg = { ruta: d.ruta, nombre: d.nombre, size: d.size, mtime: d.mtime, visto, tipo: tipo || c.tipo, resumen: a?.resumen || "", estado: "revisado" };
    if (tipo && !yaVinc.has(d.k)) {
      const importe = num(a?.importe);
      const t = TIPOS_VINCULO[tipo];
      vinc.push({ id: crypto.randomUUID(), ruta: d.ruta, archivo: d.nombre, tipo, fecha: a?.fecha || "", importe: importe || "", periodicidad: a?.periodicidad || "mensual", inicio: a?.inicio || (t.periodico ? a?.fecha || "" : ""), fin: a?.fin || "", tercero: a?.tercero || "", cuenta: "", notas: a?.resumen || "",
        propuestoIA: true, revisado: false, ia: a?.ia || (a?.sinIA ? "sin IA (por el nombre)" : a?.sinTexto ? "sin texto (escaneado)" : "por el nombre") });
      reg.estado = "vinculado"; n++;
    } else if (!tipo) reg.estado = c.tipo === "informativo" || a?.tipo === "sin_efecto_contable" || !/\.pdf$/i.test(d.nombre) ? "sin efecto contable" : "sin clasificar";
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
