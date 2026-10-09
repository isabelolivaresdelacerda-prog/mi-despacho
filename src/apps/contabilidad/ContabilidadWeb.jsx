// Mi contabilidad: la app vive en Mi Despacho y los documentos se quedan en la carpeta de la empresa (OneDrive / Drive).
import { useEffect, useMemo, useRef, useState } from "react";
import { raizGuardada, buscarContabilidad, permiso as permisoRaiz } from "../../lib/carpetas.js";
import {
  soportado, cargarTodo, CARPETAS, listar, abrir, subir,
  guardarEdicion, guardarLectura, guardarVinculo, claveMovDatos, marcarSinTexto, eur, fechaOrden, TITULOS_PGC, libroFacturasCSV, diarioCSV, descargarTexto,
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
import MensajeGestoria from "./MensajeGestoria.jsx";
import Bandeja, { CARPETA_ENTRADA } from "./Bandeja.jsx";
import { revisarCarpeta } from "./inventario.js";
import { planPorDefecto, opcionesFiscales, esESFL } from "../../lib/entidad.js";
import { noPagada } from "./periodo.js";
import { leerVinculados, leerJSON, escribirJSON, corregirPropia } from "./datos.js";
import { AvisoIA, EstadoIALocal, useAviso } from "../../comunes.jsx";
import "./contabilidad.css";

const PESTANAS = [["resumen", "Resumen"], ["bandeja", "Bandeja de entrada"], ["facturas", "Facturas"], ["banco", "Banco y cierre"], ["impuestos", "Impuestos"], ["vinculados", "Escrituras y contratos"], ["libros", "Contabilidad"], ["documentos", "Documentos"], ["gestoria", "Mensaje gestoría"], ["exportar", "Exportar A3 / Sage"]];

export default function ContabilidadWeb({ config, guardar: guardarConfig, empresaId }) {
  const [raiz, setRaiz] = useState(null);
  const [necesitaPermiso, setNecesitaPermiso] = useState(false);
  const [datos, setDatos] = useState(null);
  const [tab, setTab] = useState("resumen");
  const [cargando, setCargando] = useState(false);
  const [aviso, nodoAviso] = useAviso();
  const [enviar, setEnviar] = useState(false);
  const [subLibros, setSubLibros] = useState("diario");
  const [tarea, setTarea] = useState(null); // «Hacer todo con la IA»: { paso, res }
  const [renovar, setRenovar] = useState(null); // ventana «Renovar banco»: { motivo }
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

  // Al abrir la contabilidad, la app revisa sola la carpeta de la empresa (solo lee lo nuevo)
  const [revAuto, setRevAuto] = useState(0);
  useEffect(() => { if (raiz) import("./leer.js").then((m) => m.usarRegistroTextos(raiz)); }, [raiz]);
  const revisado = useRef(false);
  useEffect(() => { if (!datos || !empresa || !raiz || revisado.current) return; revisado.current = true;
    revisarCarpeta({ empresa, raiz, propia }).then((x) => { setRevAuto((n) => n + 1); if (x.vinculados) { cargarExtra(); aviso(`La app ha leído ${x.nuevos.length} documentos nuevos de la carpeta de la empresa y ha vinculado ${x.vinculados} a la contabilidad. Revísalos en «Escrituras y contratos».`); } }).catch(() => {});
  }, [datos]);

  // Documentos esperando en la bandeja de entrada (llegados por correo o arrastrados)
  const [nEntrada, setNEntrada] = useState(0);
  // Recoge lo que ha llegado al correo de contabilidad y lo deja en la carpeta «entrada»
  const recogerCorreo = async (h) => {
    try {
      const { correoEntrada } = await import("../../lib/cuentas.js");
      const lista = (await correoEntrada.pendientes()).filter((x) => !empresaId || x.empresa_id === empresaId);
      if (!lista.length) return 0;
      const dir = await h.getDirectoryHandle(CARPETA_ENTRADA, { create: true });
      let n = 0;
      for (const x of lista) {
        const blob = await correoEntrada.descargar(x.ruta);
        let nombre = x.nombre; const [b, e] = nombre.match(/^(.*?)(\.[^.]+)?$/).slice(1);
        for (let k = 2; k < 100; k++) { try { await dir.getFileHandle(nombre); nombre = `${b} (${k})${e || ""}`; } catch { break; } }
        const w = await (await dir.getFileHandle(nombre, { create: true })).createWritable(); await w.write(blob); await w.close();
        await correoEntrada.recogido(x); n++;
      }
      if (n) aviso(`Han llegado ${n} documentos al correo de contabilidad: están en la bandeja de entrada.`);
      return n;
    } catch { return 0; }
  };
  const contarEntrada = async (h = raiz) => { if (!h) return; try { setNEntrada((await listar(h, CARPETA_ENTRADA)).filter((x) => !/^_/.test(x.nombre)).length); } catch { setNEntrada(0); } };
  useEffect(() => { if (raiz) recogerCorreo(raiz).then(() => contarEntrada()); }, [raiz]);

  const cargar = async (h = raiz) => {
    if (!h) return;
    setCargando(true);
    try { const [d] = await Promise.all([cargarTodo(h), cargarExtra(h)]); setDatos(d); } catch { aviso("No se pudo leer la carpeta."); }
    setCargando(false);
  };
  const tipoPlan = planPorDefecto(config);
  usarPlan(tipoPlan);
  // Datos de la propia empresa (Ajustes) para no confundir emisor y receptor
  const propia = useMemo(() => ({ nombre: config?.empresa?.razon_social || config?.nombre || "", cif: config?.empresa?.cif || "" }), [config]);
  const datosC = useMemo(() => (datos ? corregirPropia(datos, propia) : null), [datos, propia]);
  const diario = useMemo(() => (datosC ? generarDiario({ ...datosC, facturas: datosC.facturas.filter((f) => !f._duplicadoDe && !f.noFactura), emitidas: (datosC.emitidas || []).filter((f) => !f._duplicadoDe) }, extra.vinc, extra.manuales, extra.asig, [...impuestosParaDiario(extra.presentados), ...otrosParaDiario(extra.otros)]) : { asientos: [], pendientes: [], sinPagar: new Set() }), [datosC, extra, tipoPlan]);
  // Datos con el estado de pago calculado por saldo de cada tercero
  const dd = useMemo(() => (datosC ? { ...datosC, sinPagar: diario.sinPagar } : null), [datosC, diario]);
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
        <button className="btn" type="button" disabled={!datos || !!tarea?.paso} title="Lee todas las facturas y documentos del banco (con OCR si son escaneados), los renombra con tu formato, puntea el banco y revisa la carpeta de la empresa" onClick={async () => {
          setTarea({ paso: "Empezando…" });
          const { hacerTodo } = await import("./tareasIA.js");
          const res = await hacerTodo({ raiz, empresa, propia, datos: corregirPropia(datos, propia), onPaso: (t) => setTarea((x) => ({ ...x, paso: t })) });
          setTarea({ paso: "", res }); if (res.bancoCaducado) setRenovar({ motivo: "La IA no pudo traer el banco: el permiso ha caducado (por ley hay que renovarlo cada 90 días)." }); await cargarExtra(); await cargar();
        }}>{tarea?.paso ? "La IA está trabajando…" : "✨ Hacer todo con la IA"}</button>
        <button className="btn ghost" type="button" disabled={!datos || !!tarea?.paso} title="Trae los movimientos nuevos de tu cuenta (conexión segura PSD2). Si el permiso del banco ha caducado, te ofrece renovarlo" onClick={async () => { try { setTarea({ paso: "Trayendo los movimientos del banco…" }); const b = await import("./banco.js"); const x = await b.sincronizarBanco(raiz); setTarea(null); aviso(`Banco al día: ${x.nuevos} movimientos recibidos (${x.total} en total)`); if (x.diasPermiso != null && x.diasPermiso <= 10) setRenovar({ motivo: `El permiso del banco caduca en ${Math.max(0, x.diasPermiso)} días. Renuévalo ahora y no se corta la sincronización.`, pronto: true }); cargar(); } catch (e) { setTarea(null); if (e.caducado) setRenovar({ motivo: e.message }); else aviso(String(e.message || e)); } }}>Sincronizar banco</button>
        <button className="btn ghost" type="button" disabled={!datos} onClick={() => setEnviar(true)}>Enviar a la gestoría</button>
        <button className="btn ghost" type="button" onClick={() => cargar()}>{cargando ? "Leyendo…" : "Actualizar"}</button>
        <a className="btn ghost" href="#/carpetas">Carpetas</a>
      </>} />
      {renovar && <RenovarBanco raiz={raiz} motivo={renovar.motivo} pronto={renovar.pronto} onCerrar={() => setRenovar(null)} onHecho={async (txt) => { setRenovar(null); aviso(txt); await cargar(); }} />}
      {tarea && (tarea.paso ? <div className="tarea-ia" role="status"><span className="girando" aria-hidden="true" /> <strong>La IA está trabajando en tu ordenador.</strong> {tarea.paso} <span className="muted">Puedes seguir usando la app; no cierres esta pestaña.</span></div>
        : tarea.res && <div className="tarea-ia hecha" role="status"><strong>Hecho.</strong> {tarea.res.bancoNuevos != null ? `Banco: ${tarea.res.bancoNuevos} movimientos traídos · ` : ""}{tarea.res.facturas} facturas leídas{tarea.res.ilegibles ? ` (${tarea.res.ilegibles} ilegibles: rellénalas a mano)` : ""} · {tarea.res.banco} documentos del banco leídos ({tarea.res.punteables} con importe para puntear) · {tarea.res.renombrados} renombrados · {tarea.res.punteados || 0} movimientos del banco punteados{tarea.res.inventario ? ` · carpeta de la empresa: ${tarea.res.inventario.nuevos.length} documentos leídos, ${tarea.res.inventario.vinculados} vinculados` : ""}.{tarea.res.errores.length > 0 && <details><summary>{tarea.res.errores.length} avisos</summary><ul className="pequeño">{tarea.res.errores.slice(0, 30).map((e, i) => <li key={i}>{e}</li>)}</ul></details>} <button className="enlace" type="button" onClick={() => setTarea(null)}>Cerrar</button></div>)}
      <nav className="cont-tabs" role="tablist">
        {PESTANAS.map(([k, t]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{t}{k === "bandeja" && nEntrada > 0 && <span className="insignia">{nEntrada}</span>}</button>)}
      </nav>
      {datos && ["resumen", "facturas", "banco", "libros", "gestoria", "exportar"].includes(tab) && <SelPeriodo anio={per.anio} tramo={per.tramo} cambiar={cambiarPeriodo} cierres={extra.cierres} anios={anios} />}
      {!datos ? <p className="muted">Leyendo la carpeta…</p> : <>
        {tab === "resumen" && <ResumenPeriodo esfl={esESFL(config)} d={dd} todos={diario.asientos} pendientes={diario.pendientes} vinculados={extra.vinc} r={r} cambiar={cambiarPeriodo} cierres={extra.cierres} irA={irA} />}
        {tab === "facturas" && <Facturas d={dd} propia={propia} r={r} raiz={raiz} recargar={cargar} aviso={aviso} emitidas={verEmitidas} setEmitidas={setVerEmitidas} />}
        {tab === "banco" && <BancoPeriodo d={dd} raiz={raiz} propia={propia} recargar={cargar} todos={diario.asientos} pendientes={diario.pendientes} r={r} cierres={extra.cierres} guardarCierres={(n) => guardarExtra("cierres", n)} irA={irA} aviso={aviso} />}
        {tab === "impuestos" && <Impuestos raiz={raiz} d={dd} todos={diario.asientos} pendientes={diario.pendientes} anio={per.anio} anios={anios} cambiarAnio={(a) => cambiarPeriodo(a, per.tramo)} presentados={extra.presentados} guardar={(n) => guardarExtra("presentados", n)} otros={extra.otros} guardarOtros={(n) => guardarExtra("otros", n)} opciones={opcionesFiscales(config)} aviso={aviso} config={config} />}
        {tab === "libros" && <Libros datos={dd} diario={diario} extra={extra} guardarExtra={guardarExtra} r={r} sub={subLibros} setSub={setSubLibros} config={config} guardarConfig={guardarConfig} aviso={aviso} />}
        {tab === "bandeja" && <Bandeja raiz={raiz} empresa={empresa} propia={propia} aviso={aviso} recargar={cargar} onCambio={() => { cargarExtra(); contarEntrada(); }} />}
        {tab === "vinculados" && <Vinculados raiz={raiz} empresa={empresa} movimientos={datos.movimientos} aviso={aviso} onCambio={() => cargarExtra()} propia={propia} revisionAuto={revAuto} />}
        {tab === "documentos" && <Documentos raiz={raiz} aviso={aviso} recargar={cargar} />}
        {tab === "gestoria" && <MensajeGestoria raiz={raiz} d={dd} diario={diario} extra={extra} r={r} config={config} aviso={aviso} />}
        {tab === "exportar" && <ExportarTodo d={dd} diario={diario} extra={extra} r={r} config={config} guardarConfig={guardarConfig} raiz={raiz} aviso={aviso} />}
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
      <div style={{ flexBasis: "100%" }}><AvisoIA /></div>
    </header>
  );
}


const CAMPOS_E = [["fecha", "Fecha"], ["numero", "Número"], ["cliente", "Cliente"], ["nif_cliente", "NIF"], ["base", "Base"], ["iva_pct", "% IVA"], ["iva_importe", "IVA"], ["retencion_pct", "% Ret."], ["retencion_importe", "Retención"], ["total", "Total"], ["cuenta_pgc", "Cuenta"]];
const CAMPOS = [["fecha", "Fecha"], ["numero", "Número"], ["proveedor", "Proveedor"], ["nif_proveedor", "NIF"], ["base", "Base"], ["iva_pct", "% IVA"], ["iva_importe", "IVA"], ["retencion_pct", "% Ret."], ["retencion_importe", "Retención"], ["total", "Total"], ["cuenta_pgc", "Cuenta"]];

// Vista previa del documento dentro del cuadro de corrección
function VistaDoc({ arch }) {
  const [url, setUrl] = useState("");
  useEffect(() => { let u = ""; (async () => { if (!arch) return; const f = await arch.h.getFile(); u = URL.createObjectURL(f); setUrl(u); })(); return () => u && URL.revokeObjectURL(u); }, [arch]);
  if (!url) return <div className="vista-doc vacia">Cargando el documento…</div>;
  return /\.(jpe?g|png)$/i.test(arch.nombre) ? <img className="vista-doc" src={url} alt="Documento" /> : <iframe className="vista-doc" src={url} title="Documento" />;
}

function Facturas({ d, propia, r, raiz, recargar, aviso, emitidas = false, setEmitidas }) {
  const fuente = emitidas ? d.emitidas || [] : d.facturas;
  const campos = emitidas ? CAMPOS_E : CAMPOS;
  const ter = emitidas ? "cliente" : "proveedor";
  const [edit, setEdit] = useState(null);
  const [leyendo, setLeyendo] = useState("");
  const [elegir, setElegir] = useState(null); // factura a la que se busca el pago en el extracto
  const [filtro, setFiltro] = useState("");
  const [todas, setTodas] = useState(false);
  const lista = useMemo(() => fuente.filter((f) => todas || enRango(f.fecha, r) || fechaOrden(f.fecha).startsWith("9999")).filter((f) => !filtro || JSON.stringify([f[ter], f.numero, f.archivo]).toLowerCase().includes(filtro.toLowerCase()))
    .sort((a, b) => fechaOrden(b.fecha).localeCompare(fechaOrden(a.fecha))), [fuente, filtro, r, todas]);
  const sinLeer = fuente.filter((f) => !f._leida && !f._sinTexto && !f._duplicadoDe && !f.noFactura && /\.(pdf|jpe?g|png)$/i.test(f.archivo));
  const escaneadas = fuente.filter((f) => f._sinTexto && !f._duplicadoDe);

  const leerPendientes = async () => {
    let ok = 0, escan = 0, fallo = 0, basica = 0;
    for (const f of sinLeer) {
      setLeyendo(f.archivo);
      try {
        const file = await f._arch.h.getFile();
        const { leerFactura } = await import("./leer.js");
        const r = await leerFactura(file, { propia, emitida: emitidas });
        if (r.datos) { await guardarLectura(raiz, f.archivo, file.lastModified, { archivo: f.archivo, ...r.datos, ...(emitidas ? { cuenta_pgc: "705" } : {}) }, emitidas); ok++; if (!r.datos.analizado_ia) basica++; }
        else { await marcarSinTexto(raiz, f.archivo, file.lastModified, emitidas); escan++; }
      } catch { fallo++; }
    }
    setLeyendo("");
    aviso([ok && `${ok} leídas${basica ? ` (${basica} con lectura básica porque la IA local no está encendida: revísalas)` : ""}`, escan && `${escan} escaneadas sin texto: rellénalas a mano con «Corregir»`, fallo && `${fallo} no se han podido abrir`].filter(Boolean).join(" · ") || "Nada que leer");
    recargar();
  };

  return (
    <div>
      <div className="acciones cont-barra">
        <nav className="sub-tabs"><button className={!emitidas ? "on" : ""} onClick={() => setEmitidas(false)}>Recibidas ({d.facturas.length})</button><button className={emitidas ? "on" : ""} onClick={() => setEmitidas(true)}>Emitidas ({(d.emitidas || []).length})</button></nav>
        <label className="btn ghost">Subir facturas<input type="file" multiple hidden accept=".pdf,image/*" onChange={async (e) => { const f = [...e.target.files]; e.target.value = ""; if (!f.length) return; await subir(raiz, emitidas ? "facturas_emitidas" : "facturas", f); aviso(`Guardadas en «${emitidas ? "facturas_emitidas" : "facturas"}»`); recargar(); }} /></label>
        <input className="buscar" placeholder={emitidas ? "Buscar cliente, número…" : "Buscar proveedor, número…"} value={filtro} onChange={(e) => setFiltro(e.target.value)} />
        <button className="btn ghost" type="button" disabled={!!leyendo} title="Libro de facturas del periodo, numerado, y un PDF con todas las facturas en ese orden y selladas con su número" onClick={async () => {
          setLeyendo("libro");
          try {
            const { numerarLibro, libroCSV, libroPDF } = await import("./libroPDF.js");
            const libro = numerarLibro(fuente.filter((f) => enRango(f.fecha, r)), emitidas ? "cliente" : "proveedor");
            if (!libro.length) { aviso("No hay facturas en este periodo"); return; }
            const tipo = emitidas ? "emitidas" : "recibidas", eti = r.etiqueta || "";
            descargarTexto(libroCSV(libro, emitidas), `Libro facturas ${tipo} ${eti}.csv`);
            const { bytes, avisos } = await libroPDF(libro, { titulo: `Libro de facturas ${tipo} · ${eti}`, empresa: propia?.nombre, emitidas, onPaso: (t) => setLeyendo(t) });
            const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })), a = document.createElement("a");
            a.href = url; a.download = `Facturas ${tipo} ${eti} (numeradas).pdf`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
            aviso(`Libro y PDF de ${libro.length} facturas descargados${avisos.length ? ` · ${avisos.length} no se pudieron añadir` : ""}`);
          } catch (e) { aviso("No se ha podido hacer el PDF: " + (e.message || e)); } finally { setLeyendo(""); }
        }}>Libro + PDF de facturas</button>
        <button className="btn ghost" type="button" disabled={!!leyendo} title="Renombra las facturas leídas con tu formato: AAMMDD - PROVEEDOR NºFACTURA IMPORTE" onClick={async () => { setLeyendo("nombres"); const { renombrarFacturas } = await import("./tareasIA.js"); const err = []; const n = await renombrarFacturas(raiz, emitidas, err); setLeyendo(""); aviso(`${n} facturas renombradas${err.length ? ` · ${err.length} avisos: ${err[0]}` : ""}`); recargar(); }}>Poner nombre a las facturas</button>
        {sinLeer.length > 0 && <button className="btn" type="button" disabled={!!leyendo} onClick={leerPendientes}>{leyendo ? `Leyendo ${leyendo}…` : `Leer ${sinLeer.length} facturas nuevas`}</button>}
        {escaneadas.length > 0 && <span className="pend pequeño">{escaneadas.length} escaneada{escaneadas.length > 1 ? "s" : ""}: rellénala{escaneadas.length > 1 ? "s" : ""} con «Corregir»</span>}
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
              <td>{f[ter] || <em className="muted">{f.archivo}</em>}{f.analizado_ia && !f._editada && <span className="etq" title="Datos propuestos por IA, sin revisar">IA</span>}{f._papelesCambiados && !f._editada && <span className="etq aviso" title="La IA puso a tu empresa como emisora: se han cambiado los papeles. Revísala.">emisor corregido</span>}{f._proveedorPropio && <span className="etq aviso" title="Sale tu propia empresa como proveedor: corrígela">¿tu empresa como proveedor?</span>}{f._sinTexto && <span className="etq aviso" title="Ni con OCR se ha podido leer: rellénala a mano">ilegible · rellenar</span>}{f.noFactura && <span className="etq" title={f.notaNoFactura || "No es una factura (carta de pago, presupuesto…): no entra en los libros"}>no es factura</span>}{f._duplicadoDe && <span className="etq aviso" title={`Es la misma factura que «${f._duplicadoDe}». No entra en los libros; puedes borrar esta copia.`}>duplicada</span>}</td>
              <td>{f.numero}</td><td className="num">{eur(f.base)}</td><td className="num">{eur(f.iva_importe)}</td><td className="num">{f.retencion_importe ? eur(f.retencion_importe) : ""}</td>
              <td className="num"><strong>{eur(f.total)}</strong></td><td title={TITULOS_PGC[f.cuenta_pgc]}>{f.cuenta_pgc}</td>
              <td>{!f.total ? "" : !noPagada(f, d) ? <><span className="ok" title={(f._pago || f._cobro)?.texto}>{emitidas ? "Cobrada" : "Pagada"}{(f._pago || f._cobro)?.fecha ? " " + (f._pago || f._cobro).fecha : ""}</span>{f._pago?.dif ? <span className="pend pequeño" title="El banco dice otra cantidad que la factura"> · banco {eur(f._pago.importe)} ({f._pago.dif > 0 ? "+" : ""}{eur(f._pago.dif)})</span> : null}</> : <button type="button" className="pend enlace" title="Elegir el pago en el extracto del banco" onClick={() => setElegir(f)}>Pendiente · elegir pago</button>}</td>
              <td className="acciones">
                <button className="enlace" type="button" onClick={() => abrir(f._arch)}>Ver</button>
                <button className="enlace" type="button" onClick={() => setEdit({ ...f })}>Corregir</button>
              </td>
            </tr>))}</tbody>
        </table>
      </div>
      {elegir && <ElegirPago f={elegir} d={d} emitidas={emitidas} onCerrar={() => setElegir(null)} onElegir={async (m) => {
        await guardarVinculo(raiz, elegir.archivo, m ? { descripcion: m.concepto, fecha: m.fecha, importe: m.importe, clave_banco: claveMovDatos(m), archivo_banco: "" } : null);
        setElegir(null); aviso(m ? "Pago casado con el movimiento del banco" : "Quitado el pago elegido"); recargar();
      }} />}
      {edit && (
        <div className="mc-fondo" role="dialog" aria-modal="true">
          <div className="mc-dialogo ancho con-doc">
            <header><h2>Corregir factura {emitidas ? "emitida" : "recibida"}</h2><button className="mc-x" onClick={() => setEdit(null)} aria-label="Cerrar">×</button></header>
            <div className="mc-cuerpo doc-y-datos">
              <VistaDoc arch={edit._arch} />
              <div>
                <p className="muted pequeño">{edit.archivo} · <button className="enlace" type="button" onClick={() => abrir(edit._arch)}>abrir en otra pestaña</button></p>
                {(edit._papelesCambiados || edit._proveedorPropio) && <p className="mc-nota">La IA había puesto a tu empresa como {emitidas ? "cliente" : "proveedora"}. {edit._papelesCambiados ? "Se han cambiado los papeles automáticamente: compruébalo con el documento y guarda." : "Escribe aquí quién emite realmente la factura."}</p>}
                <details className="pegar-texto" open={!edit._leida}>
                  <summary>Pegar el texto de la factura y que la app lo reparta</summary>
                  <p className="muted pequeño">Abre la factura, selecciona todo (Ctrl+A), copia (Ctrl+C) y pégalo aquí (Ctrl+V). La app rellena los campos de abajo; revisa y pulsa Guardar.</p>
                  <textarea rows={5} value={edit._pegado || ""} placeholder="Pega aquí el texto de la factura…" onChange={(e) => setEdit({ ...edit, _pegado: e.target.value })} />
                  <button className="btn ghost" type="button" disabled={!edit._pegado?.trim() || edit._repartiendo} onClick={async () => {
                    setEdit((x) => ({ ...x, _repartiendo: true }));
                    try {
                      const { leerTextoFactura } = await import("./leer.js");
                      const r = await leerTextoFactura(edit._pegado, { propia, emitida: emitidas });
                      const d = r.datos || {};
                      // Solo se rellena lo que se ha encontrado; lo que ya tenías escrito y no aparece en el texto se queda
                      const nuevos = Object.fromEntries(campos.map(([k]) => [k, d[k]]).filter(([k, v]) => v !== undefined && v !== null && v !== "" && !(typeof v === "number" && v === 0 && !/pct|retencion/.test(k))));
                      setEdit((x) => ({ ...x, ...nuevos, ...(d.isp !== undefined && !emitidas ? { isp: d.isp } : {}), _repartiendo: false, _repartido: r.motivo }));
                    } catch (e) { setEdit((x) => ({ ...x, _repartiendo: false, _repartido: "No se pudo leer: " + (e.message || e) })); }
                  }}>{edit._repartiendo ? "Leyendo…" : "Repartir en los campos"}</button>
                  {edit._repartido && <span className="muted pequeño"> {edit._repartido}. Revisa los campos.</span>}
                </details>
                <div className="rejilla-edit">
                  {campos.map(([k, t]) => <label key={k} className="mc-campo"><span>{t}</span><input value={edit[k] ?? ""} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} /></label>)}
                </div>
                {!emitidas && <div className="fila-checks">
                  <label><input type="checkbox" checked={!!edit.isp && edit.isp !== "false"} onChange={(e) => setEdit({ ...edit, isp: e.target.checked })} /> Proveedor extranjero sin IVA español (inversión del sujeto pasivo: 472/477 al 21 %)</label>
                  <label><input type="checkbox" checked={!!edit.noFactura && edit.noFactura !== "false"} onChange={(e) => setEdit({ ...edit, noFactura: e.target.checked })} /> No es una factura (carta de pago, presupuesto, copia…): que no entre en los libros</label>
                </div>}
                {!emitidas && <label className="mc-campo"><span>Pago (si se pagó por otra vía: quién lo pagó, p. ej. «Pagado por Solve con la provisión»)</span>
                  <input value={edit._pagoTxt ?? (edit._pago?.manual ? edit._pago.texto : "")} placeholder="p. ej. Pagado por Solve con la provisión" onChange={(e) => setEdit({ ...edit, _pagoTxt: e.target.value })} />
                </label>}
                {!emitidas && propia?.nombre && <button className="enlace pequeño" type="button" onClick={async () => { await guardarEdicion(raiz, edit.archivo, Object.fromEntries(CAMPOS.map(([k]) => [k, String(edit[k] ?? "")])), false); /* mover a emitidas */ const h = await edit._arch.h.getFile(); await subir(raiz, "facturas_emitidas", [new File([h], edit.archivo, { type: h.type })]); try { const dir = await raiz.getDirectoryHandle("facturas"); await dir.removeEntry(edit.archivo); } catch { /* si no se puede borrar, queda duplicada */ } setEdit(null); aviso("Movida a facturas emitidas"); recargar(); }}>Esta factura la emití yo: moverla a «facturas emitidas»</button>}
              </div>
            </div>
            <footer>
              <button className="mc-btn sec" onClick={() => setEdit(null)}>Cancelar</button>
              <button className="mc-btn" onClick={async () => {
                const cambios = {}; campos.forEach(([k]) => (cambios[k] = String(edit[k] ?? "")));
                if (!emitidas) { cambios.isp = !!edit.isp && edit.isp !== "false"; cambios.noFactura = !!edit.noFactura && edit.noFactura !== "false"; }
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


// Elegir en el extracto el movimiento que paga (o cobra) una factura: primero los del mismo importe, luego los cercanos en fecha
// Ventana para renovar el permiso del banco (PSD2: cada 90 días). Abre la web del banco, espera la vuelta y sincroniza.
function RenovarBanco({ raiz, motivo, pronto, onCerrar, onHecho }) {
  const [paso, setPaso] = useState("");
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");
  useEffect(() => { import("./banco.js").then((b) => setUrl(b.urlVuelta())); }, []);
  const empezar = async () => {
    setError("");
    const v = window.open("about:blank", "banco", "width=520,height=760"); // en el mismo clic, para que no la bloquee el navegador
    try {
      const b = await import("./banco.js");
      const { hasta } = await b.renovarPermiso(raiz, v, setPaso);
      setPaso("Trayendo los movimientos…");
      const x = await b.sincronizarBanco(raiz);
      onHecho(`Banco renovado hasta el ${new Date(hasta).toLocaleDateString("es-ES")} · ${x.nuevos} movimientos recibidos`);
    } catch (e) { setPaso(""); setError(String(e.message || e)); }
  };
  return (
    <div className="mc-fondo" role="dialog" aria-modal="true" aria-labelledby="rb-t">
      <div className="mc-dialogo">
        <header><h2 id="rb-t">{pronto ? "Renueva el permiso del banco" : "Hay que renovar el banco"}</h2><button className="mc-x" onClick={onCerrar} aria-label="Cerrar">×</button></header>
        <div className="mc-cuerpo">
          <p>{motivo}</p>
          <p className="muted pequeño">Se abre la web de Cajamar en una ventana: entra con tus claves, elige la cuenta de la empresa y acepta. Tus claves solo las ve el banco; Mi Despacho recibe un permiso de lectura de movimientos para 90 días, que se guarda en tu carpeta «programa».</p>
          {paso && <p role="status"><span className="girando" aria-hidden="true" /> {paso}</p>}
          {error && <p className="error" role="alert">{error}</p>}
          <details className="pequeño"><summary>Si el banco dice que la dirección de vuelta no es válida</summary>
            <p>Solo hay que hacerlo una vez: entra en el panel de Enable Banking (enablebanking.com › Control panel › tu aplicación) y añade en «Redirect URLs» esta dirección:</p>
            <p><code>{url}</code> <button className="enlace" type="button" onClick={() => navigator.clipboard?.writeText(url)}>copiar</button></p></details>
          <div className="acciones">
            <button className="btn" type="button" disabled={!!paso} onClick={empezar}>{paso ? "Renovando…" : "Renovar banco"}</button>
            <button className="btn ghost" type="button" onClick={onCerrar}>{pronto ? "Más tarde" : "Cancelar"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ElegirPago({ f, d, emitidas, onCerrar, onElegir }) {
  const [buscar, setBuscar] = useState("");
  const [todos, setTodos] = useState(false);
  const signo = emitidas ? 1 : -1, f0 = Date.parse(fechaOrden(f.fecha)) || Date.now();
  const lista = (d.movimientos || []).filter((m) => Math.sign(m.importe) === signo && (!m._factura || m._factura === f.archivo) && !m._emitida)
    .map((m) => ({ m, igual: Math.abs(Math.abs(m.importe) - (f.total || 0)) < 0.011, dias: Math.abs(((Date.parse(fechaOrden(m.fecha)) || 0) - f0) / 86400000) }))
    .filter((x) => todos || x.igual || x.dias <= 120)
    .filter((x) => !buscar || (x.m.concepto + " " + x.m.importe).toLowerCase().includes(buscar.toLowerCase()))
    .sort((a, b) => (b.igual - a.igual) || (a.dias - b.dias)).slice(0, 80);
  return (
    <div className="mc-fondo" role="dialog" aria-modal="true" aria-labelledby="ep-t">
      <div className="mc-dialogo ancho">
        <header><h2 id="ep-t">¿Con qué movimiento del banco se {emitidas ? "cobró" : "pagó"}?</h2><button className="mc-x" onClick={onCerrar} aria-label="Cerrar">×</button></header>
        <div className="mc-cuerpo">
          <p className="mc-nota"><strong>{f[emitidas ? "cliente" : "proveedor"] || f.archivo}</strong> {f.numero} · {f.fecha} · {eur(f.total)}</p>
          <div className="acciones"><input placeholder="Buscar en el concepto o el importe…" value={buscar} onChange={(e) => setBuscar(e.target.value)} /> <label className="pequeño"><input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} /> ver todo el extracto</label></div>
          {!lista.length ? <p className="muted">No hay movimientos que encajen. Marca «ver todo el extracto» o sincroniza el banco.</p> : (
            <table className="tabla pequeña"><thead><tr><th>Fecha</th><th>Concepto</th><th className="num">Importe</th><th /></tr></thead>
              <tbody>{lista.map(({ m, igual }) => <tr key={m._id} className={igual ? "sel" : ""}><td>{m.fecha}</td><td>{m.concepto}</td><td className="num">{eur(m.importe)}</td><td><button className="btn" type="button" onClick={() => onElegir(m)}>{igual ? "Es este" : "Elegir"}</button></td></tr>)}</tbody></table>)}
        </div>
        <footer>{f._pago?.elegido && <button className="mc-btn sec" onClick={() => onElegir(null)}>Quitar el pago elegido</button>}<button className="mc-btn sec" onClick={onCerrar}>Cerrar</button></footer>
      </div>
    </div>
  );
}
