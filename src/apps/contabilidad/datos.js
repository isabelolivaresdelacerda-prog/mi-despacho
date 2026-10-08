// Contabilidad en el navegador sobre la carpeta de la empresa (OneDrive / Google Drive sincronizados en el PC).
// Los documentos NO salen del ordenador: la app lee y escribe directamente en la carpeta.
// Usa los mismos archivos que la app de escritorio (programa/*.json), así las dos son compatibles.

const DB = "md-contabilidad", STORE = "h", KEY = "carpeta";
function idb(modo, fn) {
  return new Promise((ok, ko) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onerror = () => ko(r.error);
    r.onsuccess = () => { const tx = r.result.transaction(STORE, modo); const q = fn(tx.objectStore(STORE)); tx.oncomplete = () => ok(q?.result); tx.onerror = () => ko(tx.error); };
  });
}
export const soportado = () => typeof window !== "undefined" && "showDirectoryPicker" in window;
export async function carpetaGuardada() { try { return await idb("readonly", (s) => s.get(KEY)); } catch { return null; } }
export async function elegirCarpeta() {
  const h = await window.showDirectoryPicker({ id: "md-contabilidad", mode: "readwrite" });
  try { await idb("readwrite", (s) => s.put(h, KEY)); } catch { /* nada */ }
  return h;
}
export async function olvidarCarpeta() { try { await idb("readwrite", (s) => s.delete(KEY)); } catch { /* nada */ } }
export async function permiso(h, pedir = true) {
  if ((await h.queryPermission({ mode: "readwrite" })) === "granted") return true;
  return pedir && (await h.requestPermission({ mode: "readwrite" })) === "granted";
}

// Carpetas de documentos que entiende la app
export const CARPETAS = [
  { id: "facturas", nombre: "Facturas recibidas" },
  { id: "facturas_emitidas", nombre: "Facturas emitidas" },
  { id: "documentos_banco", nombre: "Justificantes de banco" },
  { id: "extractos", nombre: "Extractos" },
  { id: "contratos", nombre: "Contratos" },
  { id: "escrituras", nombre: "Escrituras" },
  { id: "impuestos", nombre: "Impuestos" },
  { id: "seguros", nombre: "Seguros" },
];

