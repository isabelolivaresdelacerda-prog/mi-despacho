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
  { id: "entrada", nombre: "Bandeja de entrada (correo)" },
  { id: "facturas", nombre: "Facturas recibidas" },
  { id: "facturas_emitidas", nombre: "Facturas emitidas" },
  { id: "documentos_banco", nombre: "Justificantes de banco" },
  { id: "extractos", nombre: "Extractos" },
  { id: "contratos", nombre: "Contratos" },
  { id: "escrituras", nombre: "Escrituras" },
  { id: "impuestos", nombre: "Impuestos" },
  { id: "seguros", nombre: "Seguros" },
];

export async function sub(dir, nombre, crear = false) {
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
export async function dirEstado(raiz) { return (await sub(raiz, "programa")) || raiz; }
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
function prepararFactura(a, base, ed, cuentaDefecto, tercero) {
  const d = { archivo: a.nombre, ...(base || {}), ...ed };
  ["base", "iva_pct", "iva_importe", "retencion_pct", "retencion_importe", "total"].forEach((k) => (d[k] = num(d[k])));
  if (!d.total && (d.base || d.iva_importe)) d.total = +(d.base + d.iva_importe - d.retencion_importe).toFixed(2);
  if (!d.base && d.total) d.base = +(d.total - d.iva_importe + d.retencion_importe).toFixed(2);
  d.cuenta_pgc = d.cuenta_pgc || cuentaDefecto(d);
  d._leida = !!base || !!(ed.total || ed[tercero]);
  d._editada = Object.keys(ed).length > 0;
  d._arch = a;
  return d;
}
const esDoc = (a) => /\.(pdf|jpe?g|png)$/i.test(a.nombre);

// Importe que aparece en el nombre de un archivo: "transferencia 1.234,56.pdf", "adeudo 106.00 €.pdf"
export function importeEnNombre(nombre) {
  return [...String(nombre).matchAll(/(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2})(?!\d)/g)].map((m) => num(m[1].includes(",") ? m[1] : m[1].replace(".", ",")));
}

// Movimiento del banco que paga (o cobra) una factura: mismo importe, desde 60 días antes de la factura hasta 1 año después;
// si hay varios, el que lleva el nombre del tercero en el concepto y luego el más cercano en fecha.
const palabras = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().split(/[^A-Z0-9]+/).filter((w) => w.length >= 4 && !/^(SL|SLU|SA|SERVICIOS|GESTION|ABOGADOS|DAVID|MARIA|JOSE)$/.test(w));
function mejorMovimiento(movimientos, usados, total, signo, fecha, tercero) {
  const f0 = Date.parse(fechaOrden(fecha)) || 0, pal = palabras(tercero);
  const cand = movimientos.filter((x) => !usados.has(x._id) && Math.sign(x.importe) === signo && Math.abs(Math.abs(x.importe) - total) < 0.011)
    .map((x) => { const dias = ((Date.parse(fechaOrden(x.fecha)) || 0) - f0) / 86400000; const c = palabras(x.concepto).join(" "); return { x, dias, nombre: pal.some((w) => c.includes(w)) }; })
    .filter((c) => c.dias >= -60 && c.dias <= 366);
  cand.sort((a, b) => (b.nombre - a.nombre) || (Math.abs(a.dias) - Math.abs(b.dias)));
  return cand[0]?.x || null;
}

