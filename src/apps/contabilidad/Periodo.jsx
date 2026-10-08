// Resumen por trimestre y año (impuestos y pendientes) y cierre del extracto del banco.
import { useEffect, useMemo, useState } from "react";
import { TRAMOS, rango, cifras, porGestionar, plazos, fechaBonita, huella, saldosExtracto, saldo572, claveCierre, enRango, noPagada } from "./periodo.js";
import { filtrarPeriodo } from "./motor.js";
import { a8 } from "./pgc.js";
import { eur, num, fechaOrden, guardarJustificante, subir } from "./datos.js";
import { espacioActual } from "../../lib/espacio.js";

export function SelPeriodo({ anio, tramo, cambiar, cierres = {}, anios }) {
  const hoy = new Date().getFullYear();
  const lista = anios?.length ? anios : [hoy - 2, hoy - 1, hoy];
  const tAct = String(Math.floor(new Date().getMonth() / 3) + 1);
  return (
    <div className="sel-periodo" role="group" aria-label="Periodo">
      <select value={anio} onChange={(e) => cambiar(+e.target.value, tramo)} aria-label="Año">{lista.map((a) => <option key={a} value={a}>{a}{a === hoy ? " (actual)" : ""}</option>)}</select>
      {TRAMOS.map(([k, t]) => <button key={k} type="button" className={tramo === k ? "on" : ""} onClick={() => cambiar(anio, k)}>{t}{cierres[`${anio}-${k}`] && <span className="candado" title="Extracto cerrado">✓</span>}</button>)}
      {(anio !== hoy || tramo !== tAct) && <button type="button" className="enlace hoy" onClick={() => cambiar(hoy, tAct)}>Volver al trimestre actual</button>}
    </div>
  );
}

const Kpi = ({ t, v, n, a, tono, onClick }) => (onClick
  ? <button type="button" className={"kpi kpi-btn " + (tono || "")} onClick={onClick} title="Ver de dónde sale">
      <span>{t}</span><strong>{v}</strong>{n && <small>{n}</small>}{a && <small className="kpi-anio">{a}</small>}<em className="kpi-ver">Ver detalle ›</em>
    </button>
  : <div className={"kpi " + (tono || "")}><span>{t}</span><strong>{v}</strong>{n && <small>{n}</small>}{a && <small className="kpi-anio">{a}</small>}</div>);
const signoIVA = (v) => (v > 0.005 ? "a ingresar" : v < -0.005 ? "a compensar / devolver" : "sin cuota");

// ---- Desglose: de dónde sale cada cifra ----
function avisosAsiento(a, d) {
  const out = [];
  const f = d.facturas.find((x) => x.archivo === a.doc) || (d.emitidas || []).find((x) => x.archivo === a.doc);
  if (a.origen === "banco-pendiente") out.push(["sin documento: va a 555 hasta que digas qué es", "libros", "aplicar"]);
  if (a.origen === "banco") out.push(["asignado a mano, sin factura", "libros", "aplicar"]);
  if (!a.cuadra) out.push(["asiento descuadrado", "facturas", f?.emitida ? "emitidas" : null]);
  if (f) {
    if (!f._leida) out.push(["factura sin leer", "facturas", f.emitida ? "emitidas" : null]);
    else if (f.analizado_ia && !f._editada) out.push(["leída por la IA, sin revisar", "facturas", f.emitida ? "emitidas" : null]);
    if (noPagada(f, d)) out.push([f.emitida ? "sin cobro en el banco" : "sin pago en el banco", "facturas", f.emitida ? "emitidas" : null]);
  }
  return out;
}
const lineasDe = (A, filtro, signo, d, etiqueta) => A.flatMap((a) => a.lineas.filter((l) => filtro(l, a)).map((l) => ({ fecha: a.fecha, concepto: a.concepto, cuenta: l.cuenta, titulo: l.titulo, importe: (l.debe - l.haber) * signo, doc: a.doc, avisos: avisosAsiento(a, d), etq: etiqueta?.(l, a) })));
const filaFactura = (f, d) => ({ fecha: f.fecha, concepto: `${f.emitida ? f.cliente || "" : f.proveedor || ""} ${f.numero || ""}`.trim() || f.archivo, cuenta: f.cuenta_pgc, importe: f.emitida ? f.total : -f.total, doc: f.archivo, avisos: [!f._leida && ["factura sin leer", "facturas", f.emitida ? "emitidas" : null], f._leida && f.analizado_ia && !f._editada && ["leída por la IA, sin revisar", "facturas", f.emitida ? "emitidas" : null], noPagada(f, d) && f.total && [f.emitida ? "sin cobro en el banco" : "sin pago en el banco", "facturas", f.emitida ? "emitidas" : null]].filter(Boolean) });
const filaMov = (m, pendIds) => ({ fecha: m.fecha, concepto: m.concepto, importe: m.importe, doc: m._factura || m._emitida || "", avisos: [pendIds.has(m._id) && [m.importe < 0 ? "pago sin factura" : "cobro sin factura emitida", "libros", "aplicar"], m.importe < 0 && !m._justificante && ["falta el justificante del banco", "banco", null]].filter(Boolean) });

