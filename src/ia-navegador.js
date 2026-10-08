// ============================================================
//  ia-navegador.js - Piramide de IA de bitini labs (version "cada usuaria con sus claves")
//  MODO "local" (por defecto): la IA trabaja SOLO en el ordenador de la usuaria
//  (Gemma 4 con llama.cpp, sin Ollama ni servicios en segundo plano).
//  Ningún texto sale de su ordenador ni hace falta ninguna clave.
//  MODO "nube": primero la IA local si está; si no, IA gratuitas en la nube con
//  SUS propias claves (Gemma 4 -> Gemini Flash -> gpt-oss -> Llama -> OpenRouter)
//  y Claude (de pago, SOLO con permitirPago: true tras aceptar el aviso).
//
//  Uso:
//    import { preguntarIA, leerClaves, guardarClaves } from "./ia-navegador.js";
//    const r = await preguntarIA("Resume esto", { sistema: "Eres abogada" });
//    // r = { estado: "ok" | "gratis_agotadas" | "sin_claves" | "error", texto, ia, dePago, intentos }
// ============================================================

const ALMACEN = "bitini-ia-claves";
const ALMACEN_MODO = "bitini-ia-modo";
const LOCAL = "http://localhost:8080"; // llama-server (llama.cpp)
const GOOGLE = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const GROQ = "https://api.groq.com/openai/v1/chat/completions";

// Que claves puede poner cada usuaria (para pintar el panel de ajustes)
export const PROVEEDORES = [
  { id: "gemini",     nombre: "Google (Gemma 4 y Gemini)", gratis: true,  conseguir: "https://aistudio.google.com/apikey", ejemplo: "AIza..." },
  { id: "groq",       nombre: "Groq (gpt-oss y Llama)",    gratis: true,  conseguir: "https://console.groq.com/keys",      ejemplo: "gsk_..." },
  { id: "cerebras",   nombre: "Cerebras (gpt-oss, Qwen, Llama) — muy rápida", gratis: true, conseguir: "https://cloud.cerebras.ai/platform/", ejemplo: "csk-..." },
  { id: "mistral",    nombre: "Mistral (europea; plan gratis «Experiment»)", gratis: true, conseguir: "https://console.mistral.ai/api-keys", ejemplo: "clave de Mistral" },
  { id: "github",     nombre: "GitHub Models (GPT-4.1 mini, DeepSeek…)", gratis: true, conseguir: "https://github.com/settings/personal-access-tokens/new", ejemplo: "github_pat_..." },
  { id: "openrouter", nombre: "OpenRouter (modelos free)", gratis: true,  conseguir: "https://openrouter.ai/keys",         ejemplo: "sk-or-..." },
  { id: "anthropic",  nombre: "Claude (de pago)",          gratis: false, conseguir: "https://console.anthropic.com/settings/keys", ejemplo: "sk-ant-..." },
];

const PIRAMIDE = [
  { nombre: "Gemma 4 (Google)",  clave: "gemini",     url: GOOGLE, modelo: k => modeloGemma(k), sinSistema: true },
  { nombre: "Gemini Flash",      clave: "gemini",     url: GOOGLE, modelo: "gemini-2.5-flash" },
  { nombre: "gpt-oss (Groq)",    clave: "groq",       url: GROQ,   modelo: "openai/gpt-oss-120b" },
  { nombre: "Llama 3.3 (Groq)",  clave: "groq",       url: GROQ,   modelo: "llama-3.3-70b-versatile" },
  { nombre: "gpt-oss (Cerebras)", clave: "cerebras",   url: "https://api.cerebras.ai/v1/chat/completions", modelo: "gpt-oss-120b" },
  { nombre: "Qwen 3 (Cerebras)", clave: "cerebras",    url: "https://api.cerebras.ai/v1/chat/completions", modelo: "qwen-3-235b-a22b-instruct-2507" },
  { nombre: "Mistral Small",     clave: "mistral",    url: "https://api.mistral.ai/v1/chat/completions", modelo: "mistral-small-latest" },
  { nombre: "GPT-4.1 mini (GitHub)", clave: "github", url: "https://models.github.ai/inference/chat/completions", modelo: "openai/gpt-4.1-mini" },
  { nombre: "OpenRouter (free)", clave: "openrouter", url: "https://openrouter.ai/api/v1/chat/completions", modelo: "openrouter/free" },
];
const MODELO_CLAUDE = "claude-haiku-5-5";

