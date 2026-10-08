// «Hacer todo con la IA»: la app trabaja sola, en tu ordenador, en este orden:
//  1) lee las facturas recibidas y emitidas pendientes (con OCR si son escaneadas),
//  2) lee los documentos del banco, los renombra con tu formato y los puntea con su movimiento,
//  3) pone nombre con formato a las facturas que no lo tienen (sin perder lo ya leído o corregido),
//  4) revisa toda la carpeta de la empresa (escrituras, contratos…) y vincula lo que tiene efecto contable.
import { leerJSON, escribirJSON, num, sub, guardarLectura, marcarSinTexto, esPropia } from "./datos.js";
import { preguntarIA } from "../../ia-navegador.js";
import { renombrarArchivo } from "../../lib/renombrar.js";
import { revisarCarpeta } from "./inventario.js";

const FORMATO = /^\d{8} - /;
const limpio = (t) => String(t || "").replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
const aaaammdd = (f) => { const m = String(f || "").match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/); if (!m) return ""; const y = m[3].length === 2 ? "20" + m[3] : m[3]; return y + m[2].padStart(2, "0") + m[1].padStart(2, "0"); };
const eurNombre = (x) => Math.abs(num(x)).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ext = (n) => (n.match(/\.[^.]+$/) || [".pdf"])[0].toLowerCase();

const PROMPT_BANCO = `Eres contable. Este es un documento del banco de la empresa. Responde SOLO con JSON:
{"tipo":"justificante|extracto|liquidacion_intereses|certificado|contrato|recibo_impuesto|otro","fecha":"dd/mm/aaaa","importe":0,"signo":"cargo|abono","concepto":"","tercero":"","titulo":""}
Reglas: justificante = una transferencia, adeudo, recibo o cargo concreto (un solo movimiento); importe = el de ese movimiento (sin signo); tercero = beneficiario si es un pago, ordenante si es un cobro (no nuestra empresa ni el banco); concepto = muy corto (p. ej. «PRO 01115», «Provisión de fondos», «Gestión abril»). Si es un extracto con UN solo movimiento, trátalo como justificante. Si es certificado, contrato, liquidación de intereses u otro, pon un titulo corto en mayúsculas (p. ej. «CERTIFICADO DE SALDO Y TITULARIDAD») e importe 0 salvo que cobre o cargue algo. No inventes.
TEXTO:
`;

// Lectura sin IA de los formatos de Cajamar (respaldo)
function basicoBanco(t) {
  const f = (t.match(/(\d{2}[/-]\d{2}[/-]\d{4})/) || [])[1] || "";
  const imp = num((t.match(/(?:NOMINAL\s*:|IMPORTE\s*:?|EUR)\s*([\d.]+,\d{2})/i) || [])[1] || 0);
  const ter = (t.match(/(?:A FAVOR DE|BENEFICIARIO:|Ordenante\.*:)\s*([^\n]+)/i) || [])[1] || "";
  const con = (t.match(/(?:EN CONCEPTO DE:|CONCEPTO:|Concepto\.*:)\s*([^\n]+)/i) || [])[1] || "";
  const tipo = /liquidaci[oó]n de intereses/i.test(t) ? "liquidacion_intereses" : /certifica/i.test(t) ? "certificado" : imp ? "justificante" : "otro";
  return { tipo, fecha: f.replace(/-/g, "/"), importe: imp, signo: /ordenante|recibida|abono/i.test(t) ? "abono" : "cargo", concepto: con.trim(), tercero: ter.trim(), titulo: tipo === "liquidacion_intereses" ? "LIQUIDACIÓN DE INTERESES" : tipo === "certificado" ? "CERTIFICADO DEL BANCO" : "" };
}

async function leerDocBanco(file, nombre) {
  const { textoPDF, textoImagen } = await import("./leer.js");
  const t = /\.pdf$/i.test(nombre) ? await textoPDF(file, 2) : await textoImagen(file);
  if (t.replace(/\s/g, "").length < 30) return null;
  const b = basicoBanco(t);
  const r = await Promise.race([preguntarIA(PROMPT_BANCO + t.slice(0, 5000), { maxTokens: 250, json: true }), new Promise((ok) => setTimeout(() => ok({ estado: "tiempo" }), 90000))]);
  let d = null;
  if (r.estado === "ok") { try { d = JSON.parse(String(r.texto).match(/\{[\s\S]*\}/)[0]); } catch { d = null; } }
  return { ...b, ...(d || {}), importe: num(d?.importe) || b.importe, fecha: d?.fecha || b.fecha, metodo: d ? `IA (${r.ia})` : "lectura básica" };
}