export function detalle(tipo, r, todos, d, pendientes) {
  const A = filtrarPeriodo(todos, r.desde, r.hasta).filter((a) => a.origen !== "regularizacion");
  const pendIds = new Set(pendientes.map((m) => m._id));
  const fR = d.facturas.filter((f) => enRango(f.fecha, r)), fE = (d.emitidas || []).filter((f) => enRango(f.fecha, r));
  const movs = d.movimientos.filter((m) => enRango(m.fecha, r));
  const es = (p) => (l) => l.cuenta.startsWith(p);
  const D = {
    ingresos: ["Ingresos", "Cuentas del grupo 7 (ventas, servicios, alquileres, subvenciones…).", () => lineasDe(A, es("7"), -1, d)],
    gastos: ["Gastos", "Cuentas del grupo 6 (compras, servicios, sueldos, tributos…).", () => lineasDe(A, (l) => l.cuenta.startsWith("6") && !l.cuenta.startsWith("630"), -1, d)],
    resultado: ["Resultado", "Ingresos (grupo 7) menos gastos (grupo 6) del periodo.", () => lineasDe(A, (l) => /^[67]/.test(l.cuenta) && !l.cuenta.startsWith("630"), -1, d)],
    iva: ["IVA del periodo", "IVA repercutido de las facturas emitidas (477) menos IVA soportado de las facturas recibidas (472). Positivo: a ingresar.", () => lineasDe(A, (l) => /^47[27]/.test(l.cuenta), -1, d, (l) => (l.cuenta.startsWith("477") ? "repercutido" : "soportado"))],
    ret: ["Retenciones practicadas", "Retenciones de las facturas de profesionales (modelo 111) y de alquileres (modelo 115): se ingresan en Hacienda.", () => lineasDe(A, (l) => l.cuenta.startsWith("4751") && l.haber > 0, -1, d, (l, a) => (a.lineas.some((x) => x.cuenta.startsWith("621")) ? "115" : "111"))],
    recibidas: ["Facturas recibidas", "Facturas de la carpeta «facturas» con fecha en el periodo.", () => fR.map((f) => filaFactura(f, d))],
    pendPago: ["Pendientes de pago", "Facturas recibidas que no cubren los pagos hechos a ese proveedor (se cuadra por el saldo de su subcuenta).", () => fR.filter((f) => f.total && noPagada(f, d)).map((f) => filaFactura(f, d))],
    gasto: ["Gasto (base de las facturas)", "Base imponible de las facturas recibidas del periodo.", () => fR.map((f) => ({ ...filaFactura(f, d), importe: -f.base }))],
    emitidas: ["Facturas emitidas", "Facturas de la carpeta «facturas_emitidas» con fecha en el periodo.", () => fE.map((f) => filaFactura(f, d))],
    pendCobro: ["Pendientes de cobro", "Facturas emitidas que no cubren los cobros de ese cliente (se cuadra por el saldo de su subcuenta).", () => fE.filter((f) => f.total && noPagada(f, d)).map((f) => filaFactura(f, d))],
    entradas: ["Entradas en el banco", "Movimientos positivos del extracto.", () => movs.filter((m) => m.importe > 0).map((m) => filaMov(m, pendIds))],
    salidas: ["Salidas del banco", "Movimientos negativos del extracto.", () => movs.filter((m) => m.importe < 0).map((m) => filaMov(m, pendIds))],
    sinDoc: ["Movimientos sin documento", "Movimientos del banco sin factura ni documento: están en «partidas pendientes de aplicación» (555).", () => movs.filter((m) => pendIds.has(m._id)).map((m) => filaMov(m, pendIds))],
  }[tipo];
  if (!D) return null;
  const filas = D[2]().sort((x, y) => fechaOrden(x.fecha).localeCompare(fechaOrden(y.fecha)));
  return { titulo: D[0], explica: D[1], filas, total: Math.round(filas.reduce((s, f) => s + (f.importe || 0), 0) * 100) / 100 };
}

