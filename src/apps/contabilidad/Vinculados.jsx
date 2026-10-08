// Escrituras, contratos y préstamos: se eligen de las carpetas de la empresa (sin duplicarlos) y se les ponen los datos contables.
import { useEffect, useState } from "react";
import { TIPOS_VINCULO, PERIODOS, leerVinculados, guardarVinculados, abrirVinculado, vencimientos, eur, num } from "./datos.js";
import { QUE_VA } from "../../lib/carpetas.js";
import { revisarCarpeta, leerInventario } from "./inventario.js";

function Selector({ empresa, onElegir, onCerrar }) {
  const [ruta, setRuta] = useState([]);
  const [items, setItems] = useState([]);
  useEffect(() => { (async () => {
    let d = empresa; for (const p of ruta) d = await d.getDirectoryHandle(p);
    const out = [];
    for await (const [n, h] of d.entries()) if (!n.startsWith(".") && !n.startsWith("~$") && n !== "programa") out.push({ n, dir: h.kind === "directory" });
    out.sort((a, b) => (a.dir === b.dir ? a.n.localeCompare(b.n, "es") : a.dir ? -1 : 1)); setItems(out);
  })(); }, [ruta]);
  return (
    <div className="mc-fondo" role="dialog" aria-modal="true">
      <div className="mc-dialogo">
        <header><h2>Elegir documento</h2><button className="mc-x" onClick={onCerrar} aria-label="Cerrar">×</button></header>
        <div className="mc-cuerpo">
          <nav className="migas"><button className="enlace" type="button" onClick={() => setRuta([])}>{empresa.name}</button>{ruta.map((p, i) => <span key={i}> › <button className="enlace" type="button" onClick={() => setRuta(ruta.slice(0, i + 1))}>{p}</button></span>)}</nav>
          {ruta.length === 1 && QUE_VA[ruta[0]] && <p className="mc-nota">{QUE_VA[ruta[0]]}</p>}
          <ul className="lista-docs">{items.map((it) => <li key={it.n}>{it.dir
            ? <button className="enlace carpeta-item" type="button" onClick={() => setRuta([...ruta, it.n])}>📁 {it.n}</button>
            : <button className="enlace" type="button" onClick={() => onElegir(ruta, it.n)}>{it.n}</button>}</li>)}</ul>
        </div>
      </div>
    </div>
  );
}

