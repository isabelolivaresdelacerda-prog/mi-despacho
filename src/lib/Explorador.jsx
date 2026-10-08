// Explorador de la carpeta de la empresa, estilo administrador de archivos:
// árbol de carpetas a la izquierda y contenido a la derecha. Los archivos no salen del ordenador.
import { useEffect, useMemo, useState } from "react";
import { abrirRuta, buscarContabilidad, QUE_VA } from "./carpetas.js";
import { useRaiz } from "./CarpetasUI.jsx";
import "./explorador.css";

const ICONOS = [
  [/\.pdf$/i, "📕", "PDF"], [/\.(docx?|odt|rtf)$/i, "📘", "Word"], [/\.(xlsx?|csv|ods)$/i, "📗", "Excel"],
  [/\.(pptx?|odp)$/i, "📙", "PowerPoint"], [/\.(jpe?g|png|gif|webp|heic|svg)$/i, "🖼️", "Imagen"],
  [/\.(zip|rar|7z)$/i, "🗜️", "Comprimido"], [/\.(eml|msg)$/i, "✉️", "Correo"], [/\.(txt|md)$/i, "📄", "Texto"],
];
const tipo = (n) => ICONOS.find(([re]) => re.test(n)) || [null, "📄", "Archivo"];
const tam = (b) => (b < 1024 ? `${b} B` : b < 1048576 ? `${Math.ceil(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`);
const fecha = (t) => new Date(t).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
const oculto = (n) => n.startsWith(".") || n.startsWith("~$") || n === "desktop.ini" || n === "Thumbs.db";

async function leerCarpeta(dir) {
  const carpetas = [], archivos = [];
  for await (const [n, h] of dir.entries()) {
    if (oculto(n)) continue;
    if (h.kind === "directory") carpetas.push(n);
    else { const f = await h.getFile(); archivos.push({ n, f }); }
  }
  carpetas.sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  archivos.sort((a, b) => a.n.localeCompare(b.n, "es", { numeric: true }));
  return { carpetas, archivos };
}

// Rama del árbol (carga sus subcarpetas al desplegarse)
function Rama({ raiz, ruta, nombre, sel, onSel, abiertas, alternar, nivel }) {
  const clave = ruta.join("/");
  const abierta = abiertas.has(clave);
  const [hijos, setHijos] = useState(null);
  useEffect(() => { if (abierta && hijos === null) abrirRuta(raiz, ruta).then((d) => d && leerCarpeta(d)).then((r) => setHijos(r?.carpetas || [])); }, [abierta]);
  const activa = sel.join("/") === clave;
  return (
    <li>
      <div className={"arbol-fila" + (activa ? " activa" : "")} style={{ paddingLeft: 8 + nivel * 14 }}>
        <button className="arbol-flecha" type="button" aria-label={abierta ? "Plegar" : "Desplegar"} onClick={() => alternar(clave)}>{abierta ? "▾" : "▸"}</button>
        <button className="arbol-nombre" type="button" onClick={() => { onSel(ruta); if (!abierta) alternar(clave); }} title={nombre}>
          <span className="ico">{abierta ? "📂" : "📁"}</span>{nombre}
        </button>
      </div>
      {abierta && hijos && hijos.length > 0 && (
        <ul>{hijos.map((h) => <Rama key={h} raiz={raiz} ruta={[...ruta, h]} nombre={h} sel={sel} onSel={onSel} abiertas={abiertas} alternar={alternar} nivel={nivel + 1} />)}</ul>
      )}
    </li>
  );
}