export function Desglose({ tipo, r, todos, d, pendientes, irA, onCerrar }) {
  const x = useMemo(() => detalle(tipo, r, todos, d, pendientes), [tipo, r, todos, d, pendientes]);
  const [solo, setSolo] = useState(false);
  if (!x) return null;
  const archivoDe = (n) => d.facturas.find((f) => f.archivo === n)?._arch || (d.emitidas || []).find((f) => f.archivo === n)?._arch;
  const ver = async (n) => { const a = archivoDe(n); if (!a) return; const f = await a.h.getFile(); const u = URL.createObjectURL(f); window.open(u, "_blank", "noopener"); setTimeout(() => URL.revokeObjectURL(u), 60000); };
  const conAviso = x.filas.filter((f) => f.avisos?.length).length;
  const filas = solo ? x.filas.filter((f) => f.avisos?.length) : x.filas;
  return (
    <div className="mc-fondo" role="dialog" aria-modal="true" aria-labelledby="dg-t">
      <div className="mc-dialogo ancho">
        <header><h2 id="dg-t">{x.titulo} · {r.etiqueta}</h2><button className="mc-x" onClick={onCerrar} aria-label="Cerrar">×</button></header>
        <div className="mc-cuerpo">
          <p className="muted pequeño">{x.explica}</p>
          <div className="dg-resumen"><span>{x.filas.length} apuntes · total <strong>{eur(x.total)}</strong></span>
            {conAviso > 0 && <label className="check"><input type="checkbox" checked={solo} onChange={(e) => setSolo(e.target.checked)} /> Ver solo los {conAviso} que tienen algo pendiente</label>}</div>
          {!filas.length ? <p className="muted">No hay nada en este periodo.</p> : (
            <div className="tabla-scroll"><table className="tabla dg">
              <thead><tr><th>Fecha</th><th>Concepto</th><th>Cuenta</th><th className="num">Importe</th><th>Pendiente</th></tr></thead>
              <tbody>{filas.map((f, i) => (
                <tr key={i} className={f.avisos?.length ? "con-aviso" : ""}>
                  <td>{f.fecha || "—"}</td>
                  <td>{f.concepto}{f.etq && <span className="etq">{f.etq}</span>}{f.doc && archivoDe(f.doc) && <> <button className="enlace" type="button" onClick={() => ver(f.doc)}>ver documento</button></>}</td>
                  <td className="cta">{f.cuenta ? a8(f.cuenta) : ""}</td>
                  <td className={"num " + (f.importe < 0 ? "neg" : "")}>{eur(f.importe)}</td>
                  <td>{(f.avisos || []).map(([t, tab, sub], k) => <button key={k} type="button" className="aviso-btn" onClick={() => { onCerrar(); irA(tab, sub); }}>{t} ›</button>)}{!f.avisos?.length && <span className="ok">✓</span>}</td>
                </tr>))}</tbody>
            </table></div>
          )}
        </div>
        <footer><button className="mc-btn" onClick={onCerrar}>Cerrar</button></footer>
      </div>
    </div>
  );
}

