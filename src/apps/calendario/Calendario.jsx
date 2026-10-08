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

// Avisos para la pantalla de inicio
export function ProximosAvisos({ config, ir }) {
  const anio = new Date().getFullYear();
  const ev = [...useEventos(config, anio), ...useEventos(config, anio + 1)];
  const hechos = leer(HECHOS, {});
  const hoy = hoyISO(), lim = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const prox = ev.filter((e) => !hechos[e.id] && e.fecha >= hoy && e.fecha <= lim);
  const vencidos = ev.filter((e) => !hechos[e.id] && e.fecha < hoy && e.fecha >= `${anio}-01-01`);
  if (!prox.length && !vencidos.length) return null;
  return (
    <section className="tarjeta avisos-inicio">
      <h2>📅 Próximos 30 días</h2>
      <ul>
        {vencidos.slice(-3).map((e) => <li key={e.id} className="vencido"><strong>{fmt(e.fecha)}</strong> · {e.titulo} <span className="etq-v">vencido</span></li>)}
        {prox.map((e) => <li key={e.id}><strong>{fmt(e.fecha)}</strong> · {e.titulo}</li>)}
      </ul>
      <button className="enlace" type="button" onClick={() => ir("calendario")}>Ver el calendario</button>
    </section>
  );
}

export default function Calendario({ config, guardar }) {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [hechos, setHechos] = useState(() => leer(HECHOS, {}));
  const [filtro, setFiltro] = useState("todos");
  const [nuevo, setNuevo] = useState({ fecha: "", titulo: "" });
  const [, refrescar] = useState(0);
  const op = config.calendario || { profesionales: true };
  const ev = useEventos(config, anio);
  const hoy = hoyISO();
  const empresa = config.empresa?.razon_social || config.nombre || "";

  const marcar = (id) => { const h = { ...hechos, [id]: !hechos[id] }; if (!h[id]) delete h[id]; setHechos(h); escribir(HECHOS, h); };
  const cambiarOp = (k, v) => guardar({ ...config, calendario: { ...op, [k]: v } });
  const exportar = () => {
    const url = URL.createObjectURL(new Blob([ics(ev.filter((e) => !hechos[e.id] && e.fecha >= hoy), empresa)], { type: "text/calendar" }));
    const a = document.createElement("a"); a.href = url; a.download = `Calendario ${empresa || "empresa"} ${anio}.ics`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 4000);
  };
  const lista = ev.filter((e) => filtro === "todos" || e.tipo === filtro);
  const porMes = MESES.map((m, i) => ({ m, ev: lista.filter((e) => +e.fecha.slice(5, 7) === i + 1) })).filter((x) => x.ev.length);

  return (
    <div className="app">
      <header className="app-cab">
        <div>
          <div className="eyebrow">Calendario</div>
          <h1>Obligaciones de la empresa</h1>
          <p className="muted">Impuestos, libros, junta y cuentas anuales de una S.L. con ejercicio de enero a diciembre. Confírmalo con tu gestoría.</p>
        </div>
        <div className="acciones">
          <button className="btn ghost" type="button" onClick={() => setAnio(anio - 1)}>‹ {anio - 1}</button>
          <strong className="anio">{anio}</strong>
          <button className="btn ghost" type="button" onClick={() => setAnio(anio + 1)}>{anio + 1} ›</button>
          <button className="btn" type="button" onClick={exportar}>Añadir a Outlook</button>
        </div>
      </header>

      <details className="tarjeta cal-opciones">
        <summary>Ajustar a mi empresa</summary>
        {OPCIONES.map(([k, t]) => <label key={k} className="opcion"><input type="checkbox" checked={!!op[k]} onChange={(e) => cambiarOp(k, e.target.checked)} /> {t}</label>)}
        <label>Fecha prevista de la Junta General Ordinaria<input type="date" value={op.fechaJunta || ""} onChange={(e) => cambiarOp("fechaJunta", e.target.value)} /></label>
      </details>

      <nav className="cont-tabs">
        {[["todos", "Todo"], ...Object.entries(TIPOS)].map(([k, t]) => <button key={k} className={filtro === k ? "on" : ""} onClick={() => setFiltro(k)}>{t}</button>)}
      </nav>

      {porMes.map(({ m, ev }) => (
        <section key={m} className="cal-mes">
          <h2>{m}</h2>
          <ul>{ev.map((e) => {
            const estado = hechos[e.id] ? "hecho" : e.fecha < hoy ? "vencido" : e.fecha <= new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10) ? "pronto" : "";
            return (
              <li key={e.id} className={"cal-ev " + estado + " t-" + e.tipo}>
                <input type="checkbox" checked={!!hechos[e.id]} onChange={() => marcar(e.id)} aria-label="Hecho" />
                <div className="cal-fecha">{fmt(e.fecha)}{e.desde && <small>desde el {new Date(e.desde + "T12:00:00Z").toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</small>}</div>
                <div><strong>{e.titulo}</strong>{e.detalle && <div className="muted pequeño">{e.detalle}</div>}</div>
                <span className="cal-tipo">{TIPOS[e.tipo]}{estado === "vencido" && " · vencido"}{estado === "pronto" && " · pronto"}</span>
                {e.tipo === "propio" && <button className="enlace" type="button" onClick={() => { escribir(PROPIOS, leer(PROPIOS, []).filter((x) => x.id !== e.id)); refrescar((n) => n + 1); }}>Quitar</button>}
              </li>);
          })}</ul>
        </section>
      ))}

      <section className="tarjeta">
        <h2>Añadir un aviso propio</h2>
        <p className="muted pequeño">Por ejemplo: vencimiento de unas arras, renovación de un seguro o el IBI de tu ayuntamiento.</p>
        <div className="fila">
          <label>Fecha<input type="date" value={nuevo.fecha} onChange={(e) => setNuevo({ ...nuevo, fecha: e.target.value })} /></label>
          <label>Qué<input value={nuevo.titulo} onChange={(e) => setNuevo({ ...nuevo, titulo: e.target.value })} /></label>
        </div>
        <button className="btn" type="button" disabled={!nuevo.fecha || !nuevo.titulo.trim()} onClick={() => {
          escribir(PROPIOS, [...leer(PROPIOS, []), { id: "p-" + Date.now(), fecha: nuevo.fecha, titulo: nuevo.titulo.trim(), tipo: "propio", detalle: "" }]);
          setNuevo({ fecha: "", titulo: "" }); refrescar((n) => n + 1);
        }}>Añadir</button>
      </section>
    </div>
  );
}
