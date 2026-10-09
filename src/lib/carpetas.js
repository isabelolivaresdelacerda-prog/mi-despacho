// Guardado en la carpeta de documentación de la empresa (OneDrive / Google Drive sincronizados en el PC).
// Usa la API de acceso a archivos del navegador (Chrome / Edge): el usuario elige UNA vez la carpeta raíz
// de la empresa y la app guarda cada documento en su subcarpeta. Nada pasa por ningún servidor.

// Estructuras de carpetas por tipo de empresa.
// "inmobiliaria" es la estructura que BITI usa en sus sociedades: NO se cambia.
// Las demás siguen la misma lógica (001 corporate, 003 financiación, 004 administración comunes)
// y adaptan el resto al sector.
const CORPORATE = { carpeta: "001 corporate", sub: ["ACTAS Y CERTIFICACIONES", "doc socios", "IMAGEN CORPORATIVA", "participes"] };
const ADMIN = (extra = []) => ({ carpeta: "004 ADMINISTRACIÓN", sub: ["banco", "contabilidad", "contratos gestion e intermediacion", ...extra] });

export const SECTORES = {
  inmobiliaria: {
    nombre: "Inmobiliaria / inversión en activos",
    estructura: [
      CORPORATE,
      { carpeta: "002 ACQUISITION", sub: ["arras", "compraventa", "contrato division", "notas simples", "Memo", "sources and uses"] },
      { carpeta: "003 FINANCING", sub: [] },
      ADMIN(),
      { carpeta: "005 TECHNICAL", sub: [] },
      { carpeta: "006 MANAGEMENT", sub: [] },
      { carpeta: "007 NUEVAS INVERSIONES", sub: [] },
    ],
    proyectos: { padre: "007 NUEVAS INVERSIONES", etiqueta: "inversión", sub: [] },
  },
  musica: {
    nombre: "Productora de música, conciertos y musicales",
    estructura: [
      CORPORATE,
      { carpeta: "002 PRODUCCIONES", sub: ["en desarrollo", "en curso", "cerradas"] },
      { carpeta: "003 FINANCING", sub: ["patrocinios", "subvenciones", "coproducciones", "inversores"] },
      ADMIN(["laboral artistas y tecnicos"]),
      { carpeta: "005 TECHNICAL", sub: ["riders", "escenografia", "sonido e iluminacion", "proveedores tecnicos"] },
      { carpeta: "006 MANAGEMENT", sub: ["giras y salas", "ticketing", "marketing y prensa"] },
      { carpeta: "007 DERECHOS", sub: ["derechos de autor", "licencias", "grabaciones y masters", "marcas"] },
    ],
    proyectos: { padre: "002 PRODUCCIONES/en desarrollo", etiqueta: "producción",
      sub: ["dossier y presupuesto", "contratos artistas", "contratos salas y promotores", "derechos y licencias", "seguros y permisos", "tecnico", "liquidacion"] },
  },
  industrial: {
    nombre: "Fabricación / industria",
    estructura: [
      CORPORATE,
      { carpeta: "002 PRODUCCION", sub: ["fichas tecnicas", "ordenes de fabricacion", "control de calidad"] },
      { carpeta: "003 FINANCING", sub: ["prestamos", "subvenciones", "leasing"] },
      ADMIN(["laboral"]),
      { carpeta: "005 TECHNICAL", sub: ["I+D", "certificaciones y homologaciones", "patentes", "prevencion de riesgos laborales", "medio ambiente"] },
      { carpeta: "006 COMERCIAL", sub: ["clientes", "distribuidores", "pedidos", "marketing"] },
      { carpeta: "007 COMPRAS", sub: ["proveedores", "materias primas", "logistica"] },
    ],
    proyectos: { padre: "002 PRODUCCION", etiqueta: "producto o línea", sub: ["diseño", "fichas tecnicas", "certificaciones", "proveedores", "costes"] },
  },
  servicios: {
    nombre: "Servicios / otra actividad",
    estructura: [
      CORPORATE,
      { carpeta: "002 CLIENTES", sub: ["propuestas", "contratos", "entregables"] },
      { carpeta: "003 FINANCING", sub: [] },
      ADMIN(["laboral"]),
      { carpeta: "005 TECHNICAL", sub: [] },
      { carpeta: "006 MANAGEMENT", sub: [] },
      { carpeta: "007 PROYECTOS", sub: [] },
    ],
    proyectos: { padre: "007 PROYECTOS", etiqueta: "proyecto", sub: [] },
  },
};