export function ResumenPeriodo({ d, todos, pendientes, vinculados, r, cambiar, cierres, irA, esfl = false }) {
  const RES = esfl ? "Excedente" : "Resultado";
  const c = useMemo(() => cifras(todos, d.movimientos, pendientes, r, d), [todos, d, pendientes, r]);
  const ra = useMemo(() => rango(r.anio, "anio"), [r.anio]);
  const ca = useMemo(() => cifras(todos, d.movimientos, pendientes, ra, d), [todos, d, pendientes, ra]);
  const lista = useMemo(() => porGestionar(d, todos, pendientes, vinculados, r), [d, todos, pendientes, vinculados, r]);
  const columnas = useMemo(() => TRAMOS.map(([k, t]) => { const rr = rango(r.anio, k); return { k, t, rr, c: cifras(todos, d.movimientos, pendientes, rr, d), n: porGestionar(d, todos, pendientes, vinculados, rr).reduce((s, x) => s + x.items.length, 0) }; }), [todos, d, pendientes, vinculados, r.anio]);
  const [ver, setVer] = useState(null); // { tipo, r }
  const P = plazos(r);
  const totalPend = lista.reduce((s, x) => s + x.items.length, 0);
  const esAnio = r.tramo === "anio";
  const delAnio = (v) => (esAnio ? null : `Año ${r.anio}: ${v}`);
  const irPend = () => document.getElementById("por-gestionar")?.scrollIntoView({ behavior: "smooth" });

  const filas = [
    ["Facturas recibidas", (x) => x.nRecibidas, "recibidas"], ["Pendientes de pago", (x) => eur(x.importePendPago), "pendPago"],
    ["Facturas emitidas", (x) => x.nEmitidas, "emitidas"], ["Pendientes de cobro", (x) => eur(x.importePendCobro), "pendCobro"],
    ["Ingresos", (x) => eur(x.ingresos), "ingresos"], ["Gastos", (x) => eur(x.gastos), "gastos"], [esfl ? "Excedente antes de impuestos" : "Resultado antes de impuestos", (x) => eur(x.resultado), "resultado", "total"],
    ["IVA repercutido (477)", (x) => eur(x.ivaRep), "iva"], ["IVA soportado (472)", (x) => eur(x.ivaSop), "iva"], ["Resultado IVA (303 / 390)", (x) => eur(x.iva303), "iva", "total"],
    ["Retenciones 111 (profesionales y nóminas)", (x) => eur(x.ret111), "ret"], ["Retenciones 115 (alquileres)", (x) => eur(x.ret115), "ret"],
    ["Banco: entradas", (x) => eur(x.entradas), "entradas"], ["Banco: salidas", (x) => eur(x.salidas), "salidas"],
    ["Movimientos sin documento", (x) => x.sinDoc || "—", "sinDoc"],
  ];

  return (
    <div className="cont-resumen">
      <p className="muted pequeño">Pulsa cualquier cifra para ver de dónde sale y qué queda pendiente.</p>
      <div className="kpis">
        <Kpi t={`Facturas recibidas · ${r.corta}`} v={c.nRecibidas} n={c.recibidasSinLeer ? `${c.recibidasSinLeer} sin leer` : "todas leídas"} a={delAnio(ca.nRecibidas)} onClick={() => setVer({ tipo: "recibidas", r })} />
        <Kpi t="Pendientes de pago" v={c.nPendPago} n={eur(c.importePendPago)} a={delAnio(`${ca.nPendPago} · ${eur(ca.importePendPago)}`)} tono={c.nPendPago ? "aviso" : ""} onClick={() => setVer({ tipo: "pendPago", r })} />
        <Kpi t="Gasto (base)" v={eur(c.gastoBase)} n={`IVA soportado ${eur(c.ivaSopFacturas)}`} a={delAnio(eur(ca.gastoBase))} onClick={() => setVer({ tipo: "gasto", r })} />
        <Kpi t={`Retenciones (${P.ret.modelo})`} v={eur(c.ret111 + c.ret115)} n={`111: ${eur(c.ret111)} · 115: ${eur(c.ret115)}`} a={delAnio(eur(ca.ret111 + ca.ret115))} onClick={() => setVer({ tipo: "ret", r })} />
        <Kpi t={`${RES} ${r.corta}`} v={eur(c.resultado)} n={`Ingresos ${eur(c.ingresos)} · Gastos ${eur(c.gastos)}`} a={delAnio(eur(ca.resultado))} onClick={() => setVer({ tipo: "resultado", r })} />
        <Kpi t={`IVA (modelo ${P.iva.modelo})`} v={eur(c.iva303)} n={`${signoIVA(c.iva303)} · plazo ${fechaBonita(P.iva.fecha)}`} a={delAnio(eur(ca.iva303))} tono={c.iva303 > 0 ? "aviso" : ""} onClick={() => setVer({ tipo: "iva", r })} />
        <Kpi t="Facturas emitidas" v={c.nEmitidas} n={c.nPendCobro ? `${c.nPendCobro} sin cobrar · ${eur(c.importePendCobro)}` : "todas cobradas"} a={delAnio(ca.nEmitidas)} onClick={() => setVer({ tipo: "emitidas", r })} />
        <Kpi t="Por gestionar" v={totalPend} n={totalPend ? "ver la lista" : "todo en orden"} tono={totalPend ? "aviso" : "bien"} onClick={irPend} />
      </div>

      <section className="tarjeta">
        <h2>{r.anio} por trimestres</h2>
        <div className="tabla-scroll"><table className="tabla trimestres">
          <thead><tr><th></th>{columnas.map((x) => <th key={x.k} className={"num " + (x.k === r.tramo ? "sel" : "")}><button className="enlace" type="button" onClick={() => cambiar(r.anio, x.k)}>{x.t}</button></th>)}</tr></thead>
          <tbody>
            {filas.map(([t, f, tipo, cl], i) => <tr key={i} className={cl || ""}><td>{t}</td>{columnas.map((x) => <td key={x.k} className={"num celda " + (x.k === r.tramo ? "sel" : "")}><button type="button" onClick={() => setVer({ tipo, r: x.rr })} title="Ver de dónde sale">{f(x.c)}</button></td>)}</tr>)}
            <tr><td>Por gestionar</td>{columnas.map((x) => <td key={x.k} className={"num celda " + (x.k === r.tramo ? "sel" : "")}><button type="button" onClick={() => { cambiar(r.anio, x.k); setTimeout(irPend, 50); }}>{x.n ? <span className="pend">{x.n}</span> : <span className="ok">✓</span>}</button></td>)}</tr>
            <tr><td>Extracto del banco</td>{columnas.map((x) => <td key={x.k} className={"num " + (x.k === r.tramo ? "sel" : "")}>{cierres[claveCierre(x.rr)] ? <span className="ok">cerrado</span> : <span className="muted">abierto</span>}</td>)}</tr>
          </tbody>
        </table></div>
      </section>

      <section className="tarjeta">
        <h2>Impuestos · {r.etiqueta}</h2>
        <table className="tabla impuestos"><tbody>
          <tr><td><strong>IVA</strong> · modelo {P.iva.modelo}</td><td>Repercutido {eur(c.ivaRep)} − soportado {eur(c.ivaSop)}</td><td className="num"><strong>{eur(c.iva303)}</strong> <small className="muted">{signoIVA(c.iva303)}</small></td><td>plazo {fechaBonita(P.iva.fecha)}</td></tr>
          <tr><td><strong>Retenciones</strong> · modelo 111</td><td>Profesionales (abogados, notarios, asesores…) y nóminas</td><td className="num"><strong>{eur(c.ret111)}</strong></td><td>plazo {fechaBonita(P.ret.fecha)}</td></tr>
          <tr><td><strong>Retenciones</strong> · modelo 115</td><td>Alquileres de locales y oficinas</td><td className="num"><strong>{eur(c.ret115)}</strong></td><td>plazo {fechaBonita(P.ret.fecha)}</td></tr>
          {esfl
            ? <tr><td><strong>Sociedades</strong> · modelo 200</td><td>Excedente acumulado: {eur(c.acumulado)}. Las cuotas, donativos y subvenciones están exentas; tributan las actividades económicas.</td><td className="num"><small className="muted">lo calcula la gestoría</small></td><td>anual (julio)</td></tr>
            : <tr><td><strong>Sociedades</strong>{P.is ? <> · modelo {P.is.modelo}</> : ""}</td><td>Resultado acumulado del 1 de enero al {fechaBonita(r.hasta)}: {eur(c.acumulado)}</td><td className="num"><strong>{eur(c.isEstimado)}</strong> <small className="muted">estimación al 25 %</small></td><td>{P.is ? `plazo ${fechaBonita(P.is.fecha)}` : "sin pago fraccionado este trimestre"}</td></tr>}
        </tbody></table>
        <p className="muted pequeño">Cifras orientativas sacadas de la contabilidad; la gestoría confirma el tipo del Impuesto sobre Sociedades y si hay pagos fraccionados. Lo ya presentado y pagado está en la pestaña <button className="enlace" type="button" onClick={() => irA("impuestos")}>Impuestos</button>.{c.descuadrados > 0 && <span className="pend"> Hay {c.descuadrados} asientos descuadrados que pueden alterar estas cifras.</span>}</p>
      </section>

      <section className="tarjeta" id="por-gestionar">
        <h2>Por gestionar · {r.etiqueta}</h2>
        {!lista.length ? <p className="ok">✓ No queda nada pendiente en este periodo.</p> : lista.map((g) => (
          <details key={g.id} className="gestionar" open={g.items.length <= 5}>
            <summary><strong>{g.titulo}</strong> <span className="insignia">{g.items.length}</span>
              <button className="btn mini" type="button" onClick={(e) => { e.preventDefault(); irA(g.accion.tab, g.accion.sub); }}>{g.accion.texto}</button></summary>
            <p className="muted pequeño">{g.explica}</p>
            <table className="tabla"><tbody>{g.items.slice(0, 50).map((i, k) => <tr key={k}><td>{i.fecha}</td><td>{i.texto}</td><td className={"num " + (i.importe < 0 ? "neg" : "pos")}>{i.importe !== undefined ? eur(i.importe) : ""}</td></tr>)}</tbody></table>
            {g.items.length > 50 && <p className="muted pequeño">… y {g.items.length - 50} más.</p>}
          </details>
        ))}
      </section>
      {ver && <Desglose tipo={ver.tipo} r={ver.r} todos={todos} d={d} pendientes={pendientes} irA={irA} onCerrar={() => setVer(null)} />}
    </div>
  );
}

