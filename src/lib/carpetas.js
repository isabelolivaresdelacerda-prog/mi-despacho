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
  promotora: {
    nombre: "Promotora / constructora",
    estructura: [
      CORPORATE,
      { carpeta: "002 ACQUISITION", sub: ["arras", "compraventa", "notas simples", "due diligence", "Memo", "sources and uses"] },
      { carpeta: "003 FINANCING", sub: ["prestamo promotor", "avales y seguros de cantidades", "inversores"] },
      ADMIN(["laboral"]),
      { carpeta: "005 TECHNICAL", sub: ["proyecto basico y ejecucion", "licencias", "direccion facultativa", "seguridad y salud", "certificados finales"] },
      { carpeta: "006 COMERCIAL", sub: ["comercializacion", "reservas y contratos de compraventa", "entregas y postventa"] },
      { carpeta: "007 PROMOCIONES", sub: [] },
    ],
    proyectos: { padre: "007 PROMOCIONES", etiqueta: "promoción", sub: ["suelo", "proyecto y licencias", "obra", "financiacion", "comercializacion", "entrega"] },
  },
  holding: {
    nombre: "Holding / family office",
    estructura: [
      CORPORATE,
      { carpeta: "002 PARTICIPADAS", sub: [] },
      { carpeta: "003 FINANCING", sub: ["prestamos", "lineas de credito", "garantias"] },
      ADMIN(),
      { carpeta: "005 INVERSIONES FINANCIERAS", sub: ["carteras", "fondos", "informes de gestoras"] },
      { carpeta: "006 MANAGEMENT", sub: ["consejos y comites", "reporting a socios", "fiscalidad"] },
      { carpeta: "007 NUEVAS INVERSIONES", sub: [] },
    ],
    proyectos: { padre: "007 NUEVAS INVERSIONES", etiqueta: "inversión", sub: ["teaser y memorando", "due diligence", "valoracion", "documentacion legal", "cierre"] },
  },
  gestora: {
    nombre: "Gestora de fondos / SOCIMI",
    estructura: [
      CORPORATE,
      { carpeta: "002 VEHICULOS", sub: [] },
      { carpeta: "003 FINANCING", sub: ["deuda", "inversores", "ampliaciones de capital"] },
      ADMIN(["laboral"]),
      { carpeta: "005 REGULATORIO", sub: ["CNMV", "BME Growth", "prevencion de blanqueo (KYC)", "auditoria"] },
      { carpeta: "006 MANAGEMENT", sub: ["comites de inversion", "reporting a inversores", "valoraciones"] },
      { carpeta: "007 NUEVAS INVERSIONES", sub: [] },
    ],
    proyectos: { padre: "002 VEHICULOS", etiqueta: "vehículo o fondo", sub: ["constitucion y folleto", "inversores y KYC", "activos", "reporting", "auditoria"] },
  },
  despacho: {
    nombre: "Despacho de abogados",
    estructura: [
      CORPORATE,
      { carpeta: "002 CLIENTES", sub: ["hojas de encargo", "KYC y blanqueo", "conflictos de interes"] },
      { carpeta: "003 FINANCING", sub: [] },
      ADMIN(["laboral", "seguro de responsabilidad civil"]),
      { carpeta: "005 CONOCIMIENTO", sub: ["modelos y plantillas", "jurisprudencia", "formacion"] },
      { carpeta: "006 MANAGEMENT", sub: ["presupuestos y minutas", "marketing", "colegio de abogados"] },
      { carpeta: "007 ASUNTOS", sub: [] },
    ],
    proyectos: { padre: "007 ASUNTOS", etiqueta: "asunto", sub: ["hoja de encargo", "documentacion del cliente", "escritos", "notificaciones", "correspondencia", "minutas"] },
  },
  gestoria: {
    nombre: "Gestoría / asesoría fiscal y contable",
    estructura: [
      CORPORATE,
      { carpeta: "002 CLIENTES", sub: ["contratos de encargo", "encargos del tratamiento (RGPD)", "KYC y blanqueo"] },
      { carpeta: "003 FINANCING", sub: [] },
      ADMIN(["laboral"]),
      { carpeta: "005 PLANTILLAS Y NORMATIVA", sub: ["modelos tributarios", "circulares", "formacion"] },
      { carpeta: "006 MANAGEMENT", sub: ["calendario fiscal", "honorarios", "marketing"] },
      { carpeta: "007 EXPEDIENTES", sub: [] },
    ],
    proyectos: { padre: "002 CLIENTES", etiqueta: "cliente", sub: ["contabilidad", "impuestos", "laboral", "mercantil", "correspondencia"] },
  },
  consultoria: {
    nombre: "Consultoría",
    estructura: [
      CORPORATE,
      { carpeta: "002 CLIENTES", sub: ["propuestas", "contratos", "entregables"] },
      { carpeta: "003 FINANCING", sub: [] },
      ADMIN(),
      { carpeta: "005 METODOLOGIA", sub: ["plantillas", "casos de exito", "formacion"] },
      { carpeta: "006 COMERCIAL", sub: ["oportunidades", "marketing", "colaboradores"] },
      { carpeta: "007 PROYECTOS", sub: [] },
    ],
    proyectos: { padre: "007 PROYECTOS", etiqueta: "proyecto", sub: ["propuesta y contrato", "documentacion del cliente", "trabajo", "entregables", "facturacion"] },
  },
  tecnologia: {
    nombre: "Tecnología / software (SaaS)",
    estructura: [
      CORPORATE,
      { carpeta: "002 PRODUCTO", sub: ["roadmap", "diseño", "documentacion tecnica"] },
      { carpeta: "003 FINANCING", sub: ["rondas e inversores", "ENISA y subvenciones", "prestamos"] },
      ADMIN(["laboral"]),
      { carpeta: "005 LEGAL Y CUMPLIMIENTO", sub: ["condiciones y privacidad", "RGPD y encargados", "propiedad intelectual y marcas", "seguridad"] },
      { carpeta: "006 COMERCIAL", sub: ["clientes", "contratos y SLA", "marketing", "partners"] },
      { carpeta: "007 PROYECTOS", sub: [] },
    ],
    proyectos: { padre: "007 PROYECTOS", etiqueta: "proyecto o desarrollo", sub: ["especificacion", "diseño", "desarrollo", "pruebas", "lanzamiento"] },
  },
  hosteleria: {
    nombre: "Hostelería / restauración",
    estructura: [
      CORPORATE,
      { carpeta: "002 LOCALES", sub: ["contratos de arrendamiento", "licencias de actividad", "obras y reformas"] },
      { carpeta: "003 FINANCING", sub: ["prestamos", "leasing y renting", "subvenciones"] },
      ADMIN(["laboral"]),
      { carpeta: "005 TECHNICAL", sub: ["sanidad y APPCC", "prevencion de riesgos", "mantenimiento"] },
      { carpeta: "006 COMERCIAL", sub: ["cartas y precios", "marketing y redes", "reservas y eventos"] },
      { carpeta: "007 COMPRAS", sub: ["proveedores", "pedidos", "inventarios"] },
    ],
    proyectos: { padre: "002 LOCALES", etiqueta: "local", sub: ["contrato", "licencias", "obra", "equipamiento", "personal"] },
  },
  comercio: {
    nombre: "Comercio / tienda online",
    estructura: [
      CORPORATE,
      { carpeta: "002 PRODUCTO", sub: ["catalogo", "fichas de producto", "fotografias"] },
      { carpeta: "003 FINANCING", sub: [] },
      ADMIN(["laboral"]),
      { carpeta: "005 LEGAL Y CUMPLIMIENTO", sub: ["condiciones de venta", "privacidad y cookies", "devoluciones y garantias", "marcas"] },
      { carpeta: "006 COMERCIAL", sub: ["tienda online", "marketplaces", "marketing y redes", "clientes"] },
      { carpeta: "007 COMPRAS Y LOGISTICA", sub: ["proveedores", "pedidos", "almacen y envios"] },
    ],
    proyectos: { padre: "002 PRODUCTO", etiqueta: "colección o línea", sub: ["diseño", "proveedores", "fotos", "precios", "lanzamiento"] },
  },
  salud: {
    nombre: "Clínica / salud",
    estructura: [
      CORPORATE,
      { carpeta: "002 PACIENTES", sub: ["consentimientos informados (modelos)", "protocolos"] },
      { carpeta: "003 FINANCING", sub: ["prestamos", "leasing de equipos"] },
      ADMIN(["laboral", "seguro de responsabilidad civil"]),
      { carpeta: "005 TECHNICAL", sub: ["autorizacion sanitaria", "equipos y mantenimiento", "proteccion de datos de salud", "residuos sanitarios"] },
      { carpeta: "006 COMERCIAL", sub: ["mutuas y aseguradoras", "tarifas", "marketing"] },
      { carpeta: "007 PROYECTOS", sub: [] },
    ],
    proyectos: { padre: "007 PROYECTOS", etiqueta: "proyecto", sub: [] },
  },
  formacion: {
    nombre: "Academia / formación",
    estructura: [
      CORPORATE,
      { carpeta: "002 CURSOS", sub: ["en preparacion", "en curso", "terminados"] },
      { carpeta: "003 FINANCING", sub: ["FUNDAE y subvenciones", "prestamos"] },
      ADMIN(["laboral", "profesores colaboradores"]),
      { carpeta: "005 TECHNICAL", sub: ["plataforma online", "materiales", "acreditaciones"] },
      { carpeta: "006 COMERCIAL", sub: ["alumnos y matriculas", "empresas cliente", "marketing"] },
      { carpeta: "007 PROYECTOS", sub: [] },
    ],
    proyectos: { padre: "002 CURSOS/en preparacion", etiqueta: "curso", sub: ["programa", "materiales", "profesores", "alumnos", "evaluacion y certificados"] },
  },
  asociacion: {
    nombre: "Asociación / fundación",
    estructura: [
      { carpeta: "001 corporate", sub: ["ACTAS Y CERTIFICACIONES", "estatutos y registro", "libro de socios", "IMAGEN CORPORATIVA"] },
      { carpeta: "002 ACTIVIDADES", sub: ["programas", "eventos", "memorias de actividades"] },
      { carpeta: "003 FINANCING", sub: ["cuotas de socios", "subvenciones", "donaciones y certificados", "patrocinios"] },
      ADMIN(["voluntariado"]),
      { carpeta: "005 TECHNICAL", sub: ["proteccion de datos", "utilidad publica", "transparencia"] },
      { carpeta: "006 MANAGEMENT", sub: ["junta directiva", "asambleas", "presupuestos y cuentas"] },
      { carpeta: "007 PROYECTOS", sub: [] },
    ],
    proyectos: { padre: "007 PROYECTOS", etiqueta: "proyecto", sub: ["solicitud", "presupuesto", "ejecucion", "justificacion"] },
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
  gestion: ["004 ADMINISTRACIÓN", "contratos gestion e intermediacion"],
  intermediacion: ["004 ADMINISTRACIÓN", "contratos gestion e intermediacion"],
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
  "002 PARTICIPADAS": "Una carpeta por sociedad participada: escrituras, pactos de socios, cuentas anuales y consejos.",
  "002 VEHICULOS": "Cada fondo, SOCIMI o vehículo en su carpeta: constitución, inversores, activos y reporting.",
  "002 PRODUCTO": "El producto: diseño, catálogo, fichas y documentación técnica.",
  "002 LOCALES": "Cada local: contrato de alquiler, licencias de actividad y obras.",
  "002 PACIENTES": "Modelos de consentimiento y protocolos (nunca historias clínicas aquí: van en el programa de la clínica).",
  "002 CURSOS": "Cada curso en su carpeta: programa, materiales, profesores y alumnos.",
  "002 ACTIVIDADES": "Programas, eventos y memorias de actividades.",
  "005 INVERSIONES FINANCIERAS": "Carteras, fondos e informes de las gestoras.",
  "005 REGULATORIO": "CNMV, BME Growth, prevención de blanqueo y auditoría.",
  "005 CONOCIMIENTO": "Modelos, plantillas, jurisprudencia y formación del despacho.",
  "005 PLANTILLAS Y NORMATIVA": "Modelos tributarios, circulares y formación.",
  "005 METODOLOGIA": "Plantillas, metodología y casos de éxito.",
  "005 LEGAL Y CUMPLIMIENTO": "Condiciones legales, privacidad (RGPD), propiedad intelectual y marcas.",
  "007 PROMOCIONES": "Una carpeta por promoción: suelo, proyecto y licencias, obra, financiación, venta y entrega.",
  "007 ASUNTOS": "Un expediente por asunto: hoja de encargo, escritos, notificaciones y minutas.",
  "007 EXPEDIENTES": "Expedientes y trámites puntuales.",
  "007 PROYECTOS": "Una carpeta por proyecto.",
  "007 COMPRAS": "Proveedores, pedidos e inventarios.",
  "007 COMPRAS Y LOGISTICA": "Proveedores, pedidos, almacén y envíos.",
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