// Dónde va cada documento que genera Mi Despacho (es igual en todos los sectores)
export const DESTINO = {
  cuentas_participacion: ["001 corporate", "participes"],
  encargo_tratamiento: ["004 ADMINISTRACIÓN", "contratos gestion e intermediacion"],
  mandato_venta: ["004 ADMINISTRACIÓN", "contratos gestion e intermediacion"],
};

// Crea SOLO las carpetas que falten. Nunca mueve, renombra ni borra nada.
export async function crearEstructura(sector) {
  const raiz = await raizGuardada();
  if (!raiz || !(await permiso(raiz))) throw new Error("Elige primero la carpeta de la empresa.");
  let creadas = 0;
  const asegurar = async (dir, nombre) => {
    const h = await subcarpeta(dir, nombre, false);
    if (h) return h;
    creadas++; return await dir.getDirectoryHandle(nombre, { create: true });
  };
  for (const c of SECTORES[sector].estructura) {
    const d = await asegurar(raiz, c.carpeta);
    for (const s of c.sub) {
      if (s === "contabilidad" && (await buscarContabilidad(raiz))) continue; // ya existe "contabilidad - …"
      await asegurar(d, s);
    }
  }
  return creadas;
}

// Crea la carpeta de un proyecto (con sus subcarpetas) dentro de la ubicación de proyectos del sector
export async function crearProyecto(sector, nombre) {
  const raiz = await raizGuardada();
  if (!raiz || !(await permiso(raiz))) throw new Error("Elige primero la carpeta de la empresa.");
  const cfg = SECTORES[sector].proyectos;
  const dir = await abrirRuta(raiz, cfg.padre.split("/"), true);
  const limpio = nombre.replace(/[\\/:*?"<>|]/g, "").trim();
  const pd = await dir.getDirectoryHandle(limpio, { create: true });
  for (const s of cfg.sub) await pd.getDirectoryHandle(s, { create: true });
  return [raiz.name, ...cfg.padre.split("/"), limpio].join(" › ");
}

import { espacioActual } from "./espacio.js";
const STORE = "h", KEY = "raiz";
const nombreDB = () => "md-carpetas" + (espacioActual() ? ":" + espacioActual() : "");

function idb(modo, fn) {
  return new Promise((ok, ko) => {
    const r = indexedDB.open(nombreDB(), 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onerror = () => ko(r.error);
    r.onsuccess = () => {
      const tx = r.result.transaction(STORE, modo);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => ok(req?.result);
      tx.onerror = () => ko(tx.error);
    };
  });
}

export const soportado = () => typeof window !== "undefined" && "showDirectoryPicker" in window;

export async function raizGuardada() {
  try { return await idb("readonly", s => s.get(KEY)); } catch { return null; }
}

export async function elegirRaiz() {
  const h = await window.showDirectoryPicker({ id: "md-empresa", mode: "readwrite" });
  try { await idb("readwrite", s => s.put(h, KEY)); } catch { /* sin IndexedDB: se pedirá cada vez */ }
  return h;
}

export async function olvidarRaiz() {
  try { await idb("readwrite", s => s.delete(KEY)); } catch { /* nada */ }
}

export async function permiso(h, pedir = true) {
  if ((await h.queryPermission({ mode: "readwrite" })) === "granted") return true;
  return pedir && (await h.requestPermission({ mode: "readwrite" })) === "granted";
}

function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// Guarda en <raíz>/<ruta...>/<nombre>. Si no hay carpeta elegida o el navegador no lo permite, descarga.
// Nunca sobrescribe: si ya existe, añade (2), (3)…
export async function guardar(blob, nombre, ruta) {
  if (!soportado()) { descargar(blob, nombre); return { modo: "descarga" }; }
  let raiz = await raizGuardada();
  if (!raiz) { descargar(blob, nombre); return { modo: "descarga" }; }
  if (!(await permiso(raiz))) { descargar(blob, nombre); return { modo: "descarga" }; }
  const dir = await abrirRuta(raiz, ruta, true);
  const [base, ext] = nombre.match(/^(.*?)(\.[^.]+)?$/).slice(1);
  let final = nombre;
  for (let i = 2; i < 100; i++) {
    try { await dir.getFileHandle(final); final = `${base} (${i})${ext || ""}`; } catch { break; }
  }
  const fh = await dir.getFileHandle(final, { create: true });
  const w = await fh.createWritable();
  await w.write(blob); await w.close();
  return { modo: "carpeta", ruta: [raiz.name, ...ruta, final].join(" › ") };
}

// ---- Búsqueda tolerante: "004 ADMINISTRACIÓN" encuentra "004 administracion", con o sin tildes ----
const norm = (x) => String(x).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export async function subcarpeta(dir, nombre, crear = false) {
  try { return await dir.getDirectoryHandle(nombre); } catch { /* sigue */ }
  for await (const [n, h] of dir.entries()) if (h.kind === "directory" && norm(n) === norm(nombre)) return h;
  return crear ? await dir.getDirectoryHandle(nombre, { create: true }) : null;
}
export async function abrirRuta(raiz, partes, crear = false) {
  let d = raiz;
  for (const p of partes) { d = await subcarpeta(d, p, crear); if (!d) return null; }
  return d;
}

// Carpeta de contabilidad: dentro de 004 ADMINISTRACIÓN, la que empiece por "contabilidad" (p. ej. "contabilidad - beatriz")
export async function buscarContabilidad(raiz, crear = false, empresa = "") {
  const adm = await abrirRuta(raiz, ["004 ADMINISTRACIÓN"], crear);
  if (!adm) return null;
  for await (const [n, h] of adm.entries()) if (h.kind === "directory" && norm(n).startsWith("contabilidad")) return h;
  return crear ? await adm.getDirectoryHandle(empresa ? `contabilidad - ${empresa}` : "contabilidad", { create: true }) : null;
}

// Qué se guarda en cada carpeta (para explicarlo en pantalla)
export const QUE_VA = {
  "001 corporate": "La vida de la sociedad: escrituras, estatutos, actas de junta y certificaciones, libro de socios, imagen corporativa y contratos con partícipes.",
  "002 ACQUISITION": "Compra de activos: arras, compraventas, notas simples, memorandos y cuadros de fuentes y usos.",
  "002 PRODUCCIONES": "Cada producción (concierto, gira, musical) en su carpeta: presupuesto, contratos con artistas y salas, permisos.",
  "002 PRODUCCION": "Fabricación: fichas técnicas, órdenes de fabricación y control de calidad.",
  "002 CLIENTES": "Propuestas, contratos y entregables de cada cliente.",
  "003 FINANCING": "Financiación: préstamos, inversores, subvenciones, patrocinios.",
  "004 ADMINISTRACIÓN": "Banco, contabilidad (facturas, extractos, justificantes), contratos con gestoría y proveedores de servicios y, en su caso, laboral.",
  "005 TECHNICAL": "Documentación técnica: proyectos, licencias, certificaciones, informes técnicos.",
  "006 MANAGEMENT": "Gestión del día a día: presupuestos, seguimiento, informes a socios.",
  "006 COMERCIAL": "Clientes, distribuidores, pedidos y marketing.",
  "007 NUEVAS INVERSIONES": "Una carpeta por cada oportunidad o inversión nueva que se estudia.",
  "007 DERECHOS": "Propiedad intelectual: derechos de autor, licencias, masters y marcas.",
  "007 COMPRAS": "Proveedores, materias primas y logística.",
  "007 PROYECTOS": "Una carpeta por proyecto.",
};

// Pasa la carpeta elegida antes de las cuentas de usuario al espacio actual (y la quita de donde estaba)
export async function migrarRaizAntigua() {
  const abrir = (n) => new Promise((ok, ko) => { const r = indexedDB.open(n, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
  try {
    const vieja = await abrir("md-carpetas");
    const h = await new Promise((ok) => { const q = vieja.transaction(STORE, "readonly").objectStore(STORE).get(KEY); q.onsuccess = () => ok(q.result); q.onerror = () => ok(null); });
    if (h) {
      await idb("readwrite", (s) => s.put(h, KEY));
      await new Promise((ok) => { const tx = vieja.transaction(STORE, "readwrite"); tx.objectStore(STORE).delete(KEY); tx.oncomplete = ok; tx.onerror = ok; });
    }
    vieja.close();
  } catch { /* nada */ }
}
export async function borrarRaizAntigua() {
  try { indexedDB.deleteDatabase("md-carpetas"); } catch { /* nada */ }
}
