// Resumen por trimestre y año (impuestos y pendientes) y cierre del extracto del banco.
import { useEffect, useMemo, useState } from "react";
import { TRAMOS, rango, cifras, porGestionar, plazos, fechaBonita, huella, saldosExtracto, saldo572, claveCierre, enRango } from "./periodo.js";
import { eur, num, fechaOrden } from "./datos.js";
import { espacioActual } from "../../lib/espacio.js";

export function SelPeriodo({ anio, tramo, cambiar, cierres = {} }) {
  const hoy = new Date().getFullYear();
  return (
    <div className="sel-periodo" role="group" aria-label="Periodo">
      <select value={anio} onChange={(e) => cambiar(+e.target.value, tramo)} aria-label="Año">{[hoy - 3, hoy - 2, hoy - 1, hoy, hoy + 1].map((a) => <option key={a}>{a}</option>)}</select>
      {TRAMOS.map(([k, t]) => <button key={k} type="button" className={tramo === k ? "on" : ""} onClick={() => cambiar(anio, k)}>{t}{cierres[`${anio}-${k}`] && <span className="candado" title="Extracto cerrado">✓</span>}</button>)}
    </div>
  );
}

const Kpi = ({ t, v, n, tono }) => <div className={"kpi " + (tono || "")}><span>{t}</span><strong>{v}</strong>{n && <small>{n}</small>}</div>;
const signoIVA = (v) => (v > 0.005 ? "a ingresar" : v < -0.005 ? "a compensar / devolver" : "sin cuota");