export default function Explorador({ titulo, eyebrow, contabilidad = false }) {
  const { raiz, ok, pedir } = useRaiz();
  const [inicio, setInicio] = useState(null);      // ruta base (raíz o contabilidad)
  const [ruta, setRuta] = useState(null);           // ruta seleccionada
  const [cont, setCont] = useState({ carpetas: [], archivos: [] });
  const [abiertas, setAbiertas] = useState(new Set());
  const [buscar, setBuscar] = useState("");
  const [arr, setArr] = useState(false);
  const [msg, setMsg] = useState("");
  const [nueva, setNueva] = useState(null);

  useEffect(() => { (async () => {
    if (!raiz || !ok) return;
    let base = [];
    if (contabilidad) { const h = await buscarContabilidad(raiz); base = h ? ["004 ADMINISTRACIÓN", h.name] : []; }
    setInicio(base); setRuta(base); setAbiertas(new Set([base.join("/")]));
  })(); }, [raiz, ok]);

  const recargar = async () => { if (!raiz || !ok || !ruta) return; const d = await abrirRuta(raiz, ruta); setCont(d ? await leerCarpeta(d) : { carpetas: [], archivos: [] }); };
  useEffect(() => { recargar(); setBuscar(""); }, [ruta]);

  const alternar = (k) => setAbiertas((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const entrar = (n) => { const r = [...ruta, n]; setRuta(r); setAbiertas((s) => new Set([...s, ruta.join("/"), r.join("/")])); };
  const abrirArchivo = (a) => { const u = URL.createObjectURL(a.f); window.open(u, "_blank", "noopener"); setTimeout(() => URL.revokeObjectURL(u), 60000); };
  const subir = async (files) => {
    if (!files.length) return;
    const d = await abrirRuta(raiz, ruta, true);
    for (const f of files) {
      const [b, e] = f.name.match(/^(.*?)(\.[^.]+)?$/).slice(1); let n = f.name;
      for (let i = 2; i < 100; i++) { try { await d.getFileHandle(n); n = `${b} (${i})${e || ""}`; } catch { break; } }
      const w = await (await d.getFileHandle(n, { create: true })).createWritable(); await w.write(f); await w.close();
    }
    setMsg(`${files.length === 1 ? "1 archivo guardado" : `${files.length} archivos guardados`} en ${ruta[ruta.length - 1] || raiz.name}`); recargar();
  };
  const crearCarpeta = async () => {
    const n = (nueva || "").replace(/[\\/:*?"<>|]/g, "").trim(); if (!n) return;
    const d = await abrirRuta(raiz, ruta, true); await d.getDirectoryHandle(n, { create: true });
    setNueva(null); recargar(); setAbiertas((s) => new Set([...s, ruta.join("/")]));
  };

  const filtro = buscar.trim().toLowerCase();
  const carpetas = useMemo(() => cont.carpetas.filter((c) => !filtro || c.toLowerCase().includes(filtro)), [cont, filtro]);
  const archivos = useMemo(() => cont.archivos.filter((a) => !filtro || a.n.toLowerCase().includes(filtro)), [cont, filtro]);

  const cab = (
    <header className="app-cab"><div><div className="eyebrow">{eyebrow}</div><h1>{titulo}</h1>
      <p className="muted">Tu carpeta de OneDrive / Drive, vista desde Mi Despacho. Los archivos no salen de tu ordenador.</p></div></header>
  );
  if (raiz === undefined) return <div className="app">{cab}</div>;
  if (!raiz) return <div className="app">{cab}<div className="vacio"><p><strong>Aún no has elegido la carpeta de tu empresa.</strong></p><a className="btn" href="#/carpetas">Configurar carpetas</a></div></div>;
  if (!ok) return <div className="app">{cab}<div className="vacio"><p>Permite a Mi Despacho abrir <strong>{raiz.name}</strong>.</p><button className="btn" type="button" onClick={pedir}>Permitir</button></div></div>;
  if (!ruta || !inicio) return <div className="app">{cab}</div>;

  const nombreBase = inicio.length ? inicio[inicio.length - 1] : raiz.name;
  const relativa = ruta.slice(inicio.length);
  const explic = QUE_VA[ruta[0]] && ruta.length === 1 ? QUE_VA[ruta[0]] : null;

  return (
    <div className="app">{cab}
      <div className="expl">
        <aside className="expl-arbol" aria-label="Carpetas">
          <ul>
            <li>
              <div className={"arbol-fila raiz" + (ruta.join("/") === inicio.join("/") ? " activa" : "")}>
                <button className="arbol-nombre" type="button" onClick={() => setRuta(inicio)}><span className="ico">🏢</span>{nombreBase}</button>
              </div>
              <RamasDe raiz={raiz} ruta={inicio} sel={ruta} onSel={setRuta} abiertas={abiertas} alternar={alternar} />
            </li>
          </ul>
        </aside>

        <section className={"expl-panel" + (arr ? " arrastrando" : "")}
          onDragOver={(e) => { e.preventDefault(); setArr(true); }} onDragLeave={(e) => { if (e.currentTarget === e.target) setArr(false); }}
          onDrop={(e) => { e.preventDefault(); setArr(false); subir([...e.dataTransfer.files]); }}>
          <div className="expl-barra">
            <nav className="expl-migas">
              <button type="button" onClick={() => setRuta(inicio)}>{nombreBase}</button>
              {relativa.map((p, i) => <span key={i}><span className="sep">›</span><button type="button" onClick={() => setRuta([...inicio, ...relativa.slice(0, i + 1)])}>{p}</button></span>)}
            </nav>
            <div className="expl-acciones">
              <input className="expl-buscar" placeholder="Buscar aquí…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
              <button className="btn ghost" type="button" onClick={() => setNueva("")}>+ Carpeta</button>
              <label className="btn">Subir<input type="file" multiple hidden onChange={(e) => { subir([...e.target.files]); e.target.value = ""; }} /></label>
            </div>
          </div>
          {explic && <p className="expl-nota">{explic}</p>}
          {nueva !== null && (
            <div className="expl-nueva">
              <span className="ico">📁</span>
              <input autoFocus value={nueva} placeholder="Nombre de la carpeta" onChange={(e) => setNueva(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") crearCarpeta(); if (e.key === "Escape") setNueva(null); }} />
              <button className="btn" type="button" onClick={crearCarpeta}>Crear</button>
              <button className="btn ghost" type="button" onClick={() => setNueva(null)}>Cancelar</button>
            </div>
          )}
          {msg && <p className="expl-msg" role="status">{msg}</p>}

          {carpetas.length === 0 && archivos.length === 0 ? (
            <div className="expl-vacio"><span>🗂️</span><p>{filtro ? "No hay nada con ese nombre." : "Carpeta vacía. Arrastra aquí documentos para guardarlos."}</p></div>
          ) : (
            <table className="expl-tabla">
              <thead><tr><th>Nombre</th><th className="col-tipo">Tipo</th><th className="col-fecha">Modificado</th><th className="num col-tam">Tamaño</th></tr></thead>
              <tbody>
                {carpetas.map((c) => (
                  <tr key={"d" + c} className="fila-carpeta" onDoubleClick={() => entrar(c)}>
                    <td><button type="button" className="expl-item" onClick={() => entrar(c)}><span className="ico">📁</span>{c}</button></td>
                    <td className="col-tipo muted">Carpeta</td><td className="col-fecha" /><td className="col-tam" />
                  </tr>
                ))}
                {archivos.map((a) => {
                  const [, ico, t] = tipo(a.n);
                  return (
                    <tr key={"f" + a.n} onDoubleClick={() => abrirArchivo(a)}>
                      <td><button type="button" className="expl-item" onClick={() => abrirArchivo(a)} title="Abrir"><span className="ico">{ico}</span>{a.n}</button></td>
                      <td className="col-tipo muted">{t}</td><td className="col-fecha muted">{fecha(a.f.lastModified)}</td><td className="num col-tam muted">{tam(a.f.size)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="expl-pie">{cont.carpetas.length} carpetas · {cont.archivos.length} archivos · arrastra documentos aquí para guardarlos en esta carpeta</p>
        </section>
      </div>
    </div>
  );
}

// Primer nivel del árbol bajo la carpeta base
function RamasDe({ raiz, ruta, sel, onSel, abiertas, alternar }) {
  const [hijos, setHijos] = useState([]);
  useEffect(() => { abrirRuta(raiz, ruta).then((d) => d && leerCarpeta(d)).then((r) => setHijos(r?.carpetas || [])); }, [ruta.join("/")]);
  return <ul>{hijos.map((h) => <Rama key={h} raiz={raiz} ruta={[...ruta, h]} nombre={h} sel={sel} onSel={onSel} abiertas={abiertas} alternar={alternar} nivel={1} />)}</ul>;
}