// ---- Banco del periodo con cierre del extracto ----
export function BancoPeriodo({ d, raiz, recargar, todos, pendientes, r, cierres, guardarCierres, irA, aviso }) {
  const [just, setJust] = useState(null); // movimiento al que asociar justificante
  const [soloFaltan, setSoloFaltan] = useState(false);
  const movs = useMemo(() => d.movimientos.filter((m) => enRango(m.fecha, r)).sort((a, b) => fechaOrden(b.fecha).localeCompare(fechaOrden(a.fecha))), [d, r]);
  const c = useMemo(() => cifras(todos, d.movimientos, pendientes, r), [todos, d, pendientes, r]);
  const pendIds = useMemo(() => new Set(pendientes.map((m) => m._id)), [pendientes]);
  const docDe = useMemo(() => { const m = new Map(); for (const a of todos) if (a.mov !== null && a.mov !== undefined && a.origen !== "banco-pendiente") m.set(a.mov, a); return m; }, [todos]);
  const s = saldosExtracto(d.movimientos, r);
  const contable = saldo572(todos, r);
  const cierre = cierres[claveCierre(r)];
  const [huellaAhora, setHuella] = useState("");
  const [dialogo, setDialogo] = useState(false);
  useEffect(() => { huella(d.movimientos, r).then(setHuella); }, [d, r]);
  const cambiado = cierre && huellaAhora && cierre.huella !== huellaAhora;
  const verJust = async (n) => { const j = (d.justificantes || []).find((x) => x.nombre === n); if (!j) return; const f = await j.arch.h.getFile(); const u = URL.createObjectURL(f); window.open(u, "_blank", "noopener"); setTimeout(() => URL.revokeObjectURL(u), 60000); };
  const faltanJust = movs.filter((m) => m.importe < 0 && !m._justificante).length;
  const trimestresAbiertos = r.tramo === "anio" ? ["1", "2", "3", "4"].filter((t) => !cierres[`${r.anio}-${t}`]) : [];

  return (
    <div>
      <section className={"tarjeta cierre " + (cierre ? (cambiado ? "mal" : "bien") : "")}>
        <div className="cierre-cab">
          <h2>Extracto · {r.etiqueta}</h2>
          {cierre
            ? <span className={cambiado ? "pend" : "ok"}>{cambiado ? "⚠ Cerrado, pero el extracto ha cambiado después" : `✓ Cerrado el ${new Date(cierre.fecha).toLocaleDateString("es-ES")}${cierre.por ? " por " + cierre.por : ""}`}</span>
            : <span className="muted">Abierto</span>}
        </div>
        <div className="kpis">
          <Kpi t="Saldo inicial" v={s ? eur(s.inicial) : "—"} n={s ? "según el extracto" : "el extracto no trae saldos"} />
          <Kpi t="Entradas" v={eur(c.entradas)} n={`${movs.filter((m) => m.importe > 0).length} movimientos`} />
          <Kpi t="Salidas" v={eur(c.salidas)} n={`${movs.filter((m) => m.importe < 0).length} movimientos`} />
          <Kpi t="Saldo final" v={s ? eur(s.final) : cierre?.saldoBanco !== undefined ? eur(cierre.saldoBanco) : "—"} n={s ? "según el extracto" : cierre ? "indicado al cerrar" : "se indica al cerrar"} />
          <Kpi t="Justificantes" v={`${movs.filter((m) => m.importe < 0).length - faltanJust} de ${movs.filter((m) => m.importe < 0).length}`} n={faltanJust ? `faltan ${faltanJust}` : "todos los cargos tienen el suyo"} tono={faltanJust ? "aviso" : "bien"} onClick={() => setSoloFaltan(true)} />
          <Kpi t="Cuadrados" v={`${c.conciliados} de ${c.nMov}`} n={c.sinDoc ? `${c.sinDoc} sin documento` : "todos con documento"} tono={c.sinDoc ? "aviso" : "bien"} />
        </div>
        <p className="pequeño">Saldo de bancos en la contabilidad (cuenta 572) al {fechaBonita(r.hasta)}: <strong>{eur(contable)}</strong>
          {(s || cierre?.saldoBanco !== undefined) && (() => { const b = s ? s.final : cierre.saldoBanco; const dif = Math.round((contable - b) * 100) / 100; return Math.abs(dif) < 0.01 ? <span className="ok"> · cuadra con el banco</span> : <span className="pend"> · diferencia con el banco {eur(dif)} {Math.abs(contable) < 0.01 || !todos.some((a) => a.origen === "manual" && /apertura|saldo inicial/i.test(a.concepto)) ? "(¿falta el asiento de apertura con el saldo inicial del banco?)" : ""}</span>; })()}</p>
        {cierre?.notas && <p className="muted pequeño">Notas del cierre: {cierre.notas}</p>}
        {trimestresAbiertos.length > 0 && <p className="pend pequeño">Para cerrar el año conviene cerrar antes los trimestres: faltan {trimestresAbiertos.map((t) => t + "T").join(", ")}.</p>}
        <div className="acciones">
          {!cierre || cambiado
            ? <button className="btn" type="button" disabled={!movs.length} onClick={() => setDialogo(true)}>{cierre ? "Volver a cerrar" : `Cerrar ${r.corta}`}</button>
            : <button className="btn ghost" type="button" onClick={async () => { if (!window.confirm(`¿Reabrir el extracto de ${r.etiqueta}?`)) return; const n = { ...cierres }; delete n[claveCierre(r)]; await guardarCierres(n); aviso?.("Periodo reabierto"); }}>Reabrir</button>}
          {c.sinDoc > 0 && <button className="btn ghost" type="button" onClick={() => irA("libros", "aplicar")}>Cuadrar los {c.sinDoc} sin documento</button>}
        </div>
      </section>

      {!movs.length ? <div className="vacio"><p>No hay movimientos del banco en {r.etiqueta}.</p><p className="muted">Deja los extractos en la subcarpeta <code>extractos</code> o los justificantes en <code>documentos_banco</code>.</p></div> : (
        <div className="tabla-scroll"><table className="tabla">
          <thead><tr><th>Fecha</th><th>Concepto</th><th className="num">Importe</th>{s && <th className="num">Saldo</th>}<th>Documento</th><th>Justificante del banco <label className="check pequeño"><input type="checkbox" checked={soloFaltan} onChange={(e) => setSoloFaltan(e.target.checked)} /> solo los que faltan</label></th></tr></thead>
          <tbody>{movs.filter((m) => !soloFaltan || (m.importe < 0 && !m._justificante)).map((m) => { const a = docDe.get(m._id); return (
            <tr key={m._id}><td>{m.fecha}</td><td>{m.concepto}</td><td className={"num " + (m.importe < 0 ? "neg" : "pos")}>{eur(m.importe)}</td>{s && <td className="num">{m.saldo !== undefined ? eur(m.saldo) : ""}</td>}
              <td>{m._factura ? <span className="ok">{m._factura}</span> : m._emitida ? <span className="ok">{m._emitida}</span> : a ? (a.origen === "banco-tercero" ? <button type="button" className="aviso-btn" title="El pago está apuntado al proveedor, pero falta su factura en la carpeta «facturas»" onClick={() => irA("facturas")}>falta la factura · {String(a.concepto).replace(/^Pago a |^Cobro de | \(a falta de factura\)$/g, "")} ›</button> : a.doc ? <span className="ok">{a.doc}</span> : <span className="muted pequeño">{a.concepto}</span>) : pendIds.has(m._id) ? <button type="button" className="aviso-btn" onClick={() => irA("libros", "aplicar")}>sin documento ›</button> : ""}</td>
              <td>{m._justificante?.no ? <span className="muted pequeño">no necesita</span> : m._justificante ? <button className="enlace" type="button" onClick={() => verJust(m._justificante.nombre)} title={m._justificante.extracto ? "Cargo sin documento propio: lo justifica el extracto mensual del banco" : ""}>📄 {m._justificante.extracto ? "en el extracto: " : ""}{m._justificante.nombre}</button> : m.importe < 0 ? <button type="button" className="aviso-btn" onClick={() => setJust(m)}>falta · asociar ›</button> : ""}
                {m._justificante && <button className="enlace pequeño" type="button" onClick={() => setJust(m)}> cambiar</button>}</td></tr>); })}</tbody>
        </table></div>
      )}

      {just && <DialogoJustificante m={just} d={d} raiz={raiz} onCerrar={() => setJust(null)} hecho={() => { setJust(null); recargar?.(); aviso?.("Justificante asociado"); }} />}
      {dialogo && <DialogoCierre r={r} c={c} s={s} contable={contable} huellaAhora={huellaAhora} onCerrar={() => setDialogo(false)}
        guardar={async (datos) => { await guardarCierres({ ...cierres, [claveCierre(r)]: datos }); setDialogo(false); aviso?.(`Extracto de ${r.etiqueta} cerrado`); }} />}
    </div>
  );
}

