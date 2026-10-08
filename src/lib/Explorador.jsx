// Explorador de la carpeta de la empresa (la de OneDrive / Drive sincronizada en el ordenador)
import { useEffect, useState } from "react";
import { abrirRuta, buscarContabilidad, QUE_VA } from "./carpetas.js";
import { useRaiz } from "./CarpetasUI.jsx";

export default function Explorador({ titulo, eyebrow, inicio = [], contabilidad = false }) {
  const { raiz, ok, pedir } = useRaiz();
  const [ruta, setRuta] = useState(null);
  const [items, setItems] = useState([]);
  const [arr, setArr] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { (async () => {
    if (!raiz || !ok) return;
    if (contabilidad) { const h = await buscarContabilidad(raiz); setRuta(h ? ["004 ADMINISTRACIÓN", h.name] : []); }
    else setRuta(inicio);
  })(); }, [raiz, ok]);

  const leer = async () => {
    if (!raiz || !ok || !ruta) return;
    const d = await abrirRuta(raiz, ruta);
    if (!d) return setItems([]);
    const out = [];
    for await (const [n, h] of d.entries()) {
      if (n.startsWith(".") || n.startsWith("~$")) continue;
      out.push(h.kind === "directory" ? { n, dir: true } : { n, h, f: await h.getFile() });
    }
    out.sort((a, b) => (a.dir === b.dir ? a.n.localeCompare(b.n, "es") : a.dir ? -1 : 1));
    setItems(out);
  };
  useEffect(() => { leer(); }, [ruta]);

  const abrirArchivo = (it) => { const u = URL.createObjectURL(it.f); window.open(u, "_blank", "noopener"); setTimeout(() => URL.revokeObjectURL(u), 60000); };
  const subir = async (files) => {
    const d = await abrirRuta(raiz, ruta, true);
    for (const f of files) {
      const [b, e] = f.name.match(/^(.*?)(\.[^.]+)?$/).slice(1); let n = f.name;
      for (let i = 2; i < 100; i++) { try { await d.getFileHandle(n); n = `${b} (${i})${e || ""}`; } catch { break; } }
      const w = await (await d.getFileHandle(n, { create: true })).createWritable(); await w.write(f); await w.close();
    }
    setMsg(`${files.length} archivo(s) guardado(s)`); leer();
  };

  const cab = (
    <header className="app-cab"><div><div className="eyebrow">{eyebrow}</div><h1>{titulo}</h1>
      <p className="muted">Tu carpeta de OneDrive / Drive, vista desde Mi Despacho. Los archivos no salen de tu ordenador.</p></div></header>
  );
  if (raiz === undefined) return <div className="app">{cab}</div>;
  if (!raiz) return <div className="app">{cab}<div className="vacio"><p><strong>Aún no has elegido la carpeta de tu empresa.</strong></p><a className="btn" href="#/carpetas">Configurar carpetas</a></div></div>;
  if (!ok) return <div className="app">{cab}<div className="vacio"><p>Permite a Mi Despacho abrir <strong>{raiz.name}</strong>.</p><button className="btn" type="button" onClick={pedir}>Permitir</button></div></div>;

  return (
    <div className="app">{cab}
      <nav className="migas">
        <button className="enlace" type="button" onClick={() => setRuta([])}>{raiz.name}</button>
        {(ruta || []).map((p, i) => <span key={i}> › <button className="enlace" type="button" onClick={() => setRuta(ruta.slice(0, i + 1))}>{p}</button></span>)}
      </nav>
      {ruta?.length === 1 && QUE_VA[ruta[0]] && <p className="nota">{QUE_VA[ruta[0]]}</p>}
      <div className={"soltar" + (arr ? " activo" : "")} onDragOver={(e) => { e.preventDefault(); setArr(true); }} onDragLeave={() => setArr(false)} onDrop={(e) => { e.preventDefault(); setArr(false); subir([...e.dataTransfer.files]); }}>
        Arrastra aquí archivos para guardarlos en esta carpeta, o <label className="enlace">elígelos<input type="file" multiple hidden onChange={(e) => subir([...e.target.files])} /></label>.
      </div>
      {msg && <p className="muted">{msg}</p>}
      {items.length === 0 ? <p className="muted">Carpeta vacía.</p> : (
        <ul className="lista-docs">{items.map((it) => (
          <li key={it.n}>{it.dir
            ? <button className="enlace carpeta-item" type="button" onClick={() => setRuta([...(ruta || []), it.n])}>📁 {it.n}</button>
            : <><button className="enlace" type="button" onClick={() => abrirArchivo(it)}>{it.n}</button><span className="muted">{new Date(it.f.lastModified).toLocaleDateString("es-ES")} · {Math.ceil(it.f.size / 1024)} KB</span></>}
          </li>))}</ul>
      )}
    </div>
  );
}