// --- Claves: solo en el navegador de cada usuaria ---
export function leerClaves() {
  try { return JSON.parse(localStorage.getItem(ALMACEN)) || {}; } catch { return {}; }
}
// Se guardan en este navegador y, cifradas, en tu cuenta (para no tener que volver a ponerlas en otro ordenador)
export function guardarClaves(claves, { sinSubir = false } = {}) {
  try { localStorage.setItem(ALMACEN, JSON.stringify(claves)); } catch { return false; }
  if (!sinSubir) import("./lib/ajustesNube.js").then((m) => m.subirClavesIA(claves, leerModo())).catch(() => {});
  return true;
}
export function borrarClaves() {
  const vacias = Object.fromEntries(PROVEEDORES.map((p) => [p.id, ""]));
  try { localStorage.removeItem(ALMACEN); } catch {}
  import("./lib/ajustesNube.js").then((m) => m.subirClavesIA(vacias)).catch(() => {});
}
export function tieneAlgunaGratis() {
  const c = leerClaves();
  return PROVEEDORES.some(p => p.gratis && c[p.id]);
}

export function leerModo() {
  try { return localStorage.getItem(ALMACEN_MODO) === "nube" ? "nube" : "local"; } catch { return "local"; }
}
export function guardarModo(m, { sinSubir = false } = {}) {
  try { localStorage.setItem(ALMACEN_MODO, m === "nube" ? "nube" : "local"); } catch {}
  if (!sinSubir) import("./lib/ajustesNube.js").then((x) => x.subirClavesIA({}, m === "nube" ? "nube" : "local")).catch(() => {});
}

// --- IA en el ordenador (llama.cpp) ---
// Devuelve { ok, modelo } si la IA local está encendida y con el modelo cargado.
export async function estadoLocal() {
  try {
    const r = await fetch(LOCAL + "/v1/models", { signal: AbortSignal.timeout(2000) });
    if (r.status === 503) return { ok: false, motivo: "cargando" };
    if (!r.ok) return { ok: false, motivo: "no_responde" };
    const d = await r.json();
    const modelo = (d.data && d.data[0] && d.data[0].id) || "Gemma 4";
    return { ok: true, modelo: modelo.split(/[\\/]/).pop() };
  } catch {
    return { ok: false, motivo: "apagada" };
  }
}

async function preguntarLocal(modelo, sistema, msgs, maxTokens, json = false) {
  const r = await fetch(LOCAL + "/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Sin «pensar» en voz alta (más rápido) y, si se pide JSON, la respuesta sale solo como JSON válido
    body: JSON.stringify({ model: modelo, messages: mensajesPara({ sinSistema: true }, sistema, msgs), max_tokens: maxTokens, stream: false, temperature: 0.1,
      chat_template_kwargs: { enable_thinking: false }, ...(json ? { response_format: { type: "json_object" } } : {}) }),
    // Nunca esperar para siempre: si en 3 minutos no contesta (ordenador muy ocupado), se da por fallida
    signal: AbortSignal.timeout(180000),
  });
  if (!r.ok) throw new Error("error " + r.status);
  const texto = (await r.json()).choices?.[0]?.message?.content;
  if (!texto) throw new Error("respuesta vacia");
  return texto;
}

// ¿Está la IA del ordenador ocupada con otra lectura? (llama.cpp atiende una petición cada vez)
export async function ocupadaLocal() {
  try { const r = await fetch(LOCAL + "/slots", { signal: AbortSignal.timeout(3000) }); if (!r.ok) return null; const s = await r.json(); return Array.isArray(s) ? s.some((x) => x.is_processing) : null; } catch { return null; }
}

