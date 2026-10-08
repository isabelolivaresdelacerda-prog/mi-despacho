// Asistente de carpetas: una sola carpeta por empresa en OneDrive / Google Drive, con su estructura fija.
import { useEffect, useState } from "react";
import { mapaDocumental } from "./documentos.js";
import { SECTORES, QUE_VA, soportado, raizGuardada, elegirRaiz, olvidarRaiz, permiso, crearEstructura, crearProyecto, subcarpeta, buscarContabilidad } from "./carpetas.js";

export function useRaiz() {
  const [raiz, setRaiz] = useState(undefined); // undefined = cargando
  const [ok, setOk] = useState(false);
  useEffect(() => { raizGuardada().then(async (h) => { setRaiz(h || null); if (h) setOk(await permiso(h, false)); }); }, []);
  const pedir = async () => { if (raiz && (await permiso(raiz))) setOk(true); };
  return { raiz, ok, setRaiz: (h) => { setRaiz(h); setOk(!!h); }, pedir };
}

export default function CarpetasEmpresa({ config, guardar }) {
  const sector = config.sector || "inmobiliaria";
  const { raiz, ok, setRaiz, pedir } = useRaiz();
  const [estado, setEstado] = useState({});
  const [conta, setConta] = useState(null);
  const [msg, setMsg] = useState("");
  const [proyecto, setProyecto] = useState("");
  const cfg = SECTORES[sector];

  const revisar = async () => {
    if (!raiz || !ok) return;
    const e = {};
    for (const c of cfg.estructura) e[c.carpeta] = !!(await subcarpeta(raiz, c.carpeta));
    setEstado(e);
    const h = await buscarContabilidad(raiz);
    setConta(h ? h.name : null);
  };
  useEffect(() => { revisar(); }, [raiz, ok, sector]);
  const accion = async (fn) => { setMsg(""); try { setMsg(await fn()); await revisar(); } catch (e) { if (e?.name !== "AbortError") setMsg(e.message || "No se pudo completar."); } };
  const faltan = cfg.estructura.filter((c) => estado[c.carpeta] === false).length;

  if (!soportado()) return (
    <section className="tarjeta"><h2>Carpetas de la empresa</h2>
      <p className="nota">Abre Mi Despacho con <strong>Chrome o Edge</strong> en tu ordenador para trabajar con tus carpetas de OneDrive o Google Drive.</p></section>
  );

  return (
    <section className="tarjeta asistente">
      <h2>Carpetas de la empresa</h2>
      <p className="muted">Toda la documentación de cada empresa va en <strong>una sola carpeta</strong> de tu OneDrive (o Google Drive), siempre con la misma estructura. Mi Despacho guarda cada contrato y cada documento contable en su sitio. Nunca mueve ni borra nada.</p>

      <ol className="pasos">
        <li className={raiz ? "hecho" : ""}>
          <strong>Carpeta de tu empresa.</strong> En tu OneDrive crea una carpeta con el nombre de tu empresa (por ejemplo, <em>Beatriz Inversiones</em>). Si ya la tienes, úsala.
          <div className="acciones">
            {raiz && <span>Elegida: <strong>{raiz.name}</strong></span>}
            <button className={raiz ? "btn ghost" : "btn"} type="button" onClick={() => accion(async () => { const h = await elegirRaiz(); setRaiz(h); return `Carpeta elegida: ${h.name}`; })}>{raiz ? "Cambiar" : "Elegir la carpeta de la empresa"}</button>
            {raiz && !ok && <button className="btn" type="button" onClick={pedir}>Permitir acceso</button>}
            {raiz && <button className="enlace" type="button" onClick={() => accion(async () => { await olvidarRaiz(); setRaiz(null); return "Carpeta olvidada en este navegador."; })}>Olvidar</button>}
          </div>
        </li>
        <li className={config.sector ? "hecho" : ""}>
          <strong>Tipo de empresa.</strong> Decide qué carpetas lleva.
          <select value={sector} onChange={(e) => guardar({ ...config, sector: e.target.value })}>
            {Object.entries(SECTORES).map(([k, v]) => <option key={k} value={k}>{v.nombre}</option>)}
          </select>
        </li>
        <li className={raiz && ok && faltan === 0 ? "hecho" : ""}>
          <strong>Estructura de carpetas.</strong> Dentro de la carpeta de la empresa:
          <ul className="estructura">
            {cfg.estructura.map((c) => (
              <li key={c.carpeta}>
                <span className={"marca-est " + (estado[c.carpeta] ? "si" : estado[c.carpeta] === false ? "no" : "")}>{estado[c.carpeta] ? "✓" : estado[c.carpeta] === false ? "falta" : "·"}</span>
                <div><strong>{c.carpeta}</strong> — {QUE_VA[c.carpeta] || ""}
                  {c.sub.length > 0 && <div className="muted subs">{c.sub.map((s) => s === "contabilidad" && conta ? conta : s).join(" · ")}</div>}
                </div>
              </li>
            ))}
          </ul>
          {raiz && ok && (
            <p className="nota">Contabilidad: {conta ? <><strong>004 ADMINISTRACIÓN › {conta}</strong> ✓</> : "se creará en 004 ADMINISTRACIÓN › contabilidad"}. Ahí van las subcarpetas facturas, facturas_emitidas, documentos_banco y extractos.</p>
          )}
          {raiz && ok && faltan > 0 && <button className="btn" type="button" onClick={() => accion(async () => { const n = await crearEstructura(sector); return n ? `Creadas ${n} carpetas que faltaban.` : "Ya estaban todas."; })}>Crear las {faltan} carpetas que faltan</button>}
        </li>
        <li>
          <strong>Nueva {cfg.proyectos.etiqueta}.</strong> Crea su carpeta en <em>{cfg.proyectos.padre.replace("/", " › ")}</em>{cfg.proyectos.sub.length ? " con sus subcarpetas" : ""}.
          <div className="fila">
            <input value={proyecto} onChange={(e) => setProyecto(e.target.value)} placeholder="Nombre" disabled={!raiz || !ok} />
            <button className="btn ghost" type="button" disabled={!proyecto.trim() || !raiz || !ok} onClick={() => accion(async () => { const r = await crearProyecto(sector, proyecto); setProyecto(""); return `Creada: ${r}`; })}>Crear carpeta</button>
          </div>
        </li>
      </ol>
      {msg && <p className="nota">{msg}</p>}
      <details className="mapa-doc">
        <summary>Qué documentos tiene una empresa de este tipo y cuáles necesita la contabilidad</summary>
        <div className="tabla-scroll"><table className="tabla">
          <thead><tr><th>Documento</th><th>Dónde va</th><th>Para la contabilidad</th><th>Conservar</th></tr></thead>
          <tbody>{mapaDocumental(sector).map((d, i) => <tr key={i}><td><span className="muted pequeño">{d.grupo}</span><br />{d.nombre}</td><td className="pequeño">{d.carpeta.replace(/\//g, " › ")}</td><td className="pequeño">{d.conta || <span className="muted">—</span>}</td><td className="pequeño">{d.conservar}</td></tr>)}</tbody>
        </table></div>
        <p className="muted pequeño">Los documentos con efecto contable que no están en la carpeta de contabilidad (escrituras, contratos, préstamos…) se vinculan desde Contabilidad → Escrituras y contratos, sin duplicarlos.</p>
      </details>
      <p className="muted pequeño">Comparte con tu gestoría solo la carpeta de contabilidad (en OneDrive: Compartir → Personas específicas). El resto de la carpeta de la empresa no lo necesita.</p>
    </section>
  );
}
