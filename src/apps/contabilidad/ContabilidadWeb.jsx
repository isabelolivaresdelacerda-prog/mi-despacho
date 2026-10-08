// Mi contabilidad: la app vive en Mi Despacho y los documentos se quedan en la carpeta de la empresa (OneDrive / Drive).
import { useEffect, useMemo, useState } from "react";
import { raizGuardada, buscarContabilidad, permiso as permisoRaiz } from "../../lib/carpetas.js";
import {
  soportado, cargarTodo, CARPETAS, listar, abrir, subir,
  guardarEdicion, guardarLectura, guardarVinculo, eur, fechaOrden, TITULOS_PGC, libroFacturasCSV, diarioCSV, descargarTexto,
} from "./datos.js";
import { DialogoCorreo } from "../../lib/CorreoUI.jsx";
import EnviarGestoria from "./EnviarGestoria.jsx";
import Vinculados from "./Vinculados.jsx";
import Libros from "./Libros.jsx";
import { SelPeriodo, ResumenPeriodo, BancoPeriodo } from "./Periodo.jsx";
import { rango, enRango } from "./periodo.js";
import { generarDiario, usarPlan } from "./motor.js";
import Impuestos, { impuestosParaDiario, otrosParaDiario } from "./Impuestos.jsx";
import ExportarTodo from "./ExportarTodo.jsx";
import { noPagada } from "./periodo.js";
import { leerVinculados, leerJSON, escribirJSON } from "./datos.js";
import { EstadoIALocal, useAviso } from "../../comunes.jsx";
import "./contabilidad.css";

const PESTANAS = [["resumen", "Resumen"], ["facturas", "Facturas"], ["banco", "Banco y cierre"], ["impuestos", "Impuestos"], ["vinculados", "Escrituras y contratos"], ["libros", "Contabilidad"], ["documentos", "Documentos"], ["exportar", "Exportar A3 / Sage"]];