// --- Internas ---
let gemmaCache = null;
async function modeloGemma(clave) {
  if (gemmaCache) return gemmaCache;
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key=${clave}`);
  const nombres = ((await r.json()).models || []).map(m => m.name).filter(n => n.includes("gemma-4"));
  for (const t of ["31b", "26b", "12b", "e4b", "e2b"]) {
    const m = nombres.find(n => n.includes(t));
    if (m) return (gemmaCache = m.replace(/^models\//, ""));
  }
  throw new Error("Gemma 4 no disponible");
}

function motivo(status) {
  return { 429: "cuota gratuita agotada", 401: "clave no valida", 403: "sin permiso", 404: "modelo no encontrado" }[status]
    || `error ${status}`;
}

function mensajesPara(nivel, sistema, mensajes) {
  if (!sistema) return mensajes;
  if (!nivel.sinSistema) return [{ role: "system", content: sistema }, ...mensajes];
  const [primero, ...resto] = mensajes;
  return [{ ...primero, content: `${sistema}\n\n${primero.content}` }, ...resto];
}

// --- Funcion principal ---
export async function preguntarIA(pregunta, { sistema, mensajes, permitirPago = false, maxTokens = 2048, json = false } = {}) {
  const claves = leerClaves();
  const msgs = mensajes || [{ role: "user", content: pregunta }];
  const intentos = [];
  const modo = leerModo();

  // 0) IA en el ordenador de la usuaria
  const local = await estadoLocal();
  if (local.ok) {
    try {
      const texto = await preguntarLocal(local.modelo, sistema, msgs, maxTokens, json);
      return { estado: "ok", texto, ia: "Gemma 4 en tu ordenador", modelo: local.modelo, dePago: false, local: true, intentos };
    } catch (e) {
      intentos.push("IA local: " + e.message);
    }
  }
  if (modo === "local") return { estado: "local_no_disponible", motivo: local.motivo, texto: null, intentos };

  if (!PROVEEDORES.some(p => claves[p.id])) return { estado: "sin_claves", texto: null, intentos };

  // 1) Escalones gratuitos con las claves de la usuaria
  for (const nivel of PIRAMIDE) {
    const clave = claves[nivel.clave];
    if (!clave) continue;
    try {
      const modelo = typeof nivel.modelo === "function" ? await nivel.modelo(clave) : nivel.modelo;
      const r = await fetch(nivel.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${clave}` },
        body: JSON.stringify({ model: modelo, messages: mensajesPara(nivel, sistema, msgs), max_tokens: maxTokens }),
      });
      if (!r.ok) { intentos.push(`${nivel.nombre}: ${motivo(r.status)}`); continue; }
      const texto = (await r.json()).choices?.[0]?.message?.content;
      if (!texto) { intentos.push(`${nivel.nombre}: respuesta vacia`); continue; }
      return { estado: "ok", texto, ia: nivel.nombre, modelo, dePago: false, intentos };
    } catch (e) {
      intentos.push(`${nivel.nombre}: ${e.message}`);
    }
  }

  // 2) Claude: solo con su clave y su permiso expreso
  if (!permitirPago || !claves.anthropic) return { estado: "gratis_agotadas", texto: null, intentos };
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": claves.anthropic,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({ model: MODELO_CLAUDE, max_tokens: maxTokens, ...(sistema ? { system: sistema } : {}), messages: msgs }),
    });
    if (!r.ok) return { estado: "error", texto: null, intentos: [...intentos, `Claude: ${motivo(r.status)}`] };
    const d = await r.json();
    const texto = (d.content || []).filter(b => b.type === "text").map(b => b.text).join("");
    return { estado: "ok", texto, ia: "Claude", modelo: MODELO_CLAUDE, dePago: true, intentos };
  } catch (e) {
    return { estado: "error", texto: null, intentos: [...intentos, `Claude: ${e.message}`] };
  }
}