// Movimiento que lleva en el concepto el número de la factura («FRA PRO 05207», «Factura 0716-26», «PRO5337»…)
function porNumero(movimientos, usados, numero, signo, fecha, total) {
  const grupos = String(numero || "").match(/\d+/g) || [];
  const utiles = grupos.map((g) => g.replace(/^0+/, "")).filter((g) => g.length >= 3 && !/^20[2-3]\d$/.test(g));
  // Si el número es corto («PROY-005/2026»), se busca con sus letras: «PROY005»
  const alnum = String(numero || "").toUpperCase().replace(/[/-]20[2-3]\d$/, "").replace(/[^A-Z0-9]/g, "");
  if (!utiles.length && !(alnum.length >= 6 && /[A-Z]/.test(alnum) && /\d/.test(alnum))) return null;
  const clave = utiles.sort((a, b) => b.length - a.length)[0];
  const re = clave ? new RegExp(`(?<!\\d)0*${clave}(?!\\d)`) : { test: (t) => t.toUpperCase().replace(/[^A-Z0-9]/g, "").includes(alnum) };
  const f0 = Date.parse(fechaOrden(fecha)) || 0;
  const cand = movimientos.filter((x) => !usados.has(x._id) && Math.sign(x.importe) === signo && re.test(String(x.concepto || "").replace(/[\s/.-]/g, " ").replace(/([A-Z])\s+(\d)/gi, "$1$2")))
    .map((x) => ({ x, dias: ((Date.parse(fechaOrden(x.fecha)) || 0) - f0) / 86400000 }))
    .filter((c) => c.dias >= -30 && c.dias <= 400)
    .sort((a, b) => Math.abs(Math.abs(a.x.importe) - total) - Math.abs(Math.abs(b.x.importe) - total) || Math.abs(a.dias) - Math.abs(b.dias));
  return cand[0]?.x || null;
}