function nombreBanco(d, actual) {
  const f = aaaammdd(d.fecha);
  if (!f) return null;
  if (d.tipo === "justificante" || d.tipo === "recibo_impuesto" || (d.tipo === "extracto" && d.importe)) {
    const txt = limpio([d.concepto, d.tercero].filter(Boolean).join(" ")).slice(0, 70) || "MOVIMIENTO";
    return `${f} - ${txt}-${eurNombre(d.importe)}${ext(actual)}`;
  }
  return `${f} - ${limpio(d.titulo || d.tipo).toUpperCase().slice(0, 70)}${ext(actual)}`;
}

// Misma clave que el motor para las asignaciones del banco
const claveMov = (m) => `${m.fecha}|${Math.round(num(m.importe) * 100) / 100}|${(m.concepto || "").slice(0, 60)}`;
// Cuenta del suelo comprado (existencias de una sociedad que promueve o revende): que el gestor la confirme
export const CTA_SUELO = "300";
const T = (tercero) => ({ tercero, esperaFactura: true });
const C = (cuenta, concepto) => ({ cuenta, concepto });
// Reglas para puntear: el concepto del banco dice a quién o qué es. Lo que no encaja se queda en 555 para revisar.
function regla(m) {
  const c = String(m.concepto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase(), cargo = m.importe < 0;
  if (cargo) {
    if (/ARRAS/.test(c)) return C("407", "Arras compra suelo Brunete");
    if (/COMPRA(VENTA)?\s+BRUNETE/.test(c)) return C(CTA_SUELO, "Compra suelo Brunete");
    if (/TRIBUTOS? COMUNIDAD|HACIENDA COMUNIDAD/.test(c)) return C(CTA_SUELO, "ITP compra suelo Brunete (mayor valor del suelo)");
    if (/CORREC+ION TRASPASO/.test(c)) return C("449", "Corrección aportación partícipe (cuentas en participación)");
    if (/^COMIS|COMISION (EMISION|TRANSFERENCIA|MANTENIMIENTO)|COMIS\.COMPRA/.test(c)) return C("626", "Comisión bancaria");
    if (/EURO ?I/.test(c)) return T("EuroIndian Ventures, S.L.U.");
    if (/PIRAMIDE|COMISION INTERMEDIACION|PAGO COMISION BRUNETE/.test(c)) return T("Piramide Arquitectos, S.L.");
    if (/NOTARI|FRANCISCO CONSE|PRO ?\/ ?\d{4,6}|FRA NO (PRO|AJE)|FACTURA +PRO|611834570200/.test(c)) return T("Notarios Serrano 41");
    if (/TOPOGRAF|ALCON/.test(c)) return T("David Alcón Martín");
    if (/SOLVE|PROVISION DE FONDOS/.test(c)) return T("Solve Abogados y Asesores Tributarios");
    if (/TASLIMA/.test(c)) return T("Taslima Telecom, S.L.");
    if (/JULIO SAN/.test(c)) return T("Julio San Segundo Miñana");
    if (/ANTHROPIC|CLAUDE/.test(c)) return T("Anthropic, PBC");
    if (/HOSTINGER/.test(c)) return T("Hostinger");
    if (/BASE44|WIX/.test(c)) return T("Base44 (Wix.com Ltd)");
    if (/WIRES/.test(c)) return T("WIRES Women in Real Estate Spain");
    if (/LA BOHEMIA/.test(c)) return C("629", "Comida La Bohemia (sin ticket: gasto entero, sin IVA)");
  } else {
    // Desembolsos de una ampliación de capital antes de inscribirla: capital emitido pendiente de inscripción (194).
    // Al inscribirse la escritura se pasa a capital social (100) y, si la hay, prima de emisión (110).
    if (/AMPLIACI.N DE CAP|AMPLIACION CAPITAL|PARTICIPACI.N EN BEATRIZ/.test(c)) return C("194", "Desembolso ampliación de capital (pendiente de inscripción)");
    if (/APORTACI/.test(c)) return C("449", "Aportación partícipe Brunete (cuentas en participación)");
    if (/DEVOLUCION|NOTARI|611834570200/.test(c)) return T("Notarios Serrano 41");
  }
  return null;
}

// Cambia el nombre de una factura y mueve con ella lo ya leído, lo corregido y su pago
async function moverClaves(raiz, viejo, nuevo, emitida) {
  const pref = emitida ? "facturas_emitidas/" : "facturas/";
  const c = await leerJSON(raiz, "cache_facturas.json", {});
  if (c[pref + viejo]) { c[pref + nuevo] = { ...c[pref + viejo], datos: c[pref + viejo].datos ? { ...c[pref + viejo].datos, archivo: nuevo } : null }; delete c[pref + viejo]; await escribirJSON(raiz, "cache_facturas.json", c); }
  for (const arch of [emitida ? "edits_emitidas.json" : "edits_facturas.json", "vincular.json"]) {
    const e = await leerJSON(raiz, arch, {});
    if (e[viejo]) { e[nuevo] = e[viejo]; delete e[viejo]; await escribirJSON(raiz, arch, e); }
  }
}

// «260424 - PIRAMIDE ARQUITECTOS, S.L. F2026 14.568,40.pdf»
const aammdd = (f) => aaaammdd(f).slice(2);
export const nombreFactura = (d, ter, extension) => `${aammdd(d.fecha)} - ${limpio(d[ter]).toUpperCase().slice(0, 60)}${d.numero ? " " + limpio(String(d.numero).replace(/[\\/]+/g, "-")).replace(/\s+/g, "").slice(0, 25) : ""} ${eurNombre(d.total)}${extension}`.replace(/\s+(?=\.)/, "");
export const formatoFactura = (n) => /^\d{6} - .+ \d{1,3}(\.\d{3})*,\d{2}\.[a-z0-9]+$/i.test(n);
export async function renombrarFacturas(raiz, emitida = false, errores = []) {
  const carpeta = emitida ? "facturas_emitidas" : "facturas", ter = emitida ? "cliente" : "proveedor";
  const cache = await leerJSON(raiz, "cache_facturas.json", {});
  const edits = await leerJSON(raiz, emitida ? "edits_emitidas.json" : "edits_facturas.json", {});
  const dir = await sub(raiz, carpeta);
  if (!dir) return 0;
  const lista = [];
  for await (const [n, h] of dir.entries()) if (h.kind === "file" && /\.(pdf|jpe?g|png)$/i.test(n)) lista.push(n);
  let k = 0;
  for (const n of lista) {
    const d = { ...(cache[carpeta + "/" + n]?.datos || {}), ...(edits[n] || {}) };
    if (d.noFactura || !d[ter] || !aammdd(d.fecha) || !num(d.total)) continue;
    const nuevo = nombreFactura({ ...d, total: num(d.total) }, ter, ext(n));
    if (nuevo === n) continue;
    try { const final = await renombrarArchivo(dir, n, nuevo); await moverClaves(raiz, n, final, emitida); k++; } catch (e) { errores.push(`${n}: ${e.message || e}`); }
  }
  return k;
}

export async function hacerTodo({ raiz, empresa, propia, datos, onPaso }) {
  const res = { facturas: 0, ocr: 0, ilegibles: 0, banco: 0, renombrados: 0, punteables: 0, inventario: null, errores: [] };
  const paso = (t) => onPaso?.(t);
  const { leerFactura } = await import("./leer.js");
  // 0) Traer del banco los movimientos nuevos (conexión que ya tenías en la app local)
  try { const b = await import("./banco.js"); if (await b.bancoConfigurado(raiz)) { paso("Trayendo los movimientos nuevos del banco…"); const x = await b.sincronizarBanco(raiz); res.bancoNuevos = x.nuevos; } } catch (e) { res.errores.push("Banco: " + (e.message || e)); }

  // 1) Facturas pendientes de leer
  for (const [lista, emitida] of [[datos.facturas, false], [datos.emitidas || [], true]]) {
    const pend = lista.filter((f) => !f._leida && !f.noFactura && !f._duplicadoDe && f._arch);
    for (let i = 0; i < pend.length; i++) {
      const f = pend[i];
      paso(`1/5 · Leyendo factura ${emitida ? "emitida " : ""}${i + 1} de ${pend.length}: ${f.archivo}`);
      try {
        const file = await f._arch.h.getFile();
        const r = await leerFactura(file, { propia, emitida });
        if (r.datos) { await guardarLectura(raiz, f.archivo, file.lastModified, { archivo: f.archivo, ...r.datos, ...(emitida ? { cuenta_pgc: "705" } : {}) }, emitida); res.facturas++; }
        else { await marcarSinTexto(raiz, f.archivo, file.lastModified, emitida); res.ilegibles++; }
      } catch (e) { res.errores.push(`${f.archivo}: ${e.message || e}`); }
    }
  }

  // 2) Documentos del banco: leer, renombrar y dejar fecha + importe para puntearlos con su movimiento
  const dirB = await sub(raiz, "documentos_banco");
  if (dirB) {
    const cacheB = await leerJSON(raiz, "cache_banco.json", {});
    const archivos = [];
    for await (const [n, h] of dirB.entries()) if (h.kind === "file" && /\.(pdf|jpe?g|png)$/i.test(n) && !n.startsWith("~$")) archivos.push([n, h]);
    const pend = archivos.filter(([n]) => !cacheB[n] && !cacheB["documentos_banco/" + n]);
    for (let i = 0; i < pend.length; i++) {
      const [n, h] = pend[i];
      paso(`2/5 · Leyendo documento del banco ${i + 1} de ${pend.length}: ${n}`);
      try {
        const d = await leerDocBanco(await h.getFile(), n);
        if (!d) { cacheB[n] = { datos: { tipo: "ilegible" } }; continue; }
        if (d.tercero && esPropia(d.tercero, "", propia)) d.tercero = "";
        let final = n;
        const nuevo = !FORMATO.test(n) || /^(documento|gestordocumental)/i.test(n) ? nombreBanco(d, n) : null;
        if (nuevo && nuevo !== n) { try { final = await renombrarArchivo(dirB, n, nuevo); res.renombrados++; } catch (e) { res.errores.push(`${n}: ${e.message || e}`); } }
        cacheB[final] = { _procesado: new Date().toLocaleString("es-ES"), datos: { fecha: d.fecha, importe: d.importe, concepto: d.concepto, tercero: d.tercero, tipo: d.tipo, metodo: d.metodo } };
        res.banco++; if (d.importe) res.punteables++;
        if (i % 5 === 4) await escribirJSON(raiz, "cache_banco.json", cacheB);
      } catch (e) { res.errores.push(`${n}: ${e.message || e}`); }
    }
    await escribirJSON(raiz, "cache_banco.json", cacheB);
  }

  // 3) Nombre de las facturas con tu formato: «AAMMDD - PROVEEDOR NºFACTURA IMPORTE.pdf» (en emitidas, el cliente)
  paso("3/5 · Poniendo a las facturas tu formato de nombre…");
  for (const emitida of [false, true]) { try { res.renombrados += await renombrarFacturas(raiz, emitida, res.errores); } catch (e) { res.errores.push(String(e.message || e)); } }

  // 4) Puntear el banco: cada movimiento sin factura emparejada va a su proveedor (para cuadrar por saldo) o a su cuenta
  paso("4/5 · Punteando el banco con sus documentos…");
  try {
    const asig = await leerJSON(raiz, "asignaciones_banco.json", {});
    let n = 0;
    for (const m of datos.movimientos || []) {
      if (m._factura || m._emitida) continue;
      const k = claveMov(m);
      if (asig[k]) continue;
      const r = regla(m);
      if (r) { asig[k] = { ...r, auto: true }; n++; }
    }
    if (n) await escribirJSON(raiz, "asignaciones_banco.json", asig);
    res.punteados = n;
  } catch (e) { res.errores.push("Puntear el banco: " + (e.message || e)); }

  // 5) Carpeta de la empresa: escrituras, contratos… (relee también lo que quedó pendiente)
  if (empresa) { paso("5/5 · Revisando la carpeta de la empresa…"); try { res.inventario = await revisarCarpeta({ empresa, raiz, propia, reintentar: true, onPaso: (t) => paso("5/5 · " + t) }); } catch (e) { res.errores.push("Carpeta de la empresa: " + (e.message || e)); } }
  paso("");
  return res;
}
