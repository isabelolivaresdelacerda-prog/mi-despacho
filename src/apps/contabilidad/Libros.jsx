// Contabilidad completa dentro de Mi Despacho: diario, mayores, sumas y saldos, pérdidas y ganancias, balance,
// banco por aplicar (con asistente para elegir la cuenta), asientos manuales y exportación a A3 / Sage.
import { Fragment, useEffect, useMemo, useState } from "react";
import { filtrarPeriodo, mayores, perdidasYGanancias, balance, exportarApuntes, exportarPlanCuentas, claveMov, adivinarTercero, claveTercero } from "./motor.js";
export { adivinarTercero };
import { planPorDefecto } from "../../lib/entidad.js";
import { eur, num, descargarTexto, fechaOrden } from "./datos.js";
import { plan, comprobarBOE, descargarDelBOE, aplicarActualizacion, fechaBOE, a8 } from "./pgc.js";
import Asistente from "./Asistente.jsx";
import { preguntarIA } from "../../ia-navegador.js";

const SUB = [["diario", "Libro diario"], ["mayor", "Mayores"], ["sumas", "Sumas y saldos"], ["pyg", "Pérdidas y ganancias"], ["balance", "Balance"], ["aplicar", "Banco por aplicar"], ["manual", "Asiento manual"], ["exportar", "A3 / Sage"], ["plan", "Plan contable"]];
const e2 = (n) => (n ? eur(n) : "");

export default function Libros({ datos, diario, extra, guardarExtra, r, sub, setSub, config, guardarConfig, aviso }) {
  const tipoPlan = planPorDefecto(config);
  const { asientos: todos, pendientes } = diario;
  const asientos = useMemo(() => filtrarPeriodo(todos, r.desde, r.hasta), [todos, r]);
  // El balance es una foto a una fecha: desde el 1 de enero del ejercicio hasta el final del periodo
  const ejercicio = useMemo(() => filtrarPeriodo(todos, `${r.anio}-01-01`, r.hasta), [todos, r]);
  const pendP = pendientes.filter((m) => { const f = fechaOrden(m.fecha); return f >= r.desde && f <= r.hasta; });
  const descuadrados = asientos.filter((a) => !a.cuadra).length;
  const fin = `${r.hasta.slice(8, 10)}/${r.hasta.slice(5, 7)}/${r.hasta.slice(0, 4)}`;

  return (
    <div>
      <div className="acciones cont-barra">
        <nav className="sub-tabs">{SUB.map(([k, t]) => <button key={k} className={sub === k ? "on" : ""} onClick={() => setSub(k)}>{t}{k === "aplicar" && pendP.length > 0 && <span className="insignia">{pendP.length}</span>}</button>)}</nav>
      </div>
      <p className="muted pequeño">{r.etiqueta}. La contabilidad se genera sola con las facturas, el banco y las escrituras y contratos vinculados. Lo propuesto por la IA debe revisarlo una persona.{descuadrados > 0 && <span className="pend"> Hay {descuadrados} asientos descuadrados: revisa esas facturas.</span>}</p>
      {sub === "diario" && <Diario asientos={asientos} />}
      {sub === "mayor" && <Mayor asientos={asientos} />}
      {sub === "sumas" && <Sumas asientos={asientos} />}
      {sub === "pyg" && <PyG esfl={tipoPlan === "esfl"} asientos={asientos} anio={r.etiqueta} acumulado={r.tramo !== "anio" ? ejercicio : null} />}
      {sub === "balance" && <Balance esfl={tipoPlan === "esfl"} asientos={ejercicio} anio={fin} />}
      {sub === "aplicar" && <Aplicar pendientes={pendP} total={pendientes.length} asig={extra.asig} plan={tipoPlan} guardar={async (n) => { await guardarExtra("asig", n); aviso?.("Movimiento contabilizado"); }} />}
      {sub === "manual" && <Manual manuales={extra.manuales} plan={tipoPlan} guardar={async (n) => { await guardarExtra("manuales", n); aviso?.("Asiento guardado"); }} />}
      {sub === "exportar" && <Exportar asientos={asientos} anio={r.corta} />}
      {sub === "plan" && <PlanContable tipo={tipoPlan} cambiar={(p) => guardarConfig({ ...config, planContable: p })} aviso={aviso} />}
    </div>
  );
}

