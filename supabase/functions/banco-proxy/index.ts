// Pasarela a Enable Banking (PSD2) para sincronizar el banco desde Mi Despacho.
// La clave privada NO viene aquí: el navegador firma el token con la clave que está en la carpeta de la empresa
// (en el ordenador de la usuaria) y esta función solo reenvía la consulta, que la API no permite hacer directamente
// desde el navegador. No guarda nada. Solo usuarias activas con entrada en dos pasos.
// Permite: leer la lista de bancos, movimientos/saldos/sesión (GET) y renovar el permiso (POST /auth y POST /sessions) con la vuelta
// obligatoriamente a una dirección de Mi Despacho.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const ORIGENES = ["https://midespacho.vercel.app", "https://midespacho.beatrizinversiones.com", "https://mi-despacho-nine.vercel.app", "http://localhost:5173"];
const VUELTAS = ORIGENES.map((o) => o + "/banco-vuelta.html");
const cors = (req: Request) => {
  const o = req.headers.get("origin") ?? "";
  return { "Access-Control-Allow-Origin": ORIGENES.includes(o) ? o : ORIGENES[0], "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
};
const LECTURA = /^\/(accounts\/[0-9a-f-]{36}\/(transactions|balances|details)|sessions\/[0-9a-f-]{36})(\?[A-Za-z0-9_=&%.:-]*)?$/;
// Lista de bancos de un país (para elegir el banco de cada cuenta)
const BANCOS = /^\/aspsps\?country=[A-Z]{2}(&psu_type=(business|personal))?$/;
const txt = (v: unknown, max: number) => typeof v === "string" && v.length > 0 && v.length <= max;

// Solo se reenvían los campos conocidos, comprobados uno a uno
function cuerpoAuth(c: any) {
  const hasta = Date.parse(c?.access?.valid_until ?? "");
  if (!hasta || hasta > Date.now() + 91 * 86400000) throw new Error("plazo no válido");
  if (!txt(c?.aspsp?.name, 80) || !/^[A-Z]{2}$/.test(c?.aspsp?.country ?? "")) throw new Error("banco no válido");
  if (!VUELTAS.includes(c?.redirect_url)) throw new Error("dirección de vuelta no permitida");
  if (!txt(c?.state, 100)) throw new Error("state no válido");
  const psu = c?.psu_type === "personal" ? "personal" : "business";
  return { access: { valid_until: c.access.valid_until }, aspsp: { name: c.aspsp.name, country: c.aspsp.country }, state: c.state, redirect_url: c.redirect_url, psu_type: psu };
}
function cuerpoSesion(c: any) {
  if (!txt(c?.code, 500) || !/^[A-Za-z0-9._~-]+$/.test(c.code)) throw new Error("código no válido");
  return { code: c.code };
}

Deno.serve(async (req) => {
  const h = { ...cors(req), "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response(null, { headers: h });
  const err = (s: number, m: string) => new Response(JSON.stringify({ error: m }), { status: s, headers: h });
  try {
    const auth = req.headers.get("authorization") ?? "";
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: activo } = await sb.rpc("_usuario_activo");
    if (!activo) return err(403, "no autorizado");
    const { ruta, token, metodo = "GET", cuerpo } = await req.json();
    if (typeof token !== "string" || token.split(".").length !== 3 || token.length > 4000) return err(400, "token no válido");
    let init: RequestInit;
    if (metodo === "GET") {
      if (typeof ruta !== "string" || !(LECTURA.test(ruta) || BANCOS.test(ruta))) return err(400, "consulta no permitida");
      init = { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } };
    } else if (metodo === "POST" && (ruta === "/auth" || ruta === "/sessions")) {
      let b;
      try { b = ruta === "/auth" ? cuerpoAuth(cuerpo) : cuerpoSesion(cuerpo); } catch (e) { return err(400, String((e as Error).message)); }
      init = { method: "POST", headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(b) };
    } else return err(400, "consulta no permitida");
    const r = await fetch("https://api.enablebanking.com" + ruta, init);
    return new Response(await r.text(), { status: r.status, headers: h });
  } catch (e) { return err(500, String((e as Error)?.message ?? e)); }
});