export function ResumenPeriodo({ d, todos, pendientes, vinculados, r, cambiar, cierres, irA }) {
  const c = useMemo(() => cifras(todos, d.movimientos, pendientes, r), [todos, d, pendientes, r]);
  const lista = useMemo(() => porGestionar(d, todos, pendientes, vinculados, r), [d, todos, pendientes, vinculados, r]);
  const columnas = useMemo(() => TRAMOS.map(([k, t]) => { const rr = rango(r.anio, k); return { k, t, rr, c: cifras(todos, d.movimientos, pendientes, rr), n: porGestionar(d, todos, pendientes, vinculados, rr).reduce((s, x) => s + x.items.length, 0) }; }), [todos, d, pendientes, vinculados, r.anio]);
  const P = plazos(r);
  const totalPend = lista.reduce((s, x) => s + x.items.length, 0);
  const sinEmitidas = c.ivaRep === 0 && c.ingresos > 0;

  const filas = [
    ["Ingresos", (x) => eur(x.ingresos)], ["Gastos", (x) => eur(x.gastos)], ["Resultado antes de impuestos", (x) => eur(x.resultado), "total"],
    ["IVA repercutido (477)", (x) => eur(x.ivaRep)], ["IVA soportado (472)", (x) => eur(x.ivaSop)], ["Resultado IVA (303 / 390)", (x) => eur(x.iva303), "total"],
    ["Retenciones profesionales y nóminas (111)", (x) => eur(x.ret111)], ["Retenciones de alquileres (115)", (x) => eur(x.ret115)],
    ["Banco: entradas", (x) => eur(x.entradas)], ["Banco: salidas", (x) => eur(x.salidas)],
    ["Movimientos sin documento", (x) => x.sinDoc || "—"],
  ];

  return (
    <div className="cont-resumen">
      <div className="kpis">
        <Kpi t={`Resultado ${r.corta}`} v={eur(c.resultado)} n={`Ingresos ${eur(c.ingresos)} · Gastos ${eur(c.gastos)}`} />
        <Kpi t={`IVA (modelo ${P.iva.modelo})`} v={eur(c.iva303)} n={`${signoIVA(c.iva303)} · plazo ${fechaBonita(P.iva.fecha)}`} tono={c.iva303 > 0 ? "aviso" : ""} />
        <Kpi t={`Retenciones (${P.ret.modelo})`} v={eur(c.ret111 + c.ret115)} n={`111: ${eur(c.ret111)} · 115: ${eur(c.ret115)}`} />
        <Kpi t="Por gestionar" v={totalPend} n={totalPend ? "ver la lista de abajo" : "todo en orden"} tono={totalPend ? "aviso" : "bien"} />
      </div>

      <section className="tarjeta">
        <h2>{r.anio} por trimestres</h2>
        <div className="tabla-scroll"><table className="tabla trimestres">
          <thead><tr><th></th>{columnas.map((x) => <th key={x.k} className={"num " + (x.k === r.tramo ? "sel" : "")}><button className="enlace" type="button" onClick={() => cambiar(r.anio, x.k)}>{x.t}</button></th>)}</tr></thead>
          <tbody>
            {filas.map(([t, f, cl]) => <tr key={t} className={cl || ""}><td>{t}</td>{columnas.map((x) => <td key={x.k} className={"num " + (x.k === r.tramo ? "sel" : "")}>{f(x.c)}</td>)}</tr>)}
            <tr><td>Por gestionar</td>{columnas.map((x) => <td key={x.k} className={"num " + (x.k === r.tramo ? "sel" : "")}>{x.n ? <span className="pend">{x.n}</span> : <span className="ok">✓</span>}</td>)}</tr>
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
          <tr><td><strong>Sociedades</strong>{P.is ? <> · modelo {P.is.modelo}</> : ""}</td><td>Resultado acumulado del 1 de enero al {fechaBonita(r.hasta)}: {eur(c.acumulado)}</td><td className="num"><strong>{eur(c.isEstimado)}</strong> <small className="muted">estimación al 25 %</small></td><td>{P.is ? `plazo ${fechaBonita(P.is.fecha)}` : "sin pago fraccionado este trimestre"}</td></tr>
        </tbody></table>
        <p className="muted pequeño">Cifras orientativas sacadas de la contabilidad. El tipo del Impuesto sobre Sociedades depende de la empresa (nueva creación, microempresa…) y los pagos fraccionados no siempre son obligatorios: lo confirma la gestoría.{sinEmitidas && " Hay ingresos sin IVA repercutido: si emites facturas con IVA, regístralas (asiento manual o «¿Dónde va?») para que salgan en el 303."}{c.descuadrados > 0 && <span className="pend"> Hay {c.descuadrados} asientos descuadrados que pueden alterar estas cifras.</span>}</p>
      </section>

      <section className="tarjeta">
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
    </div>
  );
}

// ---- Banco del periodo con cierre del extracto ----
export function BancoPeriodo({ d, todos, pendientes, r, cierres, guardarCierres, irA, aviso }) {
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
          <thead><tr><th>Fecha</th><th>Concepto</th><th className="num">Importe</th>{s && <th className="num">Saldo</th>}<th>Documento</th></tr></thead>
          <tbody>{movs.map((m) => { const a = docDe.get(m._id); return (
            <tr key={m._id}><td>{m.fecha}</td><td>{m.concepto}</td><td className={"num " + (m.importe < 0 ? "neg" : "pos")}>{eur(m.importe)}</td>{s && <td className="num">{m.saldo !== undefined ? eur(m.saldo) : ""}</td>}
              <td>{m._factura ? <span className="ok">{m._factura}</span> : a ? <span className="ok">{a.doc || a.concepto}</span> : pendIds.has(m._id) ? <span className="pend">sin documento</span> : ""}</td></tr>); })}</tbody>
        </table></div>
      )}

      {dialogo && <DialogoCierre r={r} c={c} s={s} contable={contable} huellaAhora={huellaAhora} onCerrar={() => setDialogo(false)}
        guardar={async (datos) => { await guardarCierres({ ...cierres, [claveCierre(r)]: datos }); setDialogo(false); aviso?.(`Extracto de ${r.etiqueta} cerrado`); }} />}
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