async function sub(dir, nombre, crear = false) {
  try { return await dir.getDirectoryHandle(nombre, { create: crear }); } catch { return null; }
}
export async function listar(raiz, carpeta) {
  const d = await sub(raiz, carpeta);
  if (!d) return [];
  const out = [];
  for await (const [nombre, h] of d.entries()) {
    if (h.kind !== "file" || nombre.startsWith("~$") || nombre.startsWith(".")) continue;
    const f = await h.getFile();
    out.push({ nombre, tam: f.size, mtime: f.lastModified, h });
  }
  return out.sort((a, b) => b.mtime - a.mtime);
}
export async function abrir(arch) {
  const f = await arch.h.getFile();
  const url = URL.createObjectURL(f);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export async function subir(raiz, carpeta, files) {
  const d = await sub(raiz, carpeta, true);
  const hechos = [];
  for (const f of files) {
    const [base, ext] = f.name.match(/^(.*?)(\.[^.]+)?$/).slice(1);
    let nombre = f.name;
    for (let i = 2; i < 100; i++) { try { await d.getFileHandle(nombre); nombre = `${base} (${i})${ext || ""}`; } catch { break; } }
    const w = await (await d.getFileHandle(nombre, { create: true })).createWritable();
    await w.write(f); await w.close();
    hechos.push(nombre);
  }
  return hechos;
}

// ---- datos internos (carpeta "programa") ----
async function dirEstado(raiz) { return (await sub(raiz, "programa")) || raiz; }
export async function leerJSON(raiz, nombre, defecto) {
  try {
    const d = await dirEstado(raiz);
    const t = await (await (await d.getFileHandle(nombre)).getFile()).text();
    return JSON.parse(t);
  } catch { return defecto; }
}
export async function escribirJSON(raiz, nombre, datos) {
  const d = await dirEstado(raiz);
  const w = await (await d.getFileHandle(nombre, { create: true })).createWritable();
  await w.write(JSON.stringify(datos, null, 1)); await w.close();
}

// ---- utilidades ----
export const num = (v) => { if (typeof v === "number") return v; const s = String(v ?? "").replace(/[€\s]/g, ""); const n = parseFloat(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s); return isNaN(n) ? 0 : n; };
export const eur = (v) => num(v).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
export function fechaOrden(f) {
  const m = String(f || "").match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (!m) return "9999-99-99";
  const y = m[3].length === 2 ? "20" + m[3] : m[3];
  return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}
export function trimestre(f) { const o = fechaOrden(f); if (o.startsWith("9999")) return null; return { anio: +o.slice(0, 4), t: Math.floor((+o.slice(5, 7) - 1) / 3) + 1 }; }

// Cuentas del PGC por palabras clave (las mismas reglas que la app de escritorio)
const REGLAS = [
  [["notari"], "623"], [["abogad", "solve", "letrad"], "623"], [["arquitect", "topograf", "cartograf", "alcon"], "623"],
  [["piramide", "pirámide"], "623"], [["comision", "comisión", "intermediaci"], "620"], [["arras"], "181"],
  [["aportacion", "aportación", "capital", "ampliacion", "ampliación"], "118"], [["hostinger", "claude", "anthropic", "subscription", "web", "wix"], "629"],
  [["registro mercantil", "registro de la propiedad"], "623"], [["provision", "provisión"], "410"], [["gestion", "gestión"], "629"],
];
export const TITULOS_PGC = { "118": "Aportaciones de socios", "181": "Anticipos de clientes a l/p", "410": "Acreedores por prestaciones de servicios", "620": "Gastos en promociones inmobiliarias", "623": "Servicios de profesionales independientes", "624": "Transportes", "625": "Primas de seguros", "626": "Servicios bancarios", "627": "Publicidad y relaciones públicas", "628": "Suministros", "629": "Otros servicios", "631": "Otros tributos" };
export function asignarCuenta(texto) {
  const sin = (x) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const t = sin(String(texto || ""));
  for (const [k, c] of REGLAS) if (k.some((x) => t.includes(sin(x)))) return c;
  return "629";
}

// ---- carga completa ----
export async function cargarTodo(raiz) {
  const [cacheF, editsF, cacheIA, cacheB, extractoApi, vincular, empresa, capital] = await Promise.all([
    leerJSON(raiz, "cache_facturas.json", {}), leerJSON(raiz, "edits_facturas.json", {}),
    leerJSON(raiz, "cache_ia_documentos.json", {}), leerJSON(raiz, "cache_banco.json", {}),
    leerJSON(raiz, "extracto_api.json", { movimientos: [] }), leerJSON(raiz, "vincular.json", {}),
    leerJSON(raiz, "empresa.json", {}), leerJSON(raiz, "capital_social.json", null),
  ]);
  const archivosF = await listar(raiz, "facturas");
  const facturas = archivosF.filter((a) => /\.(pdf|jpe?g|png)$/i.test(a.nombre)).map((a) => {
    const base = cacheF["facturas/" + a.nombre]?.datos || cacheIA["factura:" + a.nombre]?.datos || null;
    const ed = editsF[a.nombre] || {};
    const d = { archivo: a.nombre, ...(base || {}), ...ed };
    ["base", "iva_pct", "iva_importe", "retencion_pct", "retencion_importe", "total"].forEach((k) => (d[k] = num(d[k])));
    if (!d.total && (d.base || d.iva_importe)) d.total = +(d.base + d.iva_importe - d.retencion_importe).toFixed(2);
    if (!d.base && d.total) d.base = +(d.total - d.iva_importe + d.retencion_importe).toFixed(2);
    d.cuenta_pgc = d.cuenta_pgc || asignarCuenta((d.proveedor || "") + " " + a.nombre);
    d._leida = !!base || !!(ed.total || ed.proveedor);
    d._editada = Object.keys(ed).length > 0;
    d._arch = a;
    return d;
  });
  const movimientos = (extractoApi.movimientos || []).map((m, i) => ({ ...m, importe: num(m.importe), _id: i }));
  // Conciliación sencilla: vínculo manual o movimiento con el mismo importe (pago) a partir de la fecha de la factura
  const usados = new Set();
  for (const f of facturas.sort((a, b) => fechaOrden(a.fecha).localeCompare(fechaOrden(b.fecha)))) {
    const v = vincular[f.archivo];
    if (v) { f._pago = { fecha: v.fecha, texto: v.descripcion, manual: true }; continue; }
    if (!f.total) continue;
    const m = movimientos.find((x) => !usados.has(x._id) && x.importe < 0 && Math.abs(Math.abs(x.importe) - f.total) < 0.011 && fechaOrden(x.fecha) >= fechaOrden(f.fecha));
    if (m) { usados.add(m._id); m._factura = f.archivo; f._pago = { fecha: m.fecha, texto: m.concepto }; }
  }
  return { facturas, movimientos, empresa, capital, cacheF, editsF, vincular, docsBanco: Object.values(cacheB) };
}

// Guarda una corrección manual (compatible con la app de escritorio)
export async function guardarEdicion(raiz, archivo, cambios) {
  const e = await leerJSON(raiz, "edits_facturas.json", {});
  e[archivo] = { ...(e[archivo] || {}), ...cambios };
  await escribirJSON(raiz, "edits_facturas.json", e);
}
export async function guardarLectura(raiz, archivo, mtime, datos) {
  const c = await leerJSON(raiz, "cache_facturas.json", {});
  c["facturas/" + archivo] = { _mtime: mtime / 1000, _parser_version: "web-v1", _procesado: new Date().toLocaleString("es-ES"), datos };
  await escribirJSON(raiz, "cache_facturas.json", c);
}
export async function guardarVinculo(raiz, archivo, v) {
  const x = await leerJSON(raiz, "vincular.json", {});
  if (v) x[archivo] = v; else delete x[archivo];
  await escribirJSON(raiz, "vincular.json", x);
}

// ---- exportaciones (CSV con ; y BOM: se abre directamente en Excel y se importa en A3) ----
const csv = (filas) => "﻿" + filas.map((r) => r.map((c) => { const s = typeof c === "number" ? c.toFixed(2).replace(".", ",") : String(c ?? ""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(";")).join("\r\n");
export function libroFacturasCSV(facturas) {
  return csv([["Fecha", "Número", "Proveedor", "NIF", "Base", "% IVA", "Cuota IVA", "% Retención", "Retención", "Total", "Cuenta PGC", "Pagada", "Archivo"],
    ...facturas.map((f) => [f.fecha, f.numero, f.proveedor, f.nif_proveedor || f.nif_emisor, f.base, f.iva_pct, f.iva_importe, f.retencion_pct, f.retencion_importe, f.total, f.cuenta_pgc, f._pago ? "Sí" : "No", f.archivo])]);
}
export function diarioCSV(facturas) {
  // Asiento por factura: gasto + IVA soportado al debe; retención y acreedor al haber
  const filas = [["Asiento", "Fecha", "Cuenta", "Concepto", "Debe", "Haber", "Documento"]];
  let n = 0;
  for (const f of facturas.filter((x) => x.total)) {
    n++;
    const c = `${f.proveedor || ""} ${f.numero || ""}`.trim();
    filas.push([String(n), f.fecha, f.cuenta_pgc, c, f.base, "", f.archivo]);
    if (f.iva_importe) filas.push([String(n), f.fecha, "472", "IVA soportado " + c, f.iva_importe, "", f.archivo]);
    if (f.retencion_importe) filas.push([String(n), f.fecha, "4751", "Retención " + c, "", f.retencion_importe, f.archivo]);
    filas.push([String(n), f.fecha, "410", c, "", f.total, f.archivo]);
  }
  return csv(filas);
}
export function descargarTexto(texto, nombre) {
  const url = URL.createObjectURL(new Blob([texto], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