export async function cargarTodo(raiz) {
  const [cacheF, editsF, editsE, cacheIA, cacheB, extractoApi, vincular, empresa, capital, justManual] = await Promise.all([
    leerJSON(raiz, "cache_facturas.json", {}), leerJSON(raiz, "edits_facturas.json", {}), leerJSON(raiz, "edits_emitidas.json", {}),
    leerJSON(raiz, "cache_ia_documentos.json", {}), leerJSON(raiz, "cache_banco.json", {}),
    leerJSON(raiz, "extracto_api.json", { movimientos: [] }), leerJSON(raiz, "vincular.json", {}),
    leerJSON(raiz, "empresa.json", {}), leerJSON(raiz, "capital_social.json", null), leerJSON(raiz, "justificantes_banco.json", {}),
  ]);
  const [archivosF, archivosE, archivosB] = await Promise.all([listar(raiz, "facturas"), listar(raiz, "facturas_emitidas"), listar(raiz, "documentos_banco")]);
  const facturas = archivosF.filter(esDoc).map((a) => { const d = prepararFactura(a, cacheF["facturas/" + a.nombre]?.datos || cacheIA["factura:" + a.nombre]?.datos || null, editsF[a.nombre] || {}, (d) => asignarCuenta((d.proveedor || "") + " " + a.nombre), "proveedor"); d._sinTexto = !d._leida && !!cacheF["facturas/" + a.nombre]?.ocr; return d; });
  const emitidas = archivosE.filter(esDoc).map((a) => {
    const d = prepararFactura(a, cacheF["facturas_emitidas/" + a.nombre]?.datos || null, editsE[a.nombre] || {}, () => "705", "cliente");
    d.emitida = true;
    d._sinTexto = !d._leida && !!cacheF["facturas_emitidas/" + a.nombre]?.ocr;
    return d;
  });
  // Movimientos: los de la conexión con el banco + los de los extractos en Excel que la conexión no trae (más antiguos)
  let extractos = [];
  try { const b = await import("./banco.js"); extractos = b.juntarMovimientos(extractoApi.movimientos || [], await b.leerExtractos(raiz)); } catch { extractos = extractoApi.movimientos || []; }
  const movimientos = extractos.map((m, i) => ({ ...m, importe: num(m.importe), _id: i }));
  // Conciliación sencilla: vínculo manual o movimiento con el mismo importe (pago) a partir de la fecha de la factura
  const usados = new Set();
  for (const f of facturas.sort((a, b) => fechaOrden(a.fecha).localeCompare(fechaOrden(b.fecha)))) {
    const v = vincular[f.archivo];
    // Pago elegido a mano en el extracto: se casa con ese movimiento del banco (no es un pago «por otra vía»)
    if (v?.clave_banco) {
      const m = movimientos.find((x) => !usados.has(x._id) && claveMovDatos(x) === v.clave_banco) || movimientos.find((x) => !usados.has(x._id) && x.fecha === v.fecha && Math.abs(Math.abs(x.importe) - Math.abs(num(v.importe))) < 0.011);
      if (m) { usados.add(m._id); m._factura = f.archivo; f._pago = { fecha: m.fecha, texto: m.concepto, elegido: true }; continue; }
    }
    if (v && !v.clave_banco) { f._pago = { fecha: v.fecha, texto: v.descripcion, manual: true }; continue; }
    if (!f.total) continue;
    // 1º por el número de factura escrito en el concepto del banco (aunque el importe no coincida: se avisa de la diferencia)
    let m = porNumero(movimientos, usados, f.numero, -1, f.fecha, f.total);
    if (!m) m = mejorMovimiento(movimientos, usados, f.total, -1, f.fecha, f.proveedor);
    if (m) { usados.add(m._id); m._factura = f.archivo; const dif = Math.round((Math.abs(m.importe) - f.total) * 100) / 100; f._pago = { fecha: m.fecha, texto: m.concepto, importe: Math.abs(m.importe), ...(Math.abs(dif) >= 0.01 ? { dif } : {}) }; }
  }
  // Cobros de las facturas emitidas
  for (const f of emitidas.sort((a, b) => fechaOrden(a.fecha).localeCompare(fechaOrden(b.fecha)))) {
    if (!f.total) continue;
    const m = porNumero(movimientos, usados, f.numero, 1, f.fecha, f.total) || mejorMovimiento(movimientos, usados, f.total, 1, f.fecha, f.cliente);
    if (m) { usados.add(m._id); m._emitida = f.archivo; f._cobro = { fecha: m.fecha, texto: m.concepto }; }
  }
  // Justificantes individuales del banco (adeudos, transferencias, recibos) en «documentos_banco»
  const datosB = (a) => { const c = cacheB[a.nombre] || cacheB["documentos_banco/" + a.nombre]; const x = c?.datos || c || {}; return { fecha: x.fecha || "", importe: Math.abs(num(x.importe ?? x.total ?? 0)) }; };
  const justif = archivosB.filter(esDoc).map((a) => ({ nombre: a.nombre, arch: a, ...datosB(a), enNombre: importeEnNombre(a.nombre) }));
  const usadosJ = new Set(Object.values(justManual));
  // Se casan por cercanía: primero todas las parejas posibles (mismo importe y fecha a ≤5 días, o importe en el nombre del
  // archivo y fecha a ≤10 días) y luego se asignan de la más cercana a la más lejana, para que un pago de abril no se
  // quede con el justificante de uno de junio del mismo importe.
  const dias = (a, b) => (a && b ? Math.abs((Date.parse(fechaOrden(a)) - Date.parse(fechaOrden(b))) / 86400000) : 99);
  const fechaNombre = (n) => { const m = String(n).match(/^(\d{2})(\d{2})(\d{2})\s*-/); return m ? `${m[3]}/${m[2]}/20${m[1]}` : ""; };
  const parejas = [];
  for (const m of movimientos) {
    const man = justManual[claveMovDatos(m)];
    if (man) { m._justificante = man === "__no__" ? { no: true } : { nombre: man, manual: true }; continue; }
    const imp = Math.abs(m.importe);
    for (const x of justif) {
      if (usadosJ.has(x.nombre)) continue;
      const d = dias(x.fecha || fechaNombre(x.nombre), m.fecha);
      if (x.importe && Math.abs(x.importe - imp) < 0.011 && d <= 5) parejas.push({ m, x, d });
      else if (x.enNombre.some((v) => Math.abs(v - imp) < 0.011) && d <= 10) parejas.push({ m, x, d: d + 0.5 });
    }
  }
  parejas.sort((a, b) => a.d - b.d);
  for (const { m, x } of parejas) { if (m._justificante || usadosJ.has(x.nombre)) continue; usadosJ.add(x.nombre); m._justificante = { nombre: x.nombre }; }
  // Compras con tarjeta, comisiones, recibos e impuestos no tienen documento individual: su justificante es el extracto
  // mensual del banco que los recoge (el primero con fecha igual o posterior al movimiento, como mucho 40 días después).
  const extractosDoc = archivosB.filter(esDoc).map((a) => { const c = cacheB[a.nombre]?.datos || {}; return { nombre: a.nombre, fecha: c.fecha || "", tipo: c.tipo || (/extracto/i.test(a.nombre) ? "extracto" : "") }; })
    .filter((x) => x.tipo === "extracto" && x.fecha).sort((a, b) => fechaOrden(a.fecha).localeCompare(fechaOrden(b.fecha)));
  for (const m of movimientos) {
    if (m._justificante || !/OP\.?TARJ|COMIS|RECIBO|HACIENDA|TRIBUTO|LIQUIDACION/i.test(m.concepto || "")) continue;
    const fm = fechaOrden(m.fecha);
    const e = extractosDoc.find((x) => fechaOrden(x.fecha) >= fm && (Date.parse(fechaOrden(x.fecha)) - Date.parse(fm)) / 86400000 <= 40);
    if (e) m._justificante = { nombre: e.nombre, extracto: true };
  }
  return { facturas, emitidas, movimientos, justificantes: justif, empresa, capital, cacheF, editsF, vincular, justManual, docsBanco: Object.values(cacheB) };
}
// Facturas en las que la IA ha confundido emisor y receptor: si el «proveedor» de una factura recibida es la propia empresa
// (o el «cliente» de una emitida), se intercambian los papeles y se marca para revisar.
const sinSignos = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\b(S\.?L\.?U?|S\.?A\.?)\b/g, "").replace(/[^A-Z0-9]/g, "");
// Distancia de edición (para nombres mal escritos: «BEATRIZ INVERIOSNES» = «BEATRIZ INVERSIONES»)
function distancia(a, b) {
  if (Math.abs(a.length - b.length) > 3) return 99;
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) { let prev = d[0]; d[0] = i; for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; } }
  return d[b.length];
}
export function esPropia(nombre, nif, propia) {
  if (!propia) return false;
  const n = sinSignos(nombre), p = sinSignos(propia.nombre), c = sinSignos(propia.cif);
  return (!!c && sinSignos(nif).replace(/^([A-Z])(\d{8})$/, "$1$2") === c) || (!!p && p.length >= 4 && !!n && (n.includes(p) || p.includes(n) && n.length >= 6 || (p.length >= 10 && distancia(n.slice(0, p.length + 2), p) <= 3)));
}
const ibanN = (t) => String(t || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
export function corregirPropia(datos, propia) {
  if (!propia || !datos) return datos;
  const swap = (f, a, na, b, nb) => ({ ...f, [a]: f[b] || "", [na]: f[nb] || "", [b]: f[a], [nb]: f[na], _papelesCambiados: true });
  // IBAN de cobro → proveedor, aprendido de las facturas bien leídas (sirve para las que no ponen el nombre del emisor, como las de Solve)
  const porIban = {};
  for (const f of datos.facturas) if (f.iban_proveedor && f.proveedor && !esPropia(f.proveedor, f.nif_proveedor, propia)) porIban[ibanN(f.iban_proveedor)] = { proveedor: f.proveedor, nif_proveedor: f.nif_proveedor || "" };
  let facturas = datos.facturas.map((f) => {
    if (!esPropia(f.proveedor, f.nif_proveedor, propia)) return f;
    const k = porIban[ibanN(f.iban_proveedor)];
    if (k) return { ...f, ...k, cliente: propia.nombre, nif_cliente: propia.cif || "", _papelesCambiados: true };
    return f.cliente && !esPropia(f.cliente, f.nif_cliente, propia) ? swap(f, "proveedor", "nif_proveedor", "cliente", "nif_cliente") : { ...f, _proveedorPropio: true };
  });
  facturas = marcarDuplicadas(facturas, "proveedor");
  const emitidas = marcarDuplicadas((datos.emitidas || []).map((f) => (esPropia(f.cliente, f.nif_cliente, propia) ? (f.proveedor && !esPropia(f.proveedor, f.nif_proveedor, propia) ? swap(f, "cliente", "nif_cliente", "proveedor", "nif_proveedor") : { ...f, _proveedorPropio: true }) : f)), "cliente");
  return { ...datos, facturas, emitidas };
}
// La misma factura guardada dos veces (mismo número e importe, o mismo archivo con otro nombre): se queda la que tiene
// el nombre con formato de fecha y la otra se marca como duplicada y no entra en los libros.
function marcarDuplicadas(lista, ter) {
  const orden = [...lista].sort((a, b) => (/^\d{6,8} - /.test(b.archivo) - /^\d{6,8} - /.test(a.archivo)) || a.archivo.localeCompare(b.archivo));
  const vistos = new Map(), dup = new Map();
  for (const f of orden) {
    const numero = String(f.numero || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    // Mismo proveedor y mismo número de factura = la misma factura (aunque una copia se haya leído con otro importe)
    const prov = String(f[ter] || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    const claves = [numero && numero.length >= 3 ? `n|${prov}|${numero}` : null, f._arch?.tam ? `s|${f._arch.tam}` : null].filter(Boolean);
    const ya = claves.map((k) => vistos.get(k)).find(Boolean);
    if (ya && ya !== f.archivo) dup.set(f.archivo, ya); else claves.forEach((k) => vistos.set(k, f.archivo));
  }
  return lista.map((f) => (dup.has(f.archivo) ? { ...f, _duplicadoDe: dup.get(f.archivo) } : f));
}

// Misma clave que el motor (fecha|importe|concepto) para guardar asociaciones a mano
export const claveMovDatos = (m) => `${m.fecha}|${Math.round(num(m.importe) * 100) / 100}|${(m.concepto || "").slice(0, 60)}`;
export async function guardarJustificante(raiz, m, nombre) {
  const x = await leerJSON(raiz, "justificantes_banco.json", {});
  if (nombre) x[claveMovDatos(m)] = nombre; else delete x[claveMovDatos(m)];
  await escribirJSON(raiz, "justificantes_banco.json", x);
}

// Guarda una corrección manual (compatible con la app de escritorio)
// PDF escaneado sin texto: se anota para no volver a ofrecer leerlo; hay que rellenarlo a mano
export async function marcarSinTexto(raiz, archivo, mtime, emitida = false) {
  const c = await leerJSON(raiz, "cache_facturas.json", {});
  c[(emitida ? "facturas_emitidas/" : "facturas/") + archivo] = { _mtime: mtime / 1000, _parser_version: "web-ocr-v1", sin_texto: true, ocr: true, datos: null };
  await escribirJSON(raiz, "cache_facturas.json", c);
}
export async function guardarEdicion(raiz, archivo, cambios, emitida = false) {
  const n = emitida ? "edits_emitidas.json" : "edits_facturas.json";
  const e = await leerJSON(raiz, n, {});
  e[archivo] = { ...(e[archivo] || {}), ...cambios };
  await escribirJSON(raiz, n, e);
}
export async function guardarLectura(raiz, archivo, mtime, datos, emitida = false) {
  const c = await leerJSON(raiz, "cache_facturas.json", {});
  c[(emitida ? "facturas_emitidas/" : "facturas/") + archivo] = { _mtime: mtime / 1000, _parser_version: "web-v1", _procesado: new Date().toLocaleString("es-ES"), datos };
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
export function libroEmitidasCSV(facturas) {
  return csv([["Fecha", "Número", "Cliente", "NIF", "Base", "% IVA", "Cuota IVA", "% Retención", "Retención", "Total", "Cuenta PGC", "Cobrada", "Archivo"],
    ...facturas.map((f) => [f.fecha, f.numero, f.cliente, f.nif_cliente, f.base, f.iva_pct, f.iva_importe, f.retencion_pct, f.retencion_importe, f.total, f.cuenta_pgc, f._cobro ? "Sí" : "No", f.archivo])]);
}
export { csv };
export function diarioCSV(facturas, vinculados = []) {
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
  const av = asientosVinculados(vinculados);
  for (let i = 0; i < av.length; i += 2) { n++; filas.push([String(n), ...av[i]]); filas.push([String(n), ...av[i + 1]]); }
  return csv(filas);
}
export function descargarTexto(texto, nombre) {
  const url = URL.createObjectURL(new Blob([texto], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ---- Documentos vinculados: escrituras, contratos, préstamos… que viven en su carpeta (001, 002, 003…)
// La contabilidad solo guarda la referencia (ruta) y los datos contables. No se duplica el archivo.
export const TIPOS_VINCULO = {
  constitucion: { nombre: "Escritura de constitución", cuenta: "100", signo: 1, periodico: false },
  ampliacion: { nombre: "Ampliación de capital", cuenta: "100", signo: 1, periodico: false },
  aportacion: { nombre: "Aportación de socios", cuenta: "118", signo: 1, periodico: false },
  prestamo_recibido: { nombre: "Préstamo recibido", cuenta: "170", signo: 1, periodico: false },
  arras: { nombre: "Arras entregadas", cuenta: "407", signo: -1, periodico: false },
  compraventa: { nombre: "Compraventa de un activo", cuenta: "300", signo: -1, periodico: false },
  contrato_pago: { nombre: "Contrato con pagos periódicos", cuenta: "629", signo: -1, periodico: true },
  contrato_cobro: { nombre: "Contrato con cobros periódicos (alquiler, servicios)", cuenta: "752", signo: 1, periodico: true },
  cuotas_prestamo: { nombre: "Cuotas de préstamo", cuenta: "170", signo: -1, periodico: true },
  seguro: { nombre: "Póliza de seguro", cuenta: "625", signo: -1, periodico: true },
  otro: { nombre: "Otro documento con importe", cuenta: "", signo: -1, periodico: false },
};
export const PERIODOS = { mensual: 1, trimestral: 3, semestral: 6, anual: 12 };

export async function leerVinculados(raiz) { return leerJSON(raiz, "documentos_vinculados.json", []); }
export async function guardarVinculados(raiz, lista) { return escribirJSON(raiz, "documentos_vinculados.json", lista); }

// Abre un archivo vinculado a partir de su ruta dentro de la carpeta de la empresa
export async function abrirVinculado(empresa, v) {
  let d = empresa;
  for (const p of v.ruta) d = await d.getDirectoryHandle(p);
  const f = await (await d.getFileHandle(v.archivo)).getFile();
  const url = URL.createObjectURL(f); window.open(url, "_blank", "noopener"); setTimeout(() => URL.revokeObjectURL(url), 60000);
}

const aISO = (f) => fechaOrden(f);
const deISO = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
function sumarMeses(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const ult = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(d, ult)).padStart(2, "0")}`;
}
const dias = (a, b) => Math.abs((Date.parse(a) - Date.parse(b)) / 86400000);

// Calendario de vencimientos de un contrato periódico hasta hoy, cruzado con el banco
export function vencimientos(v, movimientos, hoy = new Date().toISOString().slice(0, 10)) {
  if (!TIPOS_VINCULO[v.tipo]?.periodico || !v.inicio || !v.importe) return [];
  const paso = PERIODOS[v.periodicidad] || 1;
  const fin = v.fin ? aISO(v.fin) : hoy;
  const out = []; const usados = new Set();
  const signo = TIPOS_VINCULO[v.tipo].signo;
  for (let f = aISO(v.inicio), i = 0; f <= fin && f <= hoy && i < 240; f = sumarMeses(aISO(v.inicio), paso * ++i)) {
    const m = movimientos.find((x) => !usados.has(x._id) && Math.sign(x.importe) === signo && Math.abs(Math.abs(x.importe) - num(v.importe)) < 0.011 && dias(aISO(x.fecha), f) <= 10);
    if (m) usados.add(m._id);
    out.push({ fecha: deISO(f), importe: num(v.importe), mov: m || null });
  }
  return out;
}

// Asientos de los documentos vinculados no periódicos (capital, préstamos, arras…)
export function asientosVinculados(vinculados) {
  const filas = [];
  for (const v of vinculados) {
    const t = TIPOS_VINCULO[v.tipo];
    if (!t || t.periodico || !num(v.importe) || !t.cuenta) continue;
    const c = `${t.nombre}${v.tercero ? " – " + v.tercero : ""}`;
    if (t.signo > 0) { filas.push([v.fecha, "572", c, num(v.importe), "", v.archivo]); filas.push([v.fecha, v.cuenta || t.cuenta, c, "", num(v.importe), v.archivo]); }
    else { filas.push([v.fecha, v.cuenta || t.cuenta, c, num(v.importe), "", v.archivo]); filas.push([v.fecha, "572", c, "", num(v.importe), v.archivo]); }
  }
  return filas;
}
