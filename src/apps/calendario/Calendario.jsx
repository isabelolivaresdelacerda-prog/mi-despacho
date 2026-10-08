// Calendario de obligaciones: impuestos, libros, junta, cuentas anuales… con avisos y exportación a Outlook.
import { useMemo, useState } from "react";
import { obligaciones, ics } from "./obligaciones.js";
import "./calendario.css";

const HECHOS = "md-cal-hechos", PROPIOS = "md-cal-propios";
const leer = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } };
const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* nada */ } };
const hoyISO = () => new Date().toISOString().slice(0, 10);
const fmt = (f) => new Date(f + "T12:00:00Z").toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "long" });
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const TIPOS = { impuesto: "Impuestos", mercantil: "Mercantil", laboral: "Laboral", propio: "Míos" };
const OPCIONES = [
  ["profesionales", "Pago facturas con retención (abogados, asesores…)"],
  ["empleados", "Tengo trabajadores"],
  ["alquileres", "Pago alquiler de un local"],
  ["pagosFraccionados", "Hago pagos fraccionados del Impuesto sobre Sociedades"],
  ["intracomunitarias", "Compro o vendo a empresas de otros países de la UE"],
  ["cambiosSocios", "Este ejercicio han entrado socios o ha cambiado el capital"],
];

export function useEventos(config, anio) {
  const op = config.calendario || { profesionales: true };
  return useMemo(() => {
    const propios = leer(PROPIOS, []).filter((e) => e.fecha.startsWith(String(anio)));
    return [...obligaciones(anio, op), ...propios].sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [config, anio]);
}

const largo = (f) => new Date(f + "T12:00:00Z").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const diasHasta = (f) => Math.round((Date.parse(f + "T12:00:00Z") - Date.parse(hoyISO() + "T12:00:00Z")) / 86400000);
const faltan = (n) => (n === 0 ? "hoy" : n === 1 ? "mañana" : n < 0 ? `hace ${-n} días` : `en ${n} días`);
// Ir a registrar un impuesto presentado en Contabilidad › Impuestos
const irAImpuestos = () => { try { localStorage.setItem("md-conta-ir", "impuestos"); } catch { /* nada */ } location.hash = "#/contabilidad"; };

function Hoy({ siguiente }) {
  const hoy = hoyISO();
  return (
    <div className="cal-hoy">
      <div className="cal-hoy-dia"><span>{new Date().toLocaleDateString("es-ES", { weekday: "long" })}</span><strong>{new Date().getDate()}</strong><span>{MESES[new Date().getMonth()].toLowerCase()} {new Date().getFullYear()}</span></div>
      <div>
        <p className="cal-hoy-txt">Hoy es {largo(hoy)}.</p>
        {siguiente ? <p className="cal-sig"><strong className="cal-cuenta">{diasHasta(siguiente.fecha) === 0 ? "¡Hoy!" : `${diasHasta(siguiente.fecha)} días`}</strong> para el siguiente aviso: <strong>{siguiente.titulo}</strong> ({fmt(siguiente.fecha)})</p> : <p className="cal-sig">No hay avisos pendientes.</p>}
      </div>
    </div>
  );
}

// Avisos para la pantalla de inicio
export function ProximosAvisos({ config, ir }) {
  const anio = new Date().getFullYear();
  const ev = [...useEventos(config, anio), ...useEventos(config, anio + 1)];
  const hechos = leer(HECHOS, {});
  const hoy = hoyISO(), lim = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const pendientes = ev.filter((e) => !hechos[e.id] && e.fecha >= hoy);
  const prox = pendientes.filter((e) => e.fecha <= lim);
  const vencidos = ev.filter((e) => !hechos[e.id] && e.fecha < hoy && e.fecha >= `${anio}-01-01`);
  return (
    <section className="tarjeta avisos-inicio">
      <Hoy siguiente={pendientes[0]} />
      {(prox.length > 0 || vencidos.length > 0) && <ul>
        {vencidos.slice(-3).map((e) => <li key={e.id} className="vencido"><strong>{fmt(e.fecha)}</strong> · {e.titulo} <span className="etq-v">vencido</span>{e.tipo === "impuesto" && <> <button className="enlace" type="button" onClick={irAImpuestos}>¿ya presentado? regístralo</button></>}</li>)}
        {prox.map((e) => <li key={e.id}><strong>{fmt(e.fecha)}</strong> · {e.titulo} <span className="muted">({faltan(diasHasta(e.fecha))})</span></li>)}
      </ul>}
      <button className="enlace" type="button" onClick={() => ir("calendario")}>Ver el calendario</button>
    </section>
  );
}

export default function Calendario({ config, guardar }) {
  const h = new Date();
  const [mes, setMes] = useState({ anio: h.getFullYear(), m: h.getMonth() });
  const [hechos, setHechos] = useState(() => leer(HECHOS, {}));
  const [filtro, setFiltro] = useState("todos");
  const [dia, setDia] = useState(null);
  const [nuevo, setNuevo] = useState({ fecha: "", titulo: "" });
  const [, refrescar] = useState(0);
  const op = config.calendario || { profesionales: true };
  const anio = mes.anio;
  const evA = useEventos(config, anio), evS = useEventos(config, anio + 1), evP = useEventos(config, anio - 1);
  const ev = useMemo(() => [...evP, ...evA, ...evS].filter((e, i, arr) => arr.findIndex((x) => x.id === e.id && x.fecha === e.fecha) === i), [evP, evA, evS]);
  const hoy = hoyISO();
  const empresa = config.empresa?.razon_social || config.nombre || "";

  const marcar = (id) => { const x = { ...hechos, [id]: !hechos[id] }; if (!x[id]) delete x[id]; setHechos(x); escribir(HECHOS, x); };
  const cambiarOp = (k, v) => guardar({ ...config, calendario: { ...op, [k]: v } });
  const exportar = () => {
    const url = URL.createObjectURL(new Blob([ics(ev.filter((e) => !hechos[e.id] && e.fecha >= hoy), empresa)], { type: "text/calendar" }));
    const a = document.createElement("a"); a.href = url; a.download = `Calendario ${empresa || "empresa"}.ics`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 4000);
  };
  const visibles = ev.filter((e) => filtro === "todos" || e.tipo === filtro);
  const pendientes = visibles.filter((e) => !hechos[e.id] && e.fecha >= hoy);
  const vencidos = visibles.filter((e) => !hechos[e.id] && e.fecha < hoy && e.fecha >= `${h.getFullYear() - 1}-07-01`);
  const delMes = (iso) => visibles.filter((e) => e.fecha === iso);
  const mover = (n) => { const d = new Date(mes.anio, mes.m + n, 1); setMes({ anio: d.getFullYear(), m: d.getMonth() }); setDia(null); };

  // Cuadrícula del mes (lunes a domingo)
  const primero = new Date(mes.anio, mes.m, 1);
  const hueco = (primero.getDay() + 6) % 7;
  const nDias = new Date(mes.anio, mes.m + 1, 0).getDate();
  const celdas = [...Array(hueco).fill(null), ...Array.from({ length: nDias }, (_, i) => `${mes.anio}-${String(mes.m + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`)];
  while (celdas.length % 7) celdas.push(null);
  const lista = dia ? visibles.filter((e) => e.fecha === dia) : null;
  const estadoDe = (e) => (hechos[e.id] ? "hecho" : e.fecha < hoy ? "vencido" : diasHasta(e.fecha) <= 15 ? "pronto" : "");

  const Ev = ({ e }) => {
    const st = estadoDe(e);
    return (
      <li className={"cal-ev " + st + " t-" + e.tipo}>
        <input type="checkbox" checked={!!hechos[e.id]} onChange={() => marcar(e.id)} aria-label="Hecho" title="Marcar como hecho" />
        <div>
          <div className="cal-fecha">{fmt(e.fecha)} <small>{hechos[e.id] ? "hecho" : faltan(diasHasta(e.fecha))}</small></div>
          <strong>{e.titulo}</strong>{e.detalle && <div className="muted pequeño">{e.detalle}</div>}
          {e.tipo === "impuesto" && !hechos[e.id] && <button className="enlace pequeño" type="button" onClick={irAImpuestos}>Registrar como presentado ›</button>}
          {e.tipo === "propio" && <button className="enlace pequeño" type="button" onClick={() => { escribir(PROPIOS, leer(PROPIOS, []).filter((x) => x.id !== e.id)); refrescar((n) => n + 1); }}>Quitar</button>}
        </div>
      </li>);
  };

  return (
    <div className="app">
      <header className="app-cab">
        <div>
          <div className="eyebrow">Calendario</div>
          <h1>Obligaciones de la empresa</h1>
          <p className="muted">Impuestos, libros, junta y cuentas anuales. Plazos generales: confírmalos con tu gestoría.</p>
        </div>
        <div className="acciones"><button className="btn" type="button" onClick={exportar}>Añadir a Outlook</button></div>
      </header>

      <section className="tarjeta"><Hoy siguiente={ev.filter((e) => !hechos[e.id] && e.fecha >= hoy)[0]} /></section>

      <nav className="cont-tabs">
        {[["todos", "Todo"], ...Object.entries(TIPOS)].map(([k, t]) => <button key={k} className={filtro === k ? "on" : ""} onClick={() => setFiltro(k)}>{t}</button>)}
      </nav>

      <div className="cal-layout">
        <section className="cal-cuadro tarjeta">
          <div className="cal-nav">
            <button className="btn ghost" type="button" onClick={() => mover(-1)} aria-label="Mes anterior">‹</button>
            <h2>{MESES[mes.m]} {mes.anio}</h2>
            <button className="btn ghost" type="button" onClick={() => mover(1)} aria-label="Mes siguiente">›</button>
            <button className="enlace" type="button" onClick={() => { setMes({ anio: h.getFullYear(), m: h.getMonth() }); setDia(null); }}>Hoy</button>
          </div>
          <div className="cal-grid">
            {["L", "M", "X", "J", "V", "S", "D"].map((d) => <div key={d} className="cal-dsem">{d}</div>)}
            {celdas.map((iso, i) => {
              if (!iso) return <div key={i} className="cal-celda vacia" />;
              const es = delMes(iso);
              return (
                <button key={iso} type="button" className={"cal-celda" + (iso === hoy ? " hoy" : "") + (iso === dia ? " sel" : "") + (es.length ? " con" : "")} onClick={() => setDia(dia === iso ? null : iso)}>
                  <span className="cal-num">{+iso.slice(8)}</span>
                  {es.slice(0, 3).map((e) => <span key={e.id} className={"cal-chip t-" + e.tipo + " " + estadoDe(e)} title={e.titulo}>{e.titulo}</span>)}
                  {es.length > 3 && <span className="cal-mas">+{es.length - 3}</span>}
                </button>);
            })}
          </div>
          <p className="cal-leyenda pequeño">{Object.entries(TIPOS).map(([k, t]) => <span key={k}><i className={"punto t-" + k} /> {t}</span>)}</p>
        </section>

        <aside className="cal-avisos">
          {lista ? (<>
            <h3>{largo(dia)} <button className="enlace pequeño" type="button" onClick={() => setDia(null)}>ver todos</button></h3>
            {lista.length ? <ul>{lista.map((e) => <Ev key={e.id + e.fecha} e={e} />)}</ul> : <p className="muted">Nada este día.</p>}
          </>) : (<>
            {vencidos.length > 0 && <><h3 className="error">Vencidos sin marcar ({vencidos.length})</h3><ul>{vencidos.map((e) => <Ev key={e.id + e.fecha} e={e} />)}</ul></>}
            <h3>Próximos avisos</h3>
            <ul>{pendientes.slice(0, 12).map((e) => <Ev key={e.id + e.fecha} e={e} />)}</ul>
          </>)}
        </aside>
      </div>

      <details className="tarjeta cal-opciones">
        <summary>Ajustar a mi empresa</summary>
        {OPCIONES.map(([k, t]) => <label key={k} className="opcion"><input type="checkbox" checked={!!op[k]} onChange={(e) => cambiarOp(k, e.target.checked)} /> {t}</label>)}
        <label>Fecha prevista de la Junta General Ordinaria<input type="date" value={op.fechaJunta || ""} onChange={(e) => cambiarOp("fechaJunta", e.target.value)} /></label>
      </details>

      <section className="tarjeta">
        <h2>Añadir un aviso propio</h2>
        <p className="muted pequeño">Por ejemplo: vencimiento de unas arras, renovación de un seguro o el IBI de tu ayuntamiento.</p>
        <div className="fila">
          <label>Fecha<input type="date" value={nuevo.fecha || dia || ""} onChange={(e) => setNuevo({ ...nuevo, fecha: e.target.value })} /></label>
          <label>Qué<input value={nuevo.titulo} onChange={(e) => setNuevo({ ...nuevo, titulo: e.target.value })} /></label>
        </div>
        <button className="btn" type="button" disabled={!(nuevo.fecha || dia) || !nuevo.titulo.trim()} onClick={() => {
          escribir(PROPIOS, [...leer(PROPIOS, []), { id: "p-" + Date.now(), fecha: nuevo.fecha || dia, titulo: nuevo.titulo.trim(), tipo: "propio", detalle: "" }]);
          setNuevo({ fecha: "", titulo: "" }); refrescar((n) => n + 1);
        }}>Añadir</button>
      </section>
    </div>
  );
}
