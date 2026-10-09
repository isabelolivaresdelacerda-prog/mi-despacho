// Ajustes → Cuentas bancarias de la empresa: varias cuentas, de distintos bancos, y su conexión con el banco
// (la misma conexión segura PSD2 que se hizo para Cajamar, a través de Enable Banking). Cada cuenta se conecta por
// separado con las claves de su banco; el permiso dura 90 días y luego se renueva aquí o desde Contabilidad.
import { useEffect, useState } from "react";
import { ibanValido } from "./empresa.js";
import { raizGuardada, buscarContabilidad, permiso } from "./carpetas.js";

const ibanBonito = (i) => String(i || "").replace(/\s+/g, "").toUpperCase().replace(/(.{4})/g, "$1 ").trim();
const limpia = (i) => String(i || "").replace(/\s+/g, "").toUpperCase();
const CUENTA_VACIA = { banco: "", alias: "", iban: "", principal: false };
// Bancos españoles más habituales (para escribir rápido; si la empresa ya tiene la conexión, sale la lista completa)
const COMUNES = ["Cajamar", "Banco Santander", "BBVA", "CaixaBank", "Banco Sabadell", "Bankinter", "ING", "Unicaja", "Abanca", "Kutxabank", "Ibercaja", "Openbank", "Caja Rural", "Cajasur", "Deutsche Bank", "Banca March", "Banco Mediolanum", "EVO Banco", "Revolut", "Wise"];