function Diario({ asientos }) {
  if (!asientos.length) return <p className="muted">No hay asientos en este periodo.</p>;
  return (
    <div className="tabla-scroll"><table className="tabla libro">
      <thead><tr><th>Nº</th><th>Fecha</th><th>Cuenta</th><th>Concepto</th><th className="num">Debe</th><th className="num">Haber</th></tr></thead>
      <tbody>{asientos.map((a) => a.lineas.map((l, i) => (
        <tr key={a.num + "-" + i} className={(i === 0 ? "primera " : "") + (!a.cuadra ? "descuadre" : "")}>
          <td>{i === 0 ? a.num : ""}</td><td>{i === 0 ? a.fecha : ""}</td>
          <td><span className="cta">{a8(l.cuenta)}</span> <span className="muted pequeño">{l.titulo}</span></td>
          <td>{i === 0 ? a.concepto : ""}</td><td className="num">{e2(l.debe)}</td><td className="num">{e2(l.haber)}</td>
        </tr>)))}</tbody>
    </table></div>
  );
}

function Mayor({ asientos }) {
  const m = useMemo(() => mayores(asientos), [asientos]);
  const [sel, setSel] = useState(null);
  const c = m.find((x) => x.cuenta === sel) || m[0];
  if (!c) return <p className="muted">No hay movimientos.</p>;
  return (
    <div className="mayor">
      <aside>{m.map((x) => <button key={x.cuenta} type="button" className={x.cuenta === c.cuenta ? "on" : ""} onClick={() => setSel(x.cuenta)}><span className="cta">{a8(x.cuenta)}</span><small>{x.titulo}</small></button>)}</aside>
      <section>
        <h3><span className="cta">{a8(c.cuenta)}</span> {c.titulo}</h3>
        <div className="tabla-scroll"><table className="tabla">
          <thead><tr><th>Fecha</th><th>Asiento</th><th>Concepto</th><th className="num">Debe</th><th className="num">Haber</th><th className="num">Saldo</th></tr></thead>
          <tbody>{c.apuntes.map((a, i) => <tr key={i}><td>{a.fecha}</td><td>{a.num}</td><td>{a.concepto}</td><td className="num">{e2(a.debe)}</td><td className="num">{e2(a.haber)}</td><td className="num"><strong>{eur(a.saldo)}</strong></td></tr>)}</tbody>
          <tfoot><tr><td colSpan="3"><strong>Total</strong></td><td className="num"><strong>{eur(c.debe)}</strong></td><td className="num"><strong>{eur(c.haber)}</strong></td><td className="num"><strong>{eur(c.debe - c.haber)}</strong></td></tr></tfoot>
        </table></div>
      </section>
    </div>
  );
}

function Sumas({ asientos }) {
  const m = mayores(asientos);
  const T = m.reduce((t, c) => ({ d: t.d + c.debe, h: t.h + c.haber }), { d: 0, h: 0 });
  return (
    <div className="tabla-scroll"><table className="tabla">
      <thead><tr><th>Cuenta</th><th>Título</th><th className="num">Sumas debe</th><th className="num">Sumas haber</th><th className="num">Saldo deudor</th><th className="num">Saldo acreedor</th></tr></thead>
      <tbody>{m.map((c) => { const s = c.debe - c.haber; return <tr key={c.cuenta}><td className="cta">{a8(c.cuenta)}</td><td>{c.titulo}</td><td className="num">{eur(c.debe)}</td><td className="num">{eur(c.haber)}</td><td className="num">{s > 0.005 ? eur(s) : ""}</td><td className="num">{s < -0.005 ? eur(-s) : ""}</td></tr>; })}</tbody>
      <tfoot><tr><td colSpan="2"><strong>Totales</strong> {Math.abs(T.d - T.h) < 0.01 ? <span className="ok">cuadra</span> : <span className="pend">no cuadra</span>}</td><td className="num"><strong>{eur(T.d)}</strong></td><td className="num"><strong>{eur(T.h)}</strong></td><td colSpan="2" /></tr></tfoot>
    </table></div>
  );
}

