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
async function proxy(ruta, tk) {
  const { data } = await sb.auth.getSession();
  const r = await fetch(`${SUPABASE_URL}/functions/v1/banco-proxy`, { method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${data?.session?.access_token || ""}` }, body: JSON.stringify({ ruta, token: tk }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const t = JSON.stringify(j);
    if (r.status === 401 || /expired|EXPIRED|session|consent|revoked/i.test(t)) throw new Error("El permiso del banco ha caducado (por ley hay que renovarlo cada 90 días). Hay que volver a autorizar la cuenta en la web de Cajamar.");
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
  await escribirJSON(raiz, "extracto_api.json", { actualizado: new Date().toLocaleString("es-ES"), movimientos });
  try { await excelTodoElAnio(raiz, movimientos); } catch { /* el Excel es solo para consultar; si está abierto no se puede escribir */ }
  return { nuevos: nuevos.length, total: movimientos.length };
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
          out.push({ fecha, concepto: concepto.slice(0, 120), importe: Math.round(importe * 100) / 100, tercero: "", _origen: "extracto" });
        }
      }
    } catch { /* un Excel que no se entiende no para lo demás */ }
  }
  return out;
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