export default function ContabilidadWeb({ config, guardar: guardarConfig }) {
  const [raiz, setRaiz] = useState(null);
  const [necesitaPermiso, setNecesitaPermiso] = useState(false);
  const [datos, setDatos] = useState(null);
  const [tab, setTab] = useState("resumen");
  const [cargando, setCargando] = useState(false);
  const [aviso, nodoAviso] = useAviso();
  const [enviar, setEnviar] = useState(false);
  const [subLibros, setSubLibros] = useState("diario");
  // Periodo de trabajo: año + trimestre (1-4) o el año entero; se recuerda por usuario y empresa
  const [per, setPer] = useState(() => {
    try { const g = JSON.parse(localStorage.getItem("md-conta-periodo") || "null"); if (g?.anio) return g; } catch { /* nada */ }
    const h = new Date(); return { anio: h.getFullYear(), tramo: String(Math.floor(h.getMonth() / 3) + 1) };
  });
  const cambiarPeriodo = (anio, tramo) => { const n = { anio, tramo }; setPer(n); try { localStorage.setItem("md-conta-periodo", JSON.stringify(n)); } catch { /* nada */ } };
  const r = useMemo(() => rango(per.anio, per.tramo), [per]);
  const [verEmitidas, setVerEmitidas] = useState(false);
  const irA = (t, sub) => { if (t === "libros" && sub) setSubLibros(sub); if (t === "facturas") setVerEmitidas(sub === "emitidas"); setTab(t); window.scrollTo?.({ top: 0, behavior: "smooth" }); };
  // Llegada desde el calendario u otra app: «md-conta-ir» = pestaña
  useEffect(() => { try { const t = localStorage.getItem("md-conta-ir"); if (t) { localStorage.removeItem("md-conta-ir"); setTab(t); } } catch { /* nada */ } }, []);

  // Escrituras/contratos vinculados, asientos manuales, banco aplicado a mano y cierres del extracto
  const [extra, setExtra] = useState({ vinc: [], manuales: [], asig: {}, cierres: {}, presentados: {}, otros: [] });
  const ARCH = { vinc: "documentos_vinculados.json", manuales: "asientos_manuales.json", asig: "asignaciones_banco.json", cierres: "cierres_extracto.json", presentados: "impuestos_presentados.json", otros: "otros_tributos.json" };
  const cargarExtra = async (h = raiz) => {
    if (!h) return;
    const [vinc, manuales, asig, cierres, presentados, otros] = await Promise.all([leerVinculados(h), leerJSON(h, ARCH.manuales, []), leerJSON(h, ARCH.asig, {}), leerJSON(h, ARCH.cierres, {}), leerJSON(h, ARCH.presentados, {}), leerJSON(h, ARCH.otros, [])]);
    setExtra({ vinc, manuales, asig, cierres, presentados, otros });
  };
  const guardarExtra = async (k, v) => { await escribirJSON(raiz, ARCH[k], v); setExtra((e) => ({ ...e, [k]: v })); };

  const cargar = async (h = raiz) => {
    if (!h) return;
    setCargando(true);
    try { const [d] = await Promise.all([cargarTodo(h), cargarExtra(h)]); setDatos(d); } catch { aviso("No se pudo leer la carpeta."); }
    setCargando(false);
  };
  const tipoPlan = config?.planContable || "pymes";
  usarPlan(tipoPlan);
  const diario = useMemo(() => (datos ? generarDiario(datos, extra.vinc, extra.manuales, extra.asig, [...impuestosParaDiario(extra.presentados), ...otrosParaDiario(extra.otros)]) : { asientos: [], pendientes: [], sinPagar: new Set() }), [datos, extra, tipoPlan]);
  // Datos con el estado de pago calculado por saldo de cada tercero
  const dd = useMemo(() => (datos ? { ...datos, sinPagar: diario.sinPagar } : null), [datos, diario]);
  const anios = useMemo(() => {
    const h = new Date().getFullYear(); const s = new Set([h, per.anio]);
    for (const x of [...(datos?.facturas || []), ...(datos?.emitidas || []), ...(datos?.movimientos || [])]) { const y = +fechaOrden(x.fecha).slice(0, 4); if (y > 2000 && y <= h + 1) s.add(y); }
    return [...s].sort((a, b) => b - a);
  }, [datos, per.anio]);

  const [empresa, setEmpresa] = useState(undefined); // carpeta raíz de la empresa
  const [sinConta, setSinConta] = useState(false);
  const localizar = async (r, pedir = false) => {
    if (!(await permisoRaiz(r, pedir))) { setNecesitaPermiso(true); return; }
    setNecesitaPermiso(false);
    const h = await buscarContabilidad(r);
    if (!h) { setSinConta(true); return; }
    setSinConta(false); setRaiz(h); cargar(h);
  };
  useEffect(() => { (async () => { const r = await raizGuardada(); setEmpresa(r || null); if (r) localizar(r); })(); }, []);

  if (!soportado()) return (
    <div className="app"><Cabecera />
      <div className="vacio"><p><strong>Abre Mi Despacho con Chrome o Edge en tu ordenador.</strong></p>
        <p>La contabilidad trabaja directamente sobre la carpeta de tu empresa en OneDrive o Google Drive, y eso solo lo permiten estos navegadores.</p></div>
    </div>
  );
  if (empresa === undefined) return <div className="app"><Cabecera /></div>;
  if (!empresa) return (
    <div className="app"><Cabecera />
      <div className="vacio">
        <p><strong>Primero elige la carpeta de tu empresa.</strong></p>
        <p>Es la carpeta de tu OneDrive con el nombre de la empresa (por ejemplo, <em>beatriz</em>). La contabilidad está dentro, en <em>004 ADMINISTRACIÓN › contabilidad</em>.</p>
        <a className="btn" href="#/carpetas">Configurar carpetas</a>
      </div>
    </div>
  );
  if (necesitaPermiso) return (
    <div className="app"><Cabecera carpeta={empresa.name} />
      <div className="vacio"><p>Para seguir, permite a Mi Despacho abrir la carpeta <strong>{empresa.name}</strong>.</p>
        <button className="btn" type="button" onClick={() => localizar(empresa, true)}>Permitir</button></div>
    </div>
  );
  if (sinConta) return (
    <div className="app"><Cabecera carpeta={empresa.name} />
      <div className="vacio"><p>No hay carpeta de contabilidad en <strong>{empresa.name} › 004 ADMINISTRACIÓN</strong>.</p>
        <button className="btn" type="button" onClick={async () => { const h = await buscarContabilidad(empresa, true, (config?.nombre || "").split(/[ ,]/)[0].toLowerCase()); setSinConta(false); setRaiz(h); cargar(h); }}>Crear la carpeta de contabilidad</button></div>
    </div>
  );
  if (!raiz) return <div className="app"><Cabecera carpeta={empresa.name} /></div>;

  return (
    <div className="app">
      <Cabecera carpeta={`${empresa.name} › 004 ADMINISTRACIÓN › ${raiz.name}`} acciones={<>
        <button className="btn" type="button" disabled={!datos} onClick={() => setEnviar(true)}>Enviar a la gestoría</button>
        <button className="btn ghost" type="button" onClick={() => cargar()}>{cargando ? "Leyendo…" : "Actualizar"}</button>
        <a className="btn ghost" href="#/carpetas">Carpetas</a>
      </>} />
      <nav className="cont-tabs" role="tablist">
        {PESTANAS.map(([k, t]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{t}</button>)}
      </nav>
      {datos && ["resumen", "facturas", "banco", "libros", "exportar"].includes(tab) && <SelPeriodo anio={per.anio} tramo={per.tramo} cambiar={cambiarPeriodo} cierres={extra.cierres} anios={anios} />}
      {!datos ? <p className="muted">Leyendo la carpeta…</p> : <>
        {tab === "resumen" && <ResumenPeriodo d={dd} todos={diario.asientos} pendientes={diario.pendientes} vinculados={extra.vinc} r={r} cambiar={cambiarPeriodo} cierres={extra.cierres} irA={irA} />}
        {tab === "facturas" && <Facturas d={dd} r={r} raiz={raiz} recargar={cargar} aviso={aviso} emitidas={verEmitidas} setEmitidas={setVerEmitidas} />}
        {tab === "banco" && <BancoPeriodo d={dd} raiz={raiz} recargar={cargar} todos={diario.asientos} pendientes={diario.pendientes} r={r} cierres={extra.cierres} guardarCierres={(n) => guardarExtra("cierres", n)} irA={irA} aviso={aviso} />}
        {tab === "impuestos" && <Impuestos raiz={raiz} d={dd} todos={diario.asientos} pendientes={diario.pendientes} anio={per.anio} anios={anios} cambiarAnio={(a) => cambiarPeriodo(a, per.tramo)} presentados={extra.presentados} guardar={(n) => guardarExtra("presentados", n)} otros={extra.otros} guardarOtros={(n) => guardarExtra("otros", n)} opciones={config?.calendario || {}} entidad={config?.empresa?.forma || "sl"} aviso={aviso} />}
        {tab === "libros" && <Libros datos={dd} diario={diario} extra={extra} guardarExtra={guardarExtra} r={r} sub={subLibros} setSub={setSubLibros} config={config} guardarConfig={guardarConfig} aviso={aviso} />}
        {tab === "vinculados" && <Vinculados raiz={raiz} empresa={empresa} movimientos={datos.movimientos} aviso={aviso} onCambio={() => cargarExtra()} />}
        {tab === "documentos" && <Documentos raiz={raiz} aviso={aviso} recargar={cargar} />}
        {tab === "exportar" && <ExportarTodo d={dd} diario={diario} extra={extra} r={r} config={config} raiz={raiz} aviso={aviso} />}
      </>}
      {enviar && datos && <EnviarGestoria raiz={raiz} empresa={empresa} datos={dd} diario={diario} extra={extra} r={r} config={config} aviso={aviso} onCerrar={() => setEnviar(false)} />}
      {nodoAviso}
    </div>
  );
}

function Cabecera({ carpeta, acciones }) {
  return (
    <header className="app-cab">
      <div>
        <div className="eyebrow">Contabilidad</div>
        <h1>Mi contabilidad</h1>
        <p className="muted">{carpeta ? <>Trabajando sobre la carpeta <strong>{carpeta}</strong>. Los documentos se quedan en tu OneDrive / Drive.</> : "La app está en Mi Despacho; tus documentos, en tu OneDrive o Google Drive."}</p>
      </div>
      {acciones && <div className="acciones">{acciones}</div>}
    </header>
  );
}


const CAMPOS_E = [["fecha", "Fecha"], ["numero", "Número"], ["cliente", "Cliente"], ["nif_cliente", "NIF"], ["base", "Base"], ["iva_pct", "% IVA"], ["iva_importe", "IVA"], ["retencion_pct", "% Ret."], ["retencion_importe", "Retención"], ["total", "Total"], ["cuenta_pgc", "Cuenta"]];
const CAMPOS = [["fecha", "Fecha"], ["numero", "Número"], ["proveedor", "Proveedor"], ["nif_proveedor", "NIF"], ["base", "Base"], ["iva_pct", "% IVA"], ["iva_importe", "IVA"], ["retencion_pct", "% Ret."], ["retencion_importe", "Retención"], ["total", "Total"], ["cuenta_pgc", "Cuenta"]];

function Facturas({ d, r, raiz, recargar, aviso, emitidas = false, setEmitidas }) {
  const fuente = emitidas ? d.emitidas || [] : d.facturas;
  const campos = emitidas ? CAMPOS_E : CAMPOS;
  const ter = emitidas ? "cliente" : "proveedor";
  const [edit, setEdit] = useState(null);
  const [leyendo, setLeyendo] = useState("");
  const [filtro, setFiltro] = useState("");
  const [todas, setTodas] = useState(false);
  const lista = useMemo(() => fuente.filter((f) => todas || enRango(f.fecha, r) || fechaOrden(f.fecha).startsWith("9999")).filter((f) => !filtro || JSON.stringify([f[ter], f.numero, f.archivo]).toLowerCase().includes(filtro.toLowerCase()))
    .sort((a, b) => fechaOrden(b.fecha).localeCompare(fechaOrden(a.fecha))), [fuente, filtro, r, todas]);
  const sinLeer = fuente.filter((f) => !f._leida && /\.pdf$/i.test(f.archivo));

  const leerPendientes = async () => {
    for (const f of sinLeer) {
      setLeyendo(f.archivo);
      try {
        const file = await f._arch.h.getFile();
        const { leerFactura } = await import("./leer.js");
        const r = await leerFactura(file);
        if (r.datos) await guardarLectura(raiz, f.archivo, file.lastModified, { archivo: f.archivo, ...r.datos, ...(emitidas ? { cuenta_pgc: "705" } : {}) }, emitidas);
      } catch { /* sigue con la siguiente */ }
    }
    setLeyendo(""); aviso("Facturas leídas. Revisa las marcadas como «lectura básica»."); recargar();
  };

  return (
    <div>
      <div className="acciones cont-barra">
        <nav className="sub-tabs"><button className={!emitidas ? "on" : ""} onClick={() => setEmitidas(false)}>Recibidas ({d.facturas.length})</button><button className={emitidas ? "on" : ""} onClick={() => setEmitidas(true)}>Emitidas ({(d.emitidas || []).length})</button></nav>
        <label className="btn ghost">Subir facturas<input type="file" multiple hidden accept=".pdf,image/*" onChange={async (e) => { const f = [...e.target.files]; e.target.value = ""; if (!f.length) return; await subir(raiz, emitidas ? "facturas_emitidas" : "facturas", f); aviso(`Guardadas en «${emitidas ? "facturas_emitidas" : "facturas"}»`); recargar(); }} /></label>
        <input className="buscar" placeholder={emitidas ? "Buscar cliente, número…" : "Buscar proveedor, número…"} value={filtro} onChange={(e) => setFiltro(e.target.value)} />
        {sinLeer.length > 0 && <button className="btn" type="button" disabled={!!leyendo} onClick={leerPendientes}>{leyendo ? `Leyendo ${leyendo}…` : `Leer ${sinLeer.length} facturas nuevas`}</button>}
        <label className="check"><input type="checkbox" checked={todas} onChange={(e) => setTodas(e.target.checked)} /> Ver todos los periodos</label>
        <EstadoIALocal compacto />
      </div>
      <p className="muted pequeño">La IA solo propone los datos; revisa cada factura. Las correcciones se guardan en tu carpeta y valen también para la app de escritorio.</p>
      <div className="tabla-scroll">
        <table className="tabla">
          <thead><tr><th>Fecha</th><th>{emitidas ? "Cliente" : "Proveedor"}</th><th>Número</th><th className="num">Base</th><th className="num">IVA</th><th className="num">Ret.</th><th className="num">Total</th><th>Cta.</th><th>{emitidas ? "Cobro" : "Pago"}</th><th></th></tr></thead>
          <tbody>{lista.map((f) => (
            <tr key={f.archivo} className={!f._leida ? "sin-leer" : undefined}>
              <td>{f.fecha || "—"}</td>
              <td>{f[ter] || <em className="muted">{f.archivo}</em>}{f.analizado_ia && !f._editada && <span className="etq" title="Datos propuestos por IA, sin revisar">IA</span>}</td>
              <td>{f.numero}</td><td className="num">{eur(f.base)}</td><td className="num">{eur(f.iva_importe)}</td><td className="num">{f.retencion_importe ? eur(f.retencion_importe) : ""}</td>
              <td className="num"><strong>{eur(f.total)}</strong></td><td title={TITULOS_PGC[f.cuenta_pgc]}>{f.cuenta_pgc}</td>
              <td>{!f.total ? "" : !noPagada(f, d) ? <span className="ok" title={(f._pago || f._cobro)?.texto}>{emitidas ? "Cobrada" : "Pagada"}{(f._pago || f._cobro)?.fecha ? " " + (f._pago || f._cobro).fecha : ""}</span> : <span className="pend">Pendiente</span>}</td>
              <td className="acciones">
                <button className="enlace" type="button" onClick={() => abrir(f._arch)}>Ver</button>
                <button className="enlace" type="button" onClick={() => setEdit({ ...f })}>Corregir</button>
              </td>
            </tr>))}</tbody>
        </table>
      </div>
      {edit && (
        <div className="mc-fondo" role="dialog" aria-modal="true">
          <div className="mc-dialogo">
            <header><h2>Corregir factura {emitidas ? "emitida" : "recibida"}</h2><button className="mc-x" onClick={() => setEdit(null)} aria-label="Cerrar">×</button></header>
            <div className="mc-cuerpo">
              <p className="muted pequeño">{edit.archivo} · <button className="enlace" type="button" onClick={() => abrir(edit._arch)}>ver el PDF</button></p>
              <div className="rejilla-edit">
                {campos.map(([k, t]) => <label key={k} className="mc-campo"><span>{t}</span><input value={edit[k] ?? ""} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} /></label>)}
              </div>
              {!emitidas && <label className="mc-campo"><span>Pago (si se pagó por otra vía: quién lo pagó, p. ej. «Pagado por Solve con la provisión»)</span>
                <input value={edit._pagoTxt ?? (edit._pago?.manual ? edit._pago.texto : "")} placeholder="p. ej. Pagado por Solve con la provisión" onChange={(e) => setEdit({ ...edit, _pagoTxt: e.target.value })} />
              </label>}
            </div>
            <footer>
              <button className="mc-btn sec" onClick={() => setEdit(null)}>Cancelar</button>
              <button className="mc-btn" onClick={async () => {
                const cambios = {}; campos.forEach(([k]) => (cambios[k] = String(edit[k] ?? "")));
                await guardarEdicion(raiz, edit.archivo, cambios, emitidas);
                if (edit._pagoTxt !== undefined) await guardarVinculo(raiz, edit.archivo, edit._pagoTxt.trim() ? { descripcion: edit._pagoTxt.trim(), fecha: "", archivo_banco: "" } : null);
                setEdit(null); aviso("Factura corregida"); recargar();
              }}>Guardar</button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

function Documentos({ raiz, aviso, recargar }) {
  const [carpeta, setCarpeta] = useState("facturas");
  const [archivos, setArchivos] = useState([]);
  const [arrastrando, setArrastrando] = useState(false);
  const ver = async (c = carpeta) => setArchivos(await listar(raiz, c));
  useEffect(() => { ver(carpeta); }, [carpeta]);
  const soltar = async (files) => {
    if (!files?.length) return;
    const n = await subir(raiz, carpeta, [...files]);
    aviso(`Guardado en ${carpeta}: ${n.join(", ")}`); ver(); recargar();
  };
  return (
    <div className="cont-docs">
      <aside>{CARPETAS.map((c) => <button key={c.id} type="button" className={carpeta === c.id ? "on" : ""} onClick={() => setCarpeta(c.id)}>{c.nombre}</button>)}</aside>
      <section>
        <div className={"soltar" + (arrastrando ? " activo" : "")} onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }} onDragLeave={() => setArrastrando(false)}
          onDrop={(e) => { e.preventDefault(); setArrastrando(false); soltar(e.dataTransfer.files); }}>
          Arrastra aquí documentos para guardarlos en <strong>{CARPETAS.find((c) => c.id === carpeta).nombre}</strong>, o
          <label className="enlace"> elígelos<input type="file" multiple hidden onChange={(e) => soltar(e.target.files)} /></label>.
        </div>
        {archivos.length === 0 ? <p className="muted">Esta carpeta está vacía.</p> : (
          <ul className="lista-docs">{archivos.map((a) => <li key={a.nombre}><button className="enlace" type="button" onClick={() => abrir(a)}>{a.nombre}</button><span className="muted">{new Date(a.mtime).toLocaleDateString("es-ES")} · {Math.ceil(a.tam / 1024)} KB</span></li>)}</ul>
        )}
      </section>
    </div>
  );
}