function PyG({ asientos, anio, acumulado, esfl }) {
  const p = perdidasYGanancias(asientos, esfl);
  const q = acumulado ? perdidasYGanancias(acumulado, esfl) : null;
  const fila = (t, v, w, fuerte) => <tr key={t} className={fuerte ? "total" : ""}><td>{t}</td><td className={"num " + (v < 0 ? "neg" : "")}>{eur(v)}</td>{q && <td className={"num " + (w < 0 ? "neg" : "")}>{eur(w)}</td>}</tr>;
  return (
    <div className="estado">
      <h3>{esfl ? "Cuenta de resultados" : "Cuenta de pérdidas y ganancias"} · {anio} <span className="muted pequeño">({esfl ? "modelo abreviado de entidades sin fines lucrativos" : "modelo abreviado PGC PYMES"})</span></h3>
      <table className="tabla">
        {q && <thead><tr><th></th><th className="num">Trimestre</th><th className="num">Acumulado del año</th></tr></thead>}
        <tbody>
        {p.lineas.map(([t, v], i) => fila(t, v, q?.lineas[i][1]))}
        {fila(esfl ? "A) EXCEDENTE DE LA ACTIVIDAD" : "A) RESULTADO DE EXPLOTACIÓN", p.explotacion, q?.explotacion, true)}
        {p.financieras.map(([t, v], i) => fila(t, v, q?.financieras[i][1]))}
        {fila(esfl ? "B) EXCEDENTE DE LAS OPERACIONES FINANCIERAS" : "B) RESULTADO FINANCIERO", p.financiero, q?.financiero, true)}
        {fila(esfl ? "C) EXCEDENTE ANTES DE IMPUESTOS" : "C) RESULTADO ANTES DE IMPUESTOS", p.antesImpuestos, q?.antesImpuestos, true)}
        {fila("17. Impuesto sobre beneficios", p.impuesto, q?.impuesto)}
        {fila(esfl ? "D) EXCEDENTE DEL EJERCICIO" : "D) RESULTADO DEL EJERCICIO", p.resultado, q?.resultado, true)}
      </tbody></table>
    </div>
  );
}

function Balance({ asientos, anio, esfl }) {
  const b = balance(asientos, esfl);
  const bloque = (t, filas, total) => (<><tr className="total"><td>{t}</td><td className="num">{total !== undefined ? eur(total) : ""}</td></tr>{filas.map(([x, v]) => <tr key={x}><td className="sangria">{x}</td><td className="num">{eur(v)}</td></tr>)}</>);
  return (
    <div className="estado">
      <h3>Balance a {anio} {b.cuadra ? <span className="ok pequeño">cuadra</span> : <span className="pend pequeño">no cuadra: revisa partidas pendientes</span>}</h3>
      <div className="dos-estados">
        <table className="tabla"><tbody>{bloque("ACTIVO", b.activo, b.totalActivo)}</tbody></table>
        <table className="tabla"><tbody>{bloque("PATRIMONIO NETO", b.pn, b.pn.reduce((t, x) => t + x[1], 0))}{bloque("PASIVO", b.pasivo, b.pasivo.reduce((t, x) => t + x[1], 0))}<tr className="total"><td>TOTAL PATRIMONIO NETO Y PASIVO</td><td className="num">{eur(b.totalPasivo)}</td></tr></tbody></table>
      </div>
    </div>
  );
}

// ¿Esta cuenta suele llevar factura de un tercero?
const llevaFactura = (c) => /^(60|62[0-579]|21|20)/.test(c) || /^7[05]/.test(c);