function DialogoJustificante({ m, d, raiz, onCerrar, hecho }) {
  const imp = Math.abs(m.importe);
  const usados = new Set(d.movimientos.filter((x) => x !== m && x._justificante?.nombre).map((x) => x._justificante.nombre));
  const lista = (d.justificantes || []).filter((j) => !usados.has(j.nombre)).map((j) => ({ ...j, cerca: Math.min(...[j.importe, ...j.enNombre].filter(Boolean).map((v) => Math.abs(v - imp)), 1e9) })).sort((a, b) => a.cerca - b.cerca);
  const [sel, setSel] = useState(lista[0]?.cerca < 0.011 ? lista[0].nombre : "");
  const asociar = async (n) => { await guardarJustificante(raiz, m, n); hecho(); };
  return (
    <div className="mc-fondo" role="dialog" aria-modal="true" aria-labelledby="ju-t">
      <div className="mc-dialogo">
        <header><h2 id="ju-t">Justificante del cargo</h2><button className="mc-x" onClick={onCerrar} aria-label="Cerrar">×</button></header>
        <div className="mc-cuerpo">
          <p className="mc-nota">{m.fecha} · {m.concepto} · {eur(m.importe)}</p>
          <p className="pequeño">Es el documento individual del banco para este cargo (adeudo del recibo, orden de transferencia, cargo de tarjeta). Se descarga de la banca online y se guarda en la carpeta «documentos_banco».</p>
          {lista.length > 0 && <label className="mc-campo"><span>Elegir de «documentos_banco»</span><select value={sel} onChange={(e) => setSel(e.target.value)}><option value="">—</option>{lista.map((j) => <option key={j.nombre} value={j.nombre}>{j.cerca < 0.011 ? "✓ " : ""}{j.nombre}</option>)}</select></label>}
          <label className="btn ghost">Subir el justificante<input type="file" hidden accept=".pdf,image/*" onChange={async (e) => { const f = e.target.files[0]; e.target.value = ""; if (!f) return; const [n] = await subir(raiz, "documentos_banco", [f]); await asociar(n); }} /></label>
        </div>
        <footer>
          <button className="mc-btn sec" onClick={() => asociar("__no__")}>No necesita (comisión, tarjeta…)</button>
          {m._justificante && <button className="mc-btn sec" onClick={() => asociar(null)}>Quitar</button>}
          <button className="mc-btn" disabled={!sel} onClick={() => asociar(sel)}>Asociar</button>
        </footer>
      </div>
    </div>
  );
}