export default function CuentasBancarias({ config, guardar, aviso }) {
  const inicial = () => {
    const c = config.empresa?.cuentas;
    if (Array.isArray(c) && c.length) return c;
    return config.empresa?.iban ? [{ ...CUENTA_VACIA, iban: config.empresa.iban, principal: true }] : [];
  };
  const [cuentas, setCuentas] = useState(inicial);
  const [raiz, setRaiz] = useState(null);       // carpeta de contabilidad (donde vive la conexión bancaria)
  const [estado, setEstado] = useState({ app: null, conexiones: [] });
  const [bancos, setBancos] = useState(COMUNES);
  const [paso, setPaso] = useState("");
  const [error, setError] = useState("");

  const cargarEstado = async (h = raiz) => {
    if (!h) return;
    try {
      const b = await import("../apps/contabilidad/banco.js");
      const app = await b.appBancoLista(h);
      setEstado({ app, conexiones: await b.estadoConexiones(h) });
      if (app) b.listarBancos(h, "ES").then((l) => l.length && setBancos(l.map((x) => x.nombre))).catch(() => {});
    } catch { /* sin carpeta no se ve el estado */ }
  };
  useEffect(() => { (async () => {
    const r = await raizGuardada(); if (!r || !(await permiso(r, false))) return;
    const h = await buscarContabilidad(r); if (h) { setRaiz(h); cargarEstado(h); }
  })(); }, []);

  const abrirCarpeta = async () => {
    const r = await raizGuardada();
    if (!r) { setError("Primero elige la carpeta de la empresa en «Organizar carpetas»."); return null; }
    if (!(await permiso(r, true))) return null;
    const h = await buscarContabilidad(r);
    if (!h) { setError("No encuentro la carpeta de contabilidad de la empresa. Ábrela una vez desde Contabilidad."); return null; }
    setRaiz(h); await cargarEstado(h); return h;
  };

  const errores = cuentas.map((c) => (c.iban && !ibanValido(c.iban) ? `El IBAN ${ibanBonito(c.iban)} no es válido.` : "")).filter(Boolean);
  const cambia = (i, c) => setCuentas(cuentas.map((x, j) => (j === i ? { ...x, ...c } : c.principal ? { ...x, principal: false } : x)));
  const guardarCuentas = (lista = cuentas) => {
    const limpias = lista.filter((c) => c.iban || c.banco).map((c) => ({ ...c, iban: limpia(c.iban), banco: c.banco.trim(), alias: (c.alias || "").trim() }));
    if (limpias.length && !limpias.some((c) => c.principal)) limpias[0].principal = true;
    const principal = limpias.find((c) => c.principal);
    guardar({ ...config, empresa: { ...(config.empresa || {}), cuentas: limpias, iban: principal?.iban || "" } });
    setCuentas(limpias); aviso?.("Cuentas guardadas");
  };

  const conexionDe = (c) => estado.conexiones.find((x) => x.iban && x.iban === limpia(c.iban));

  const conectar = async (c) => {
    setError("");
    if (!c.banco.trim()) { setError("Escribe primero el banco de la cuenta."); return; }
    const v = window.open("about:blank", "banco", "width=520,height=760"); // en el mismo clic, para que el navegador no la bloquee
    try {
      const h = raiz || (await abrirCarpeta());
      if (!h) { v?.close(); return; }
      const b = await import("../apps/contabilidad/banco.js");
      const r = await b.conectarCuenta(h, v, setPaso, { iban: limpia(c.iban), banco: c.banco.trim(), pais: "ES" });
      // Si el banco dio cuentas que aún no estaban en la lista, se añaden
      const nuevas = (r.cuentas || []).filter((ib) => !cuentas.some((x) => limpia(x.iban) === ib)).map((ib) => ({ ...CUENTA_VACIA, banco: c.banco.trim(), iban: ib }));
      const lista = cuentas.map((x) => (x === c && !x.iban && r.iban ? { ...x, iban: r.iban } : x)).concat(nuevas);
      guardarCuentas(lista);
      setPaso(""); await cargarEstado(h);
      aviso?.(`${c.banco} conectado hasta el ${new Date(r.hasta).toLocaleDateString("es-ES")}`);
    } catch (e) { setPaso(""); setError(String(e.message || e)); }
  };
  const desconectar = async (c) => {
    if (!window.confirm(`¿Quitar la conexión con ${c.banco}? Los movimientos ya guardados se conservan.`)) return;
    const h = raiz || (await abrirCarpeta()); if (!h) return;
    const b = await import("../apps/contabilidad/banco.js");
    await b.desconectarCuenta(h, c.iban); await cargarEstado(h);
  };

  return (
    <section className="tarjeta">
      <h2>Cuentas bancarias</h2>
      <p className="muted">Todas las cuentas de la empresa, aunque sean de bancos distintos. La que marques «para facturas» es la que sale en las facturas. Cada cuenta se puede conectar con su banco para que la contabilidad traiga sola los movimientos.</p>
      <datalist id="lista-bancos">{bancos.map((b) => <option key={b} value={b} />)}</datalist>
      {cuentas.length === 0 && <p className="muted">Todavía no hay ninguna cuenta.</p>}
      {cuentas.map((c, i) => {
        const cx = conexionDe(c);
        return (
          <fieldset key={i} className="cuenta-banco">
            <legend>{c.alias || c.banco || "Cuenta " + (i + 1)}{c.iban ? " · …" + limpia(c.iban).slice(-4) : ""}</legend>
            <div className="fila">
              <label>Banco<input list="lista-bancos" value={c.banco} onChange={(e) => cambia(i, { banco: e.target.value })} placeholder="Cajamar, BBVA, Santander…" /></label>
              <label>Nombre para reconocerla (opcional)<input value={c.alias || ""} onChange={(e) => cambia(i, { alias: e.target.value })} placeholder="p. ej. Cuenta de obra" /></label>
            </div>
            <label>IBAN<input value={ibanBonito(c.iban)} onChange={(e) => cambia(i, { iban: limpia(e.target.value) })} placeholder="ES00 0000 0000 0000 0000 0000" /></label>
            <div className="fila" style={{ alignItems: "center" }}>
              <label className="check"><input type="radio" name="cuenta-principal" checked={!!c.principal} onChange={() => cambia(i, { principal: true })} /> Para las facturas</label>
              <span className={"estado-banco " + (cx ? (cx.dias != null && cx.dias < 0 ? "caducado" : cx.dias != null && cx.dias <= 10 ? "pronto" : "ok") : "no")}>
                {cx ? (cx.dias != null && cx.dias < 0 ? "Permiso caducado" : `Conectada${cx.hasta ? " hasta el " + new Date(cx.hasta).toLocaleDateString("es-ES") : ""}`) : "Sin conectar"}
              </span>
            </div>
            <div className="acciones">
              <button className="btn ghost" type="button" disabled={!!paso || estado.app === false} onClick={() => conectar(c)}>{cx ? "Renovar permiso" : "Conectar con el banco"}</button>
              {cx && <button className="enlace" type="button" onClick={() => desconectar(c)}>Quitar conexión</button>}
              <button className="enlace" type="button" onClick={() => setCuentas(cuentas.filter((_, j) => j !== i))}>Quitar cuenta</button>
            </div>
          </fieldset>
        );
      })}
      <div className="acciones">
        <button className="btn ghost" type="button" onClick={() => setCuentas([...cuentas, { ...CUENTA_VACIA, principal: !cuentas.length }])}>+ Añadir cuenta</button>
        <button className="btn" type="button" disabled={errores.length > 0} onClick={() => guardarCuentas()}>Guardar cuentas</button>
      </div>
      {paso && <p role="status"><span className="girando" aria-hidden="true" /> {paso}</p>}
      {errores.length > 0 && <p className="nota error">{errores.join(" ")}</p>}
      {error && <p className="nota error" role="alert">{error}</p>}
      {!raiz && <p className="nota">Para ver y hacer las conexiones con el banco, la app necesita la carpeta de la empresa. <button className="enlace" type="button" onClick={abrirCarpeta}>Dar permiso a la carpeta</button></p>}
      {estado.app === false && (
        <details className="nota" open>
          <summary><strong>Cómo se conecta un banco (solo la primera vez)</strong></summary>
          <ol>
            <li>Mi Despacho se conecta a los bancos a través de <strong>Enable Banking</strong>, una pasarela autorizada para leer movimientos (normativa PSD2). Es la misma que usamos con Cajamar.</li>
            <li>Crea una cuenta gratuita en enablebanking.com y, en «Control panel», una aplicación de producción. Descarga su clave (.pem).</li>
            <li>En «Redirect URLs» de esa aplicación añade <code>{location.origin}/banco-vuelta.html</code>.</li>
            <li>Guarda la clave en la carpeta «programa» de la contabilidad de la empresa con el nombre <code>enablebanking_key.pem</code>, y en esa misma carpeta un archivo <code>banco_api_config.json</code> con <code>{"{ \"application_id\": \"el identificador de tu aplicación\" }"}</code>.</li>
            <li>Vuelve aquí y pulsa «Conectar con el banco» en cada cuenta. Se abre la web de tu banco: entra con tus claves y acepta. Una sola aplicación sirve para todos los bancos.</li>
          </ol>
          <p className="muted">Tus claves del banco solo las ve el banco. Mi Despacho recibe un permiso de solo lectura de movimientos durante 90 días; la clave de la pasarela se queda en tu carpeta, no en nuestros servidores.</p>
        </details>
      )}
    </section>
  );
}
