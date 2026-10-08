// Ajustes → Carpetas de la empresa: tipo de empresa, carpeta raíz en el PC y creación de la estructura.
import { useEffect, useState } from "react";
import { SECTORES, soportado, raizGuardada, elegirRaiz, olvidarRaiz, crearEstructura, crearProyecto } from "./carpetas.js";

export default function CarpetasEmpresa({ config, guardar }) {
  const sector = config.sector || "inmobiliaria";
  const [raiz, setRaiz] = useState(null);
  const [msg, setMsg] = useState("");
  const [proyecto, setProyecto] = useState("");
  useEffect(() => { raizGuardada().then(setRaiz); }, []);
  const cfg = SECTORES[sector];
  const accion = async (fn) => { setMsg(""); try { setMsg(await fn()); } catch (e) { if (e?.name !== "AbortError") setMsg(e.message || "No se pudo completar."); } };

  return (
    <section className="tarjeta">
      <h2>Carpetas de la empresa</h2>
      <p className="muted">Mi Despacho guarda cada documento en su carpeta, dentro de la carpeta de la empresa en tu ordenador (la que se sincroniza con OneDrive o Google Drive). Nunca mueve ni borra nada.</p>
      <label>Tipo de empresa
        <select value={sector} onChange={(e) => guardar({ ...config, sector: e.target.value })}>
          {Object.entries(SECTORES).map(([k, v]) => <option key={k} value={k}>{v.nombre}</option>)}
        </select>
      </label>
      <details>
        <summary>Ver la estructura de carpetas</summary>
        <ul className="arbol">
          {cfg.estructura.map((c) => <li key={c.carpeta}><strong>{c.carpeta}</strong>{c.sub.length > 0 && <ul>{c.sub.map((s) => <li key={s}>{s}</li>)}</ul>}</li>)}
        </ul>
      </details>
      {!soportado() ? (
        <p className="nota">Para guardar directamente en tus carpetas, abre Mi Despacho con Chrome o Edge. Con otros navegadores los documentos se descargan.</p>
      ) : (
        <>
          <p>Carpeta de la empresa: <strong>{raiz ? raiz.name : "sin elegir"}</strong></p>
          <div className="acciones">
            <button className="btn" type="button" onClick={() => accion(async () => { const h = await elegirRaiz(); setRaiz(h); return `Carpeta elegida: ${h.name}`; })}>{raiz ? "Cambiar carpeta" : "Elegir carpeta"}</button>
            {raiz && <button className="btn ghost" type="button" onClick={() => accion(async () => { const n = await crearEstructura(sector); return n ? `Creadas ${n} carpetas que faltaban.` : "Ya estaban todas las carpetas."; })}>Crear las carpetas que falten</button>}
            {raiz && <button className="btn ghost" type="button" onClick={() => accion(async () => { await olvidarRaiz(); setRaiz(null); return "Carpeta olvidada."; })}>Olvidar carpeta</button>}
          </div>
          {raiz && (
            <div className="fila">
              <label>Nueva {cfg.proyectos.etiqueta}<input value={proyecto} onChange={(e) => setProyecto(e.target.value)} placeholder="Nombre" /></label>
              <button className="btn ghost" type="button" disabled={!proyecto.trim()} onClick={() => accion(async () => { const r = await crearProyecto(sector, proyecto); setProyecto(""); return `Creada: ${r}`; })}>Crear carpeta</button>
            </div>
          )}
        </>
      )}
      {msg && <p className="nota">{msg}</p>}
    </section>
  );
}
