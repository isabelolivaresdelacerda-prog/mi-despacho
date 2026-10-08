// Banco: sincronización con Enable Banking (PSD2) y lectura de los extractos en Excel.
// La clave privada se queda en la carpeta de la empresa: el navegador firma con ella un token de 1 hora y la pasarela
// de Mi Despacho (función banco-proxy) solo reenvía la consulta de movimientos. Nada se guarda fuera de tu carpeta.
import { leerJSON, escribirJSON, dirEstado, sub, num, fechaOrden } from "./datos.js";
import { sb } from "../../lib/cuentas.js";
import { SUPABASE_URL, SUPABASE_KEY } from "../../config.js";

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const txt64 = (s) => b64url(new TextEncoder().encode(s));
const derLen = (n) => (n < 128 ? [n] : n < 256 ? [0x81, n] : [0x82, n >> 8, n & 255]);
// PKCS#1 («BEGIN RSA PRIVATE KEY») → PKCS#8, que es lo que entiende el navegador
function aPkcs8(pem) {
  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----|\s/g, "")), (c) => c.charCodeAt(0));
  if (/BEGIN PRIVATE KEY/.test(pem)) return der;
  const alg = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const oct = [0x04, ...derLen(der.length)];
  const cuerpo = [0x02, 0x01, 0x00, ...alg, ...oct];
  const total = cuerpo.length + der.length;
  const out = new Uint8Array([0x30, ...derLen(total), ...cuerpo, ...der].length);
  out.set([0x30, ...derLen(total), ...cuerpo]); out.set(der, out.length - der.length);
  return out;
}
async function token(cfg, pem) {
  const clave = await crypto.subtle.importKey("pkcs8", aPkcs8(pem), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const ahora = Math.floor(Date.now() / 1000);
  const base = txt64(JSON.stringify({ typ: "JWT", alg: "RS256", kid: cfg.application_id })) + "." + txt64(JSON.stringify({ iss: "enablebanking.com", aud: "api.enablebanking.com", iat: ahora, exp: ahora + 3600 }));
  return base + "." + b64url(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", clave, new TextEncoder().encode(base)));
}
// Error con marca para que la app ofrezca «Renovar banco» en vez de un mensaje suelto
export class PermisoCaducado extends Error { constructor(m) { super(m || "El permiso del banco ha caducado (por ley hay que renovarlo cada 90 días)."); this.caducado = true; } }
async function proxy(ruta, tk, metodo = "GET", cuerpo) {
  const { data } = await sb.auth.getSession();
  const r = await fetch(`${SUPABASE_URL}/functions/v1/banco-proxy`, { method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${data?.session?.access_token || ""}` }, body: JSON.stringify({ ruta, token: tk, metodo, cuerpo }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const t = JSON.stringify(j);
    if (r.status === 429) throw Object.assign(new Error("El banco solo deja consultar los movimientos unas 4 veces al día (norma PSD2) y hoy ya se han usado. No pasa nada: el permiso sigue vigente y el extracto que tienes en «extractos» ya cubre hasta hoy. Vuelve a sincronizar mañana."), { limite: true });
    if (metodo === "GET" && (r.status === 401 || /expired|EXPIRED|session|consent|revoked/i.test(t))) throw new PermisoCaducado();
    throw new Error(`Banco ${r.status}: ${t.slice(0, 200)}`);
  }
  return j;
}
const fmt = (iso) => { const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ""; };

export async function bancoConfigurado(raiz) {
  const cfg = await leerJSON(raiz, "banco_api_config.json", {});
  return !!(cfg.application_id && cfg.account_uid);
}

// Descarga los movimientos y los junta con los que ya había (no se pierde nada de lo anterior a los 90 días que da el banco)
export async function sincronizarBanco(raiz) {
  const cfg = await leerJSON(raiz, "banco_api_config.json", {});
  if (!cfg.application_id || !cfg.account_uid) throw new Error("Este banco no está conectado todavía.");
  const dir = await dirEstado(raiz);
  const pem = await (await (await dir.getFileHandle(cfg.key_file || "enablebanking_key.pem")).getFile()).text();
  const tk = await token(cfg, pem);
  // Antes de pedir movimientos se mira si el permiso sigue vivo (si no, la app ofrece renovarlo)
  if (cfg.session_id) {
    const ses = await proxy(`/sessions/${cfg.session_id}`, tk).catch((e) => { if (e.caducado) throw e; return null; });
    const hasta = ses?.access?.valid_until;
    if (ses && (ses.status && ses.status !== "AUTHORIZED" || (hasta && Date.parse(hasta) < Date.now()))) throw new PermisoCaducado();
    if (hasta && hasta !== cfg.valid_until) { cfg.valid_until = hasta; await escribirJSON(raiz, "banco_api_config.json", cfg); }
  }
  const nuevos = [];
  let cont = null;
  for (let i = 0; i < 50; i++) {
    const r = await proxy(`/accounts/${cfg.account_uid}/transactions${cont ? `?continuation_key=${encodeURIComponent(cont)}` : ""}`, tk);
    for (const t of r.transactions || []) {
      let imp = num((t.transaction_amount || {}).amount);
      if (/^(DBIT|DEBIT)$/i.test(String(t.credit_debit_indicator || ""))) imp = -Math.abs(imp);
      const rem = t.remittance_information; const parte = (imp < 0 ? t.creditor : t.debtor) || {};
      nuevos.push({ fecha: fmt(t.booking_date || t.value_date), concepto: (Array.isArray(rem) ? rem.join(" ") : String(rem || "")).slice(0, 120), importe: Math.round(imp * 100) / 100, tercero: String(parte.name || "").slice(0, 80), _origen: "api" });
    }
    cont = r.continuation_key; if (!cont) break;
  }
  const previo = await leerJSON(raiz, "extracto_api.json", { movimientos: [] });
  const desde = nuevos.map((m) => fechaOrden(m.fecha)).sort()[0] || "9999";
  const antiguos = (previo.movimientos || []).filter((m) => fechaOrden(m.fecha) < desde);
  const movimientos = [...antiguos, ...nuevos].sort((a, b) => fechaOrden(a.fecha).localeCompare(fechaOrden(b.fecha)));
  await escribirJSON(raiz, "extracto_api.json", { actualizado: new Date().toLocaleString("es-ES"), sincronizado: new Date().toISOString(), movimientos });
  try { await excelTodoElAnio(raiz, movimientos); } catch { /* el Excel es solo para consultar; si está abierto no se puede escribir */ }
  const dias = cfg.valid_until ? Math.floor((Date.parse(cfg.valid_until) - Date.now()) / 86400000) : null;
  return { nuevos: nuevos.length, total: movimientos.length, diasPermiso: dias };
}

// Días que le quedan al permiso del banco (lo que se sabe sin preguntar al banco)
// Para no gastar las pocas consultas diarias que deja el banco: ¿se sincronizó hace menos de «horas»?
export async function sincronizadoHace(raiz, horas = 6) {
  const x = await leerJSON(raiz, "extracto_api.json", {});
  return !!x.sincronizado && Date.now() - Date.parse(x.sincronizado) < horas * 3600000;
}

export async function diasPermiso(raiz) {
  const cfg = await leerJSON(raiz, "banco_api_config.json", {});
  return cfg.valid_until ? Math.floor((Date.parse(cfg.valid_until) - Date.now()) / 86400000) : null;
}

export const urlVuelta = () => `${location.origin}/banco-vuelta.html`;

// Renovar el permiso (PSD2 obliga cada 90 días). Se abre la web del banco en una ventana; al volver, la página
// banco-vuelta.html avisa a esta pestaña con el código y aquí se crea la sesión nueva y se guarda en tu carpeta.
// «ventana» se abre en el mismo clic (si no, el navegador la bloquea).
export async function renovarPermiso(raiz, ventana, onPaso = () => {}) {
  const cfg = await leerJSON(raiz, "banco_api_config.json", {});
  if (!cfg.application_id) throw new Error("Falta la configuración del banco en la carpeta «programa».");
  const dir = await dirEstado(raiz);
  const pem = await (await (await dir.getFileHandle(cfg.key_file || "enablebanking_key.pem")).getFile()).text();
  const tk = await token(cfg, pem);
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const hasta = new Date(Date.now() + 90 * 86400000).toISOString().replace(/\.\d{3}Z$/, ".000Z");
  onPaso("Pidiendo al banco la página de autorización…");
  let r;
  try {
    r = await proxy("/auth", tk, "POST", { access: { valid_until: hasta }, aspsp: { name: cfg.aspsp_name || "Cajamar", country: cfg.aspsp_country || "ES" }, state, redirect_url: urlVuelta(), psu_type: cfg.psu_type || "business" });
  } catch (e) {
    try { ventana?.close(); } catch { /* */ }
    if (/redirect/i.test(String(e.message))) throw new Error(`El banco no reconoce la dirección de vuelta. Añade ${urlVuelta()} en «Redirect URLs» de tu aplicación en el panel de Enable Banking (enablebanking.com › Control panel) y vuelve a intentarlo.`);
    throw e;
  }
  if (!r.url) throw new Error("El banco no devolvió la página de autorización.");
  if (ventana && !ventana.closed) ventana.location.href = r.url; else window.open(r.url, "banco", "width=520,height=760");
  onPaso("Autoriza la cuenta en la ventana del banco (entra con tus claves de Cajamar)…");
  const code = await new Promise((ok, mal) => {
    const canal = "BroadcastChannel" in window ? new BroadcastChannel("midespacho-banco") : null;
    const fin = (f, v) => { clearTimeout(t); canal?.close(); removeEventListener("storage", alm); f(v); };
    const recibir = (d) => { if (!d || d.state !== state) return; if (d.error) fin(mal, new Error(`El banco no dio el permiso: ${d.error}`)); else if (d.code) fin(ok, d.code); };
    const alm = (e) => { if (e.key === "midespacho-banco") try { recibir(JSON.parse(e.newValue)); } catch { /* */ } };
    if (canal) canal.onmessage = (e) => recibir(e.data);
    addEventListener("storage", alm);
    const t = setTimeout(() => fin(mal, new Error("Se acabó el tiempo (15 minutos) sin autorizar. Vuelve a pulsar «Renovar banco».")), 15 * 60000);
  });
  try { localStorage.removeItem("midespacho-banco"); } catch { /* */ }
  onPaso("Guardando el permiso nuevo…");
  const ses = await proxy("/sessions", tk, "POST", { code });
  const cuentas = ses.accounts || [];
  if (!cuentas.length) throw new Error("La autorización no devolvió ninguna cuenta.");
  const ibanPrevio = (cfg._cuentas || []).find((c) => c.uid === cfg.account_uid)?.iban;
  const elegida = cuentas.find((a) => ibanPrevio && (a.account_id || {}).iban === ibanPrevio) || cuentas[0];
  const nuevo = { ...cfg, _anterior: { session_id: cfg.session_id, account_uid: cfg.account_uid, valid_until: cfg.valid_until }, session_id: ses.session_id || "", account_uid: elegida.uid, _cuentas: cuentas.map((a) => ({ uid: a.uid, iban: (a.account_id || {}).iban || "" })), valid_until: ses.access?.valid_until || hasta, renovado: new Date().toISOString() };
  delete nuevo._auth_iniciada; delete nuevo._state;
  await escribirJSON(raiz, "banco_api_config.json", nuevo);
  return { hasta: nuevo.valid_until };
}

// Extractos descargados del banco en Excel/CSV (carpeta «extractos»): para lo que la conexión no alcanza (más de 90 días)
export async function leerExtractos(raiz) {
  const d = await sub(raiz, "extractos");
  if (!d) return [];
  const XLSX = await import("xlsx");
  const out = [];
  for await (const [n, h] of d.entries()) {
    if (h.kind !== "file" || !/\.(xlsx?|csv)$/i.test(n) || /sincronizado/i.test(n)) continue;
    try {
      const wb = XLSX.read(await (await h.getFile()).arrayBuffer(), { cellDates: true });
      for (const hoja of wb.SheetNames) {
        const filas = XLSX.utils.sheet_to_json(wb.Sheets[hoja], { header: 1, raw: true, defval: "" });
        const iCab = filas.findIndex((f) => f.some((c) => /^fecha/i.test(String(c).trim())) && f.some((c) => /importe/i.test(String(c))));
        if (iCab < 0) continue;
        const cab = filas[iCab].map((c) => String(c).trim().toLowerCase());
        const cF = cab.findIndex((c) => c === "fecha" || c.startsWith("fecha op")), cC = cab.findIndex((c) => c.includes("concepto")), cI = cab.findIndex((c) => c === "importe" || c.startsWith("importe"));
        for (const f of filas.slice(iCab + 1)) {
          const v = f[cF]; let fecha = "";
          if (v instanceof Date) fecha = `${String(v.getDate()).padStart(2, "0")}/${String(v.getMonth() + 1).padStart(2, "0")}/${v.getFullYear()}`;
          else if (typeof v === "number") { const dt = new Date(Math.round((v - 25569) * 86400000)); fecha = `${String(dt.getUTCDate()).padStart(2, "0")}/${String(dt.getUTCMonth() + 1).padStart(2, "0")}/${dt.getUTCFullYear()}`; }
          else { const m = String(v).match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/); if (m) fecha = `${m[1].padStart(2, "0")}/${m[2].padStart(2, "0")}/${m[3].length === 2 ? "20" + m[3] : m[3]}`; }
          const importe = typeof f[cI] === "number" ? f[cI] : num(f[cI]);
          const concepto = String(f[cC] ?? "").replace(/\s+/g, " ").trim();
          if (!fecha || !importe || /apertura de cuenta/i.test(concepto)) continue;
          out.push({ fecha, concepto: concepto.slice(0, 120), importe: Math.round(importe * 100) / 100, tercero: "", _origen: "extracto", _fuente: n });
        }
      }
    } catch { /* un Excel que no se entiende no para lo demás */ }
  }
  // Extractos mensuales en PDF guardados en «documentos_banco» (Cajamar: «dd/mm/aaaa dd/mm CONCEPTO 1.234,56-»)
  const db = await sub(raiz, "documentos_banco");
  if (db) {
    const { textoPDF } = await import("./leer.js");
    for await (const [n, h] of db.entries()) {
      if (h.kind !== "file" || !/extracto/i.test(n) || !/\.pdf$/i.test(n)) continue;
      try {
        const t = await textoPDF(await h.getFile(), 6, { ocr: false });
        for (const l of t.split(/\n/)) {
          const m = l.trim().match(/^(\d{2}\/\d{2}\/\d{4})\s+\d{2}\/\d{2}\s+(.+?)\s+([\d.]+,\d{2})([+-])$/);
          if (m) out.push({ fecha: m[1], concepto: m[2].slice(0, 120), importe: (m[4] === "-" ? -1 : 1) * num(m[3]), tercero: "", _origen: "extracto-pdf", _fuente: "pdf" });
        }
      } catch { /* sigue */ }
    }
  }
  // Varios extractos de la misma cuenta se solapan (marzo-junio, julio, marzo-octubre…) y además están los PDF: cada
  // archivo es una copia de la misma cuenta, así que por día e importe se cuenta el máximo de veces que sale en UN archivo
  // (no la suma). Así se respetan los cargos repetidos de verdad y no se duplica nada.
  const grupos = {};
  for (const m of out) {
    const k = `${m.fecha}|${num(m.importe).toFixed(2)}`;
    const g = (grupos[k] ||= { porFuente: {}, lista: [] });
    g.porFuente[m._fuente] = (g.porFuente[m._fuente] || 0) + 1; g.lista.push(m);
  }
  return Object.values(grupos).flatMap((g) => {
    const n = Math.max(...Object.values(g.porFuente));
    // Se queda la copia del archivo más completo (el que más movimientos tiene ese día), y el Excel antes que el PDF
    const mejor = Object.entries(g.porFuente).sort((a, b) => b[1] - a[1] || (a[0] === "pdf") - (b[0] === "pdf"))[0][0];
    return [...g.lista.filter((m) => m._fuente === mejor), ...g.lista.filter((m) => m._fuente !== mejor)].slice(0, n).map(({ _fuente, ...m }) => m);
  });
}

// Junta la conexión del banco y los extractos sin duplicar (mismo día e importe = el mismo movimiento)
export function juntarMovimientos(api, extractos) {
  const cuenta = {};
  for (const m of api) { const k = `${m.fecha}|${num(m.importe).toFixed(2)}`; cuenta[k] = (cuenta[k] || 0) + 1; }
  const vistos = {};
  const extra = [];
  for (const m of extractos) {
    const k = `${m.fecha}|${num(m.importe).toFixed(2)}`;
    vistos[k] = (vistos[k] || 0) + 1;
    if (vistos[k] > (cuenta[k] || 0)) extra.push(m);
  }
  return [...api, ...extra].sort((a, b) => fechaOrden(a.fecha).localeCompare(fechaOrden(b.fecha)));
}

// Excel de consulta en «extractos» con TODOS los movimientos guardados (no solo los 90 días que da la conexión)
async function excelTodoElAnio(raiz, movimientos) {
  const XLSX = await import("xlsx");
  let saldo = 0;
  const filas = [["Fecha", "Concepto", "Importe", "Saldo", "Tercero", "Origen"], ...movimientos.map((m) => { saldo = Math.round((saldo + num(m.importe)) * 100) / 100; return [m.fecha, m.concepto, num(m.importe), saldo, m.tercero || "", m._origen === "api" ? "conexión banco" : "extracto Excel"]; })];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), "Movimientos");
  const anio = (movimientos.at(-1)?.fecha || "").slice(-4) || new Date().getFullYear();
  const dir = await sub(raiz, "extractos", true);
  const w = await (await dir.getFileHandle(`extracto sincronizado ${anio} (todo el año).xlsx`, { create: true })).createWritable();
  await w.write(new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }))); await w.close();
}
