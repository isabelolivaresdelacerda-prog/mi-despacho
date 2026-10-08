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
};

// Crea SOLO las carpetas que falten. Nunca mueve, renombra ni borra nada.
export async function crearEstructura(sector) {
  const raiz = await raizGuardada();
  if (!raiz || !(await permiso(raiz))) throw new Error("Elige primero la carpeta de la empresa.");
  let creadas = 0;
  const asegurar = async (dir, nombre) => {
    try { return await dir.getDirectoryHandle(nombre); }
    catch { creadas++; return await dir.getDirectoryHandle(nombre, { create: true }); }
  };
  for (const c of SECTORES[sector].estructura) {
    const d = await asegurar(raiz, c.carpeta);
    for (const s of c.sub) await asegurar(d, s);
  }
  return creadas;
}

// Crea la carpeta de un proyecto (con sus subcarpetas) dentro de la ubicación de proyectos del sector
export async function crearProyecto(sector, nombre) {
  const raiz = await raizGuardada();
  if (!raiz || !(await permiso(raiz))) throw new Error("Elige primero la carpeta de la empresa.");
  const cfg = SECTORES[sector].proyectos;
  let dir = raiz;
  for (const p of cfg.padre.split("/")) dir = await dir.getDirectoryHandle(p, { create: true });
  const limpio = nombre.replace(/[\\/:*?"<>|]/g, "").trim();
  const pd = await dir.getDirectoryHandle(limpio, { create: true });
  for (const s of cfg.sub) await pd.getDirectoryHandle(s, { create: true });
  return [raiz.name, ...cfg.padre.split("/"), limpio].join(" › ");
}

const DB = "md-carpetas", STORE = "h", KEY = "raiz";

function idb(modo, fn) {
  return new Promise((ok, ko) => {
    const r = indexedDB.open(DB, 1);
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

async function permiso(h) {
  if ((await h.queryPermission({ mode: "readwrite" })) === "granted") return true;
  return (await h.requestPermission({ mode: "readwrite" })) === "granted";
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
  let dir = raiz;
  for (const parte of ruta) dir = await dir.getDirectoryHandle(parte, { create: true });
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