export default function Vinculados({ raiz, empresa, movimientos, aviso, onCambio, propia, revisionAuto }) {
  const [inv, setInv] = useState(null);
  const [revisando, setRevisando] = useState("");
  const [ultimos, setUltimos] = useState(null);
  useEffect(() => { leerInventario(raiz).then(setInv); }, [revisionAuto]);
  const revisar = async () => {
    setRevisando("Recorriendo las carpetas…");
    try {
      const r = await revisarCarpeta({ empresa, raiz, propia, onPaso: setRevisando });
      setUltimos(r); setInv(r.inventario); await cargar(); if (r.vinculados) onCambio?.();
      aviso?.(r.nuevos.length ? `${r.nuevos.length} documentos nuevos o cambiados · ${r.vinculados} vinculados a la contabilidad` : "No hay documentos nuevos");
    } catch { aviso?.("No se ha podido recorrer la carpeta de la empresa"); }
    setRevisando("");
  };
  const [lista, setLista] = useState([]);
  const [elegir, setElegir] = useState(false);
  const [edit, setEdit] = useState(null);
  const cargar = async () => setLista(await leerVinculados(raiz));
  useEffect(() => { cargar(); }, [revisionAuto]);
  const guardar = async (v) => {
    const nueva = lista.some((x) => x.id === v.id) ? lista.map((x) => (x.id === v.id ? v : x)) : [...lista, v];
    await guardarVinculados(raiz, nueva.map((x) => (x.id === v.id ? { ...x, revisado: true } : x))); setLista(nueva.map((x) => (x.id === v.id ? { ...x, revisado: true } : x))); setEdit(null); aviso?.("Guardado y revisado"); onCambio?.();
  };
  const quitar = async (v) => { if (!window.confirm("¿Quitar el vínculo? El documento sigue en su carpeta.")) return; const n = lista.filter((x) => x.id !== v.id); await guardarVinculados(raiz, n); setLista(n); onCambio?.(); };
  const t = edit && TIPOS_VINCULO[edit.tipo];

  return (
    <div>
      <section className="tarjeta inventario">
        <div className="cierre-cab">
          <h3>La app lee la carpeta de la empresa</h3>
          <button className="btn" type="button" disabled={!!revisando} onClick={revisar}>{revisando ? "Revisando…" : "Revisar ahora"}</button>
        </div>
        <p className="pequeño">Recorre todas las carpetas (001 corporate, 002, 003…), guarda un registro de lo que hay y solo lee con la IA lo nuevo o lo que ha cambiado. Las escrituras, préstamos, compraventas y contratos con pagos se vinculan solos a la contabilidad; revisa los marcados «IA».</p>
        {revisando ? <p className="pend pequeño">{revisando}</p> : inv?.actualizado ? <p className="muted pequeño">Última revisión: {new Date(inv.actualizado).toLocaleString("es-ES")} · {inv.total} documentos · {Object.values(inv.docs).filter((x) => x.estado === "vinculado").length} con efecto contable · {Object.values(inv.docs).filter((x) => x.estado === "sin efecto contable").length} sin efecto contable · {Object.values(inv.docs).filter((x) => x.estado === "sin clasificar").length} sin clasificar</p> : <p className="muted pequeño">Aún no se ha revisado.</p>}
        {ultimos?.nuevos?.length > 0 && <details open><summary className="pequeño">{ultimos.nuevos.length} nuevos o cambiados en esta revisión</summary><ul className="pequeño">{ultimos.nuevos.slice(0, 40).map((d) => { const x = ultimos.inventario.docs[d.k]; return <li key={d.k}>{d.ruta.join(" › ")} › <strong>{d.nombre}</strong> — {x?.estado}{x?.resumen ? `: ${x.resumen}` : ""}</li>; })}</ul></details>}
        {inv?.docs && Object.values(inv.docs).some((x) => x.estado === "sin clasificar") && <details><summary className="pequeño">Documentos sin clasificar</summary><ul className="pequeño">{Object.entries(inv.docs).filter(([, x]) => x.estado === "sin clasificar").slice(0, 60).map(([k, x]) => <li key={k}>{x.ruta.join(" › ")} › {x.nombre} <button className="enlace" type="button" onClick={() => setEdit({ id: crypto.randomUUID(), ruta: x.ruta, archivo: x.nombre, tipo: "otro", fecha: "", importe: "", periodicidad: "mensual", inicio: "", fin: "", tercero: "", cuenta: "", notas: "" })}>vincular</button></li>)}</ul></details>}
      </section>
      <div className="acciones cont-barra">
        <button className="btn ghost" type="button" onClick={() => setElegir(true)}>+ Añadir uno a mano</button>
      </div>
      {lista.length === 0 ? <div className="vacio"><p>Aún no hay documentos vinculados.</p><p className="muted">Por ejemplo: la escritura de ampliación de capital, un contrato con pago mensual o un préstamo.</p></div> : (
        <div className="tabla-scroll"><table className="tabla">
          <thead><tr><th>Tipo</th><th>Documento</th><th>Fecha</th><th className="num">Importe</th><th>Cuenta</th><th>Situación</th><th></th></tr></thead>
          <tbody>{lista.map((v) => {
            const tv = TIPOS_VINCULO[v.tipo] || TIPOS_VINCULO.otro;
            const ven = vencimientos(v, movimientos);
            const pend = ven.filter((x) => !x.mov).length;
            return (
              <tr key={v.id}>
                <td>{tv.nombre}{v.propuestoIA && !v.revisado && <span className="etq aviso" title={`Leído por ${v.ia || "la IA"}: revisa los datos y guarda`}>IA · revisar</span>}{tv.periodico && <div className="muted pequeño">{v.periodicidad} · desde {v.inicio}{v.fin ? ` hasta ${v.fin}` : ""}</div>}</td>
                <td><button className="enlace" type="button" onClick={() => abrirVinculado(empresa, v).catch(() => aviso?.("No encuentro el archivo: ¿se ha movido?"))}>{v.archivo}</button><div className="muted pequeño">{v.ruta.join(" › ")}</div></td>
                <td>{v.fecha || v.inicio}</td><td className="num">{eur(v.importe)}{tv.periodico ? "/cuota" : ""}</td><td>{v.cuenta || tv.cuenta}</td>
                <td>{tv.periodico ? (ven.length ? (pend ? <span className="pend">{pend} de {ven.length} cuotas sin localizar en el banco</span> : <span className="ok">{ven.length} cuotas al día</span>) : "—") : ""}</td>
                <td className="acciones"><button className="enlace" type="button" onClick={() => setEdit({ ...v })}>Editar</button><button className="enlace" type="button" onClick={() => quitar(v)}>Quitar</button></td>
              </tr>);
          })}</tbody>
        </table></div>
      )}

      {elegir && <Selector empresa={empresa} onCerrar={() => setElegir(false)} onElegir={(ruta, archivo) => { setElegir(false); setEdit({ id: crypto.randomUUID(), ruta, archivo, tipo: /capital|ampliac/i.test(archivo) ? "ampliacion" : /prestamo|préstamo/i.test(archivo) ? "prestamo_recibido" : /arras/i.test(archivo) ? "arras" : "contrato_pago", fecha: "", importe: "", periodicidad: "mensual", inicio: "", fin: "", tercero: "", cuenta: "", notas: "" }); }} />}

      {edit && (
        <div className="mc-fondo" role="dialog" aria-modal="true">
          <div className="mc-dialogo">
            <header><h2>Datos contables del documento</h2><button className="mc-x" onClick={() => setEdit(null)} aria-label="Cerrar">×</button></header>
            <div className="mc-cuerpo">
              <p className="mc-nota">{edit.ruta.join(" › ")} › <strong>{edit.archivo}</strong> · <button className="enlace" type="button" onClick={() => abrirVinculado(empresa, edit).catch(() => {})}>ver el documento</button></p>
              {edit.propuestoIA && !edit.revisado && <p className="mc-nota">Datos propuestos por {edit.ia || "la IA"}{edit.notas ? `: «${edit.notas}»` : ""}. Compruébalos con el documento antes de confirmar.</p>}
              <label className="mc-campo"><span>Tipo</span><select value={edit.tipo} onChange={(e) => setEdit({ ...edit, tipo: e.target.value })}>{Object.entries(TIPOS_VINCULO).map(([k, x]) => <option key={k} value={k}>{x.nombre}</option>)}</select></label>
              <div className="rejilla-edit">
                <label className="mc-campo"><span>{t?.periodico ? "Importe de cada cuota (€)" : "Importe (€)"}</span><input value={edit.importe} onChange={(e) => setEdit({ ...edit, importe: e.target.value })} /></label>
                <label className="mc-campo"><span>Tercero (socio, banco, proveedor…)</span><input value={edit.tercero} onChange={(e) => setEdit({ ...edit, tercero: e.target.value })} /></label>
                {t?.periodico ? <>
                  <label className="mc-campo"><span>Periodicidad</span><select value={edit.periodicidad} onChange={(e) => setEdit({ ...edit, periodicidad: e.target.value })}>{Object.keys(PERIODOS).map((p) => <option key={p}>{p}</option>)}</select></label>
                  <label className="mc-campo"><span>Primer pago (dd/mm/aaaa)</span><input value={edit.inicio} onChange={(e) => setEdit({ ...edit, inicio: e.target.value })} placeholder="01/01/2026" /></label>
                  <label className="mc-campo"><span>Último pago (opcional)</span><input value={edit.fin} onChange={(e) => setEdit({ ...edit, fin: e.target.value })} /></label>
                </> : <label className="mc-campo"><span>Fecha (dd/mm/aaaa)</span><input value={edit.fecha} onChange={(e) => setEdit({ ...edit, fecha: e.target.value })} /></label>}
                <label className="mc-campo"><span>Cuenta PGC</span><input value={edit.cuenta} placeholder={t?.cuenta} onChange={(e) => setEdit({ ...edit, cuenta: e.target.value })} /></label>
              </div>
              <label className="mc-campo"><span>Notas</span><input value={edit.notas} onChange={(e) => setEdit({ ...edit, notas: e.target.value })} /></label>
            </div>
            <footer><button className="mc-btn sec" onClick={() => setEdit(null)}>Cancelar</button><button className="mc-btn" disabled={!num(edit.importe)} onClick={() => guardar(edit)}>{edit.propuestoIA && !edit.revisado ? "Confirmar y guardar" : "Guardar"}</button></footer>
          </div>
        </div>
      )}
    </div>
  );
}