function Aplicar({ pendientes, total, asig, guardar, plan: tipo }) {
  const [elegir, setElegir] = useState(null); // { movs, nombre, regla }
  const [paso, setPaso] = useState(null);     // { movs, regla, cuenta, e, tercero, factura }
  const [abierto, setAbierto] = useState(null);
  // Agrupado por entidad: se contesta una vez y vale para todos sus movimientos (y los que lleguen después)
  const grupos = useMemo(() => {
    const g = new Map();
    for (const m of pendientes) { const n = adivinarTercero(m.concepto) || "Sin nombre"; const k = claveTercero(n); if (!g.has(k)) g.set(k, { k, nombre: n, movs: [] }); g.get(k).movs.push(m); }
    return [...g.values()].sort((a, b) => b.movs.length - a.movs.length || Math.abs(b.movs.reduce((s, m) => s + m.importe, 0)) - Math.abs(a.movs.reduce((s, m) => s + m.importe, 0)));
  }, [pendientes]);
  if (!pendientes.length) return <div className="vacio"><p>✓ Todos los movimientos del banco de este periodo están contabilizados.</p>{total > 0 && <p className="muted">Quedan {total} sin documento en otros periodos.</p>}</div>;
  const terminar = (p) => {
    const v = { cuenta: p.cuenta, nota: p.e, ...(p.tercero.trim() ? { tercero: p.tercero.trim() } : {}), ...(p.factura && p.tercero.trim() ? { esperaFactura: true } : {}) };
    const n = { ...asig };
    if (p.regla) n["@" + claveTercero(p.tercero || p.nombre)] = { ...v, regla: true, nombreBanco: p.nombre };
    if (p.regla && claveTercero(p.tercero) !== claveTercero(p.nombre)) n["@" + claveTercero(p.nombre)] = { ...v, regla: true, nombreBanco: p.nombre };
    if (!p.regla) for (const m of p.movs) n[claveMov(m)] = { ...v, concepto: m.concepto };
    guardar(n); setPaso(null);
  };
  const reglas = Object.entries(asig).filter(([k]) => k.startsWith("@"));
  return (
    <div>
      <p className="muted pequeño">Movimientos del banco sin factura ni documento, agrupados por entidad. Contesta una vez «¿Dónde va?» por cada entidad y se aplica a todos sus movimientos y a los que lleguen después. Mientras tanto van a «partidas pendientes de aplicación» (555). Si es un profesional o proveedor, se le abre su subcuenta y queda pendiente su factura.</p>
      <div className="tabla-scroll"><table className="tabla">
        <thead><tr><th>Entidad</th><th className="num">Movimientos</th><th className="num">Importe</th><th></th></tr></thead>
        <tbody>{grupos.map((g) => (<Fragment key={g.k}>
          <tr>
            <td><button className="enlace" type="button" onClick={() => setAbierto(abierto === g.k ? null : g.k)}>{abierto === g.k ? "▾" : "▸"} <strong>{g.nombre}</strong></button></td>
            <td className="num">{g.movs.length}</td>
            <td className={"num " + (g.movs.reduce((s, m) => s + m.importe, 0) < 0 ? "neg" : "pos")}>{eur(g.movs.reduce((s, m) => s + m.importe, 0))}</td>
            <td><button className="btn mini" type="button" onClick={() => setElegir({ movs: g.movs, nombre: g.nombre, regla: true })}>¿Dónde va? {g.movs.length > 1 ? `(los ${g.movs.length})` : ""}</button></td>
          </tr>
          {abierto === g.k && g.movs.map((m) => <tr key={m._id} className="sub-fila"><td className="sangria">{m.fecha} · {m.concepto}</td><td></td><td className={"num " + (m.importe < 0 ? "neg" : "pos")}>{eur(m.importe)}</td><td><button className="enlace" type="button" onClick={() => setElegir({ movs: [m], nombre: g.nombre, regla: false })}>solo este</button></td></tr>)}
        </Fragment>))}</tbody>
      </table></div>
      {reglas.length > 0 && <details className="pequeño"><summary>Reglas por entidad ({reglas.length})</summary><ul>{reglas.map(([k, v]) => <li key={k}>{v.nombreBanco || v.tercero || k.slice(1)} → {a8(v.cuenta)}{v.esperaFactura ? " (subcuenta propia, espera factura)" : ""} <button className="enlace" type="button" onClick={() => { const n = { ...asig }; delete n[k]; guardar(n); }}>quitar</button></li>)}</ul></details>}
      {elegir && <Asistente plan={tipo} contexto={`${elegir.nombre} · ${elegir.movs.length} movimiento${elegir.movs.length > 1 ? "s" : ""} · ${eur(elegir.movs.reduce((s, m) => s + m.importe, 0))}`} onCerrar={() => setElegir(null)}
        onElegir={(cuenta, e) => { setPaso({ ...elegir, cuenta, e, tercero: elegir.nombre === "Sin nombre" ? "" : elegir.nombre, factura: llevaFactura(cuenta) }); setElegir(null); }} />}
      {paso && (
        <div className="mc-fondo" role="dialog" aria-modal="true" aria-labelledby="tr-t">
          <div className="mc-dialogo">
            <header><h2 id="tr-t">{paso.movs[0].importe < 0 ? "¿A quién se le paga?" : "¿Quién paga?"}</h2><button className="mc-x" onClick={() => setPaso(null)} aria-label="Cerrar">×</button></header>
            <div className="mc-cuerpo">
              <p className="mc-nota">{paso.movs.length} movimiento{paso.movs.length > 1 ? "s" : ""} · {paso.movs[0].concepto}{paso.movs.length > 1 ? "…" : ""}</p>
              <label className="mc-campo"><span>Nombre de la entidad (corrígelo si hace falta)</span><input autoFocus value={paso.tercero} onChange={(e) => setPaso({ ...paso, tercero: e.target.value })} placeholder="p. ej. Solve Abogados" /></label>
              <div className="as-opciones">
                <button type="button" className={paso.factura ? "on" : ""} onClick={() => setPaso({ ...paso, factura: true })}>
                  <strong>Tiene o tendrá factura</strong><br /><small>Se le abre su subcuenta ({paso.movs[0].importe < 0 ? "410" : "430"} + su nombre) y se cuadra con sus facturas por saldo. El gasto irá a {a8(paso.cuenta)}{/^62[23]/.test(paso.cuenta) ? " con su retención (modelo 111)" : ""}.</small></button>
                <button type="button" className={!paso.factura ? "on" : ""} onClick={() => setPaso({ ...paso, factura: false })}>
                  <strong>No lleva factura</strong><br /><small>Tasas, impuestos, comisiones del banco, nóminas, préstamos, aportaciones… Va directamente a {a8(paso.cuenta)}.</small></button>
              </div>
              {paso.movs.length === 1 && <label className="check"><input type="checkbox" checked={paso.regla} onChange={(e) => setPaso({ ...paso, regla: e.target.checked })} /> Aplicarlo también a los próximos movimientos de esta entidad</label>}
            </div>
            <footer>
              <button className="mc-btn sec" onClick={() => setPaso(null)}>Cancelar</button>
              <button className="mc-btn" disabled={paso.factura && !paso.tercero.trim()} onClick={() => terminar(paso)}>Guardar</button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

function Manual({ manuales, guardar, plan: tipo }) {
  const vacio = { fecha: new Date().toLocaleDateString("es-ES"), concepto: "", lineas: [{ cuenta: "", debe: "", haber: "" }, { cuenta: "", debe: "", haber: "" }] };
  const [a, setA] = useState(vacio);
  const [asis, setAsis] = useState(null);
  const D = a.lineas.reduce((t, l) => t + num(l.debe), 0), H = a.lineas.reduce((t, l) => t + num(l.haber), 0);
  const ok = a.concepto.trim() && Math.abs(D - H) < 0.01 && D > 0 && a.lineas.every((l) => !num(l.debe) && !num(l.haber) || l.cuenta);
  const linea = (i, k, v) => setA({ ...a, lineas: a.lineas.map((l, j) => (j === i ? { ...l, [k]: v } : l)) });
  return (
    <div>
      <div className="tarjeta">
        <h3>Nuevo asiento</h3>
        <div className="fila"><label>Fecha<input value={a.fecha} onChange={(e) => setA({ ...a, fecha: e.target.value })} /></label><label>Concepto<input value={a.concepto} onChange={(e) => setA({ ...a, concepto: e.target.value })} /></label></div>
        <table className="tabla"><thead><tr><th>Cuenta</th><th className="num">Debe</th><th className="num">Haber</th><th></th></tr></thead>
          <tbody>{a.lineas.map((l, i) => <tr key={i}>
            <td><input value={l.cuenta} onChange={(e) => linea(i, "cuenta", e.target.value.replace(/\D/g, ""))} placeholder="p. ej. 629" /> <button className="enlace" type="button" onClick={() => setAsis(i)}>¿Cuál?</button></td>
            <td><input className="num" value={l.debe} onChange={(e) => linea(i, "debe", e.target.value)} /></td>
            <td><input className="num" value={l.haber} onChange={(e) => linea(i, "haber", e.target.value)} /></td>
            <td>{a.lineas.length > 2 && <button className="enlace" type="button" onClick={() => setA({ ...a, lineas: a.lineas.filter((_, j) => j !== i) })}>Quitar</button>}</td></tr>)}</tbody>
          <tfoot><tr><td><button className="enlace" type="button" onClick={() => setA({ ...a, lineas: [...a.lineas, { cuenta: "", debe: "", haber: "" }] })}>+ Línea</button></td><td className="num">{eur(D)}</td><td className="num">{eur(H)}</td><td>{Math.abs(D - H) < 0.01 ? <span className="ok">cuadra</span> : <span className="pend">descuadre {eur(D - H)}</span>}</td></tr></tfoot>
        </table>
        <button className="btn" type="button" disabled={!ok} onClick={() => { guardar([...manuales, { ...a, id: Date.now(), lineas: a.lineas.filter((l) => num(l.debe) || num(l.haber)).map((l) => ({ cuenta: l.cuenta, debe: num(l.debe), haber: num(l.haber) })) }]); setA(vacio); }}>Guardar asiento</button>
      </div>
      {manuales.length > 0 && <div className="tabla-scroll"><table className="tabla"><thead><tr><th>Fecha</th><th>Concepto</th><th className="num">Importe</th><th></th></tr></thead>
        <tbody>{manuales.map((m) => <tr key={m.id}><td>{m.fecha}</td><td>{m.concepto}</td><td className="num">{eur(m.lineas.reduce((t, l) => t + num(l.debe), 0))}</td><td><button className="enlace" type="button" onClick={() => window.confirm("¿Borrar este asiento manual?") && guardar(manuales.filter((x) => x.id !== m.id))}>Borrar</button></td></tr>)}</tbody></table></div>}
      {asis !== null && <Asistente plan={tipo} onCerrar={() => setAsis(null)} onElegir={(c) => { linea(asis, "cuenta", c); setAsis(null); }} />}
    </div>
  );
}

function Exportar({ asientos, anio }) {
  return (
    <div className="tarjeta">
      <h3>Llevar la contabilidad a A3 o Sage</h3>
      <p>Se descarga el libro diario del periodo {anio}, un apunte por línea, con las subcuentas a 8 dígitos, y el plan de cuentas usado. La gestoría lo importa con la opción de importar asientos desde Excel o texto de su programa.</p>
      <div className="acciones">
        <button className="btn" type="button" onClick={() => descargarTexto(exportarApuntes(asientos, "a3"), `Diario ${anio} - A3.csv`)}>Diario para A3</button>
        <button className="btn" type="button" onClick={() => descargarTexto(exportarApuntes(asientos, "sage"), `Diario ${anio} - Sage.csv`)}>Diario para Sage / ContaPlus</button>
        <button className="btn ghost" type="button" onClick={() => descargarTexto(exportarPlanCuentas(asientos), `Plan de cuentas ${anio}.csv`)}>Plan de cuentas</button>
      </div>
      <p className="muted pequeño">Cada versión de A3 y Sage tiene su propio asistente de importación: la primera vez, la gestoría indica qué columna es cada dato (fecha, cuenta, debe, haber…). Si me pasan un archivo de ejemplo de su programa, se puede generar exactamente en su formato.</p>
    </div>
  );
}

function PlanContable({ tipo, cambiar, aviso }) {
  const p = plan(tipo);
  const [estado, setEstado] = useState(null);
  const [nuevo, setNuevo] = useState(null);
  const [resumen, setResumen] = useState("");
  const [buscar, setBuscar] = useState("");
  useEffect(() => { comprobarBOE(tipo).then(setEstado).catch(() => setEstado({ error: true })); }, [tipo]);
  const lista = Object.entries(p.cuentas).filter(([k, v]) => !buscar || k.startsWith(buscar) || v.toLowerCase().includes(buscar.toLowerCase())).slice(0, 300);
  return (
    <div>
      <div className="tarjeta">
        <h3>Plan contable</h3>
        <label>Plan que usa esta empresa
          <select value={tipo} onChange={(e) => cambiar(e.target.value)}>
            <option value="pymes">PGC de PYMES (la mayoría de sociedades pequeñas)</option>
            <option value="pgc">PGC general</option>
            <option value="esfl">Entidades sin fines lucrativos (asociaciones, fundaciones)</option>
          </select>
        </label>
        <p className="pequeño">{p.nombre} · texto consolidado del BOE actualizado el <strong>{fechaBOE(p.fecha_actualizacion)}</strong> · {Object.keys(p.cuentas).length} cuentas. <a href={`https://www.boe.es/buscar/act.php?id=${p.boe}`} target="_blank" rel="noopener">Ver en el BOE</a></p>
        {estado?.error && <p className="nota">No se ha podido consultar el BOE ahora. Se volverá a comprobar la próxima vez.</p>}
        {estado && !estado.error && (estado.cambiado
          ? <div className="nota error"><strong>El BOE ha publicado cambios</strong> ({fechaBOE(estado.boe)}). <button className="btn mini" type="button" onClick={async () => { try { const r = await descargarDelBOE(tipo); setNuevo(r); const t = `Nuevas: ${r.diff.nuevas.map((x) => x.join(" ")).join("; ")}\nCambiadas: ${r.diff.cambiadas.map((x) => x.join(" → ")).join("; ")}\nQuitadas: ${r.diff.quitadas.map((x) => x.join(" ")).join("; ")}`; const ia = await preguntarIA("Explica en lenguaje sencillo, en 5 líneas como máximo, qué cambios hay en el cuadro de cuentas del Plan General Contable y a qué empresas afectan:\n" + t.slice(0, 5000), { maxTokens: 400 }); setResumen(ia.estado === "ok" ? ia.texto : ""); } catch (e) { aviso?.(e.message); } }}>Ver los cambios</button></div>
          : <p className="ok pequeño">✓ Al día con el BOE (comprobado ahora).</p>)}
        {nuevo && (
          <div className="nota">
            <p><strong>{nuevo.diff.nuevas.length}</strong> cuentas nuevas · <strong>{nuevo.diff.cambiadas.length}</strong> cambiadas · <strong>{nuevo.diff.quitadas.length}</strong> quitadas.</p>
            {resumen && <p className="pequeño">{resumen} <em>(resumen de la IA de tu ordenador)</em></p>}
            <ul className="pequeño">{[...nuevo.diff.nuevas.map(([k, v]) => `+ ${k} ${v}`), ...nuevo.diff.cambiadas.map(([k, a, b]) => `~ ${k} ${a} → ${b}`), ...nuevo.diff.quitadas.map(([k, v]) => `− ${k} ${v}`)].slice(0, 40).map((x) => <li key={x}>{x}</li>)}</ul>
            <button className="btn" type="button" onClick={() => { aplicarActualizacion(nuevo.base, nuevo.nuevo); setNuevo(null); setEstado({ ...estado, cambiado: false }); aviso?.("Plan contable actualizado"); }}>Aplicar la actualización</button>
          </div>
        )}
      </div>
      <input className="buscar" placeholder="Buscar cuenta (número o nombre)…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
      <div className="tabla-scroll"><table className="tabla"><thead><tr><th>Cuenta</th><th>Nombre</th><th>8 dígitos</th></tr></thead>
        <tbody>{lista.map(([k, v]) => <tr key={k} className={k.length === 2 ? "total" : ""}><td className="cta">{k}</td><td>{v}</td><td className="muted">{k.length >= 3 ? a8(k) : ""}</td></tr>)}</tbody></table></div>
    </div>
  );
}