function DialogoCierre({ r, c, s, contable, huellaAhora, guardar, onCerrar }) {
  const [saldoBanco, setSaldoBanco] = useState(s ? String(s.final).replace(".", ",") : "");
  const [notas, setNotas] = useState("");
  const [igual, setIgual] = useState(false);
  const pendiente = c.sinDoc > 0;
  const ok = (!pendiente || igual) && (s || saldoBanco.trim());
  return (
    <div className="mc-fondo" role="dialog" aria-modal="true" aria-labelledby="ci-t">
      <div className="mc-dialogo">
        <header><h2 id="ci-t">Cerrar el extracto · {r.etiqueta}</h2><button className="mc-x" onClick={onCerrar} aria-label="Cerrar">×</button></header>
        <div className="mc-cuerpo">
          <p>Al cerrar se guarda en la carpeta de la empresa una foto del extracto de este periodo (número de movimientos, entradas, salidas, saldo y una huella digital). Si después entra o cambia algún movimiento de este periodo, la app avisará.</p>
          <ul className="pequeño">
            <li>{c.nMov} movimientos · entradas {eur(c.entradas)} · salidas {eur(c.salidas)}</li>
            <li>{c.conciliados} con documento · <span className={pendiente ? "pend" : "ok"}>{c.sinDoc} sin documento</span></li>
            <li>Saldo de bancos en contabilidad: {eur(contable)}</li>
          </ul>
          <label className="mc-campo"><span>Saldo final según el banco a {fechaBonita(r.hasta)}{s ? " (del extracto)" : ""}</span>
            <input value={saldoBanco} onChange={(e) => setSaldoBanco(e.target.value)} placeholder="p. ej. 12.345,67" inputMode="decimal" /></label>
          <label className="mc-campo"><span>Notas (opcional)</span><input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="p. ej. falta la factura de la notaría de marzo" /></label>
          {pendiente && <label className="check"><input type="checkbox" checked={igual} onChange={(e) => setIgual(e.target.checked)} /> Cerrar igualmente con {c.sinDoc} movimientos sin documento (quedarán en «partidas pendientes de aplicación», 555)</label>}
        </div>
        <footer>
          <button className="mc-btn sec" onClick={onCerrar}>Cancelar</button>
          <button className="mc-btn" disabled={!ok} onClick={() => guardar({
            fecha: new Date().toISOString(), por: (espacioActual() || "").split("|")[0], desde: r.desde, hasta: r.hasta,
            nMov: c.nMov, entradas: c.entradas, salidas: c.salidas, sinDocumento: c.sinDoc,
            saldoBanco: saldoBanco.trim() ? num(saldoBanco) : undefined, saldoContable: contable, notas: notas.trim(), huella: huellaAhora,
          })}>Cerrar el periodo</button>
        </footer>
      </div>
    </div>
  );
}
