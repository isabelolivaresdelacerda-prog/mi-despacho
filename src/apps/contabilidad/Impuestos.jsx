// Impuestos: lo calculado por la contabilidad, lo presentado (con su justificante) y lo pagado en el banco.
// Detecta solos los pagos a Hacienda del extracto y los PDF de la carpeta «impuestos».
import { useEffect, useMemo, useState } from "react";
import { modelosDelAnio, proponerPagos, leerNombreImpuesto, casillas, cifras, fechaBonita, NOMBRE_MODELO, claveModelo, rango } from "./periodo.js";
import { claveMov } from "./motor.js";
import { casillas303, casillas111, cuentasEmpresa, ibanBonito, ENLACE_AEAT } from "./hacienda.js";
import { eur, num, listar, abrir, subir, csv, descargarTexto, fechaOrden } from "./datos.js";

const RESULTADOS = [["ingresar", "A ingresar"], ["devolver", "A devolver"], ["compensar", "A compensar"], ["cero", "Sin actividad / cero"], ["informativa", "Declaración informativa"]];
const hoyISO = () => new Date().toISOString().slice(0, 10);

// Marca o desmarca en el calendario el aviso del modelo
export function sincronizarCalendario(presentados, modelos) {
  try {
    const h = JSON.parse(localStorage.getItem("md-cal-hechos") || "{}");
    for (const m of modelos) if (m.idCal && presentados[m.clave]) h[m.idCal] = true;
    localStorage.setItem("md-cal-hechos", JSON.stringify(h));
  } catch { /* nada */ }
}

export default function Impuestos({ raiz, d, todos, pendientes, anio, cambiarAnio, anios, presentados, guardar, otros = [], guardarOtros, opciones, aviso, config }) {
  const [prep, setPrep] = useState(null); // modelo que se prepara para Hacienda
  const modelos = useMemo(() => modelosDelAnio(anio, todos, d, pendientes, opciones), [anio, todos, d, pendientes, opciones]);
  const [docs, setDocs] = useState([]);
  const [dlg, setDlg] = useState(null);
  const cargarDocs = async () => setDocs(await listar(raiz, "impuestos"));
  useEffect(() => { cargarDocs(); }, [raiz]);
  useEffect(() => { sincronizarCalendario(presentados, modelos); }, [presentados, modelos]);

  const props = useMemo(() => proponerPagos(modelos, d.movimientos, presentados).filter((p) => p.modelo), [modelos, d, presentados]);
  const usadosDocs = new Set(Object.values(presentados).map((p) => p.archivo).filter(Boolean));
  const docsProp = docs.filter((x) => !usadosDocs.has(x.nombre)).map((x) => ({ x, info: leerNombreImpuesto(x.nombre) })).filter((p) => p.info && (!p.info.anio || p.info.anio === anio))
    .map((p) => ({ ...p, modelo: modelos.find((m) => m.modelo === p.info.modelo && (p.info.tramo ? m.tramo === p.info.tramo : true) && !presentados[m.clave]) })).filter((p) => p.modelo);

  // Pago en el banco de un modelo presentado
  const pagoDe = (m) => {
    const p = presentados[m.clave]; if (!p) return null;
    if (p.mov) return d.movimientos.find((x) => claveMov(x) === p.mov) || null;
    const a = todos.find((x) => x.origen === "impuesto" && x.concepto === `Pago modelo ${m.modelo} ${m.etiqueta}`);
    return a ? d.movimientos.find((x) => x._id === a.mov) : null;
  };

  const registrar = async (m, datos) => {
    const n = { ...presentados, [m.clave]: { modelo: m.modelo, anio: m.anio, tramo: m.tramo, ...datos, ...(m.modelo === "303" ? { ivaRep: m.ivaRep, ivaSop: m.ivaSop } : {}), registrado: new Date().toISOString() } };
    await guardar(n); setDlg(null); aviso?.(`Modelo ${m.modelo} ${m.etiqueta} registrado como presentado`);
  };
  const quitar = async (m) => { if (!window.confirm(`¿Quitar el registro del modelo ${m.modelo} ${m.etiqueta}?`)) return; const n = { ...presentados }; delete n[m.clave]; await guardar(n); };

  // Leer los PDF de la AEAT de la carpeta «impuestos» y dejarlos registrados como presentados (con sus casillas)
  const [leyendoDecl, setLeyendoDecl] = useState(false);
  const leerDeclaraciones = async () => {
    setLeyendoDecl(true);
    try {
      const { textoPDF } = await import("./leer.js"); const { leerDeclaracion } = await import("./declaraciones.js");
      const n = { ...presentados }; let k = 0; const raros = [];
      for (const x of docs.filter((y) => /\.pdf$/i.test(y.nombre))) {
        const t = await textoPDF(await x.h.getFile(), 8, { ocr: false });
        const dcl = leerDeclaracion(t);
        if (!dcl || !dcl.anio || !dcl.tramo) { raros.push(x.nombre); continue; }
        const clave = claveModelo(dcl.anio, dcl.tramo === "0A" ? "anio" : dcl.tramo, dcl.modelo);
        n[clave] = { ...(n[clave] || {}), modelo: dcl.modelo, anio: dcl.anio, tramo: dcl.tramo, fecha: dcl.fecha, importe: dcl.importe, justificante: dcl.justificante, resultado: dcl.resultado, archivo: x.nombre, casillas: dcl.casillas, ...(dcl.modelo === "303" ? { ivaRep: dcl.ivaRep, ivaSop: dcl.ivaSop, baseSop: dcl.baseSop, declarado: true } : {}), leidoDelPDF: true, registrado: new Date().toISOString() };
        k++;
      }
      await guardar(n); aviso?.(`${k} declaraciones leídas de la carpeta «impuestos»${raros.length ? ` · sin reconocer: ${raros.join(", ")}` : ""}`);
    } catch (e) { aviso?.("No se han podido leer: " + (e.message || e)); } finally { setLeyendoDecl(false); }
  };

  const exportar = () => {
    const filas = [["Modelo", "Periodo", "Casilla", "Concepto", "Importe", "Presentado", "Fecha presentación", "Resultado", "Importe presentado", "Justificante", "Pagado en banco"]];
    for (const m of modelos) {
      const c = cifras(todos, d.movimientos, pendientes, m.r, d), p = presentados[m.clave], pg = pagoDe(m);
      for (const [cas, t, v] of casillas(m, c)) filas.push([m.modelo, m.etiqueta, cas, t, v, p ? "Sí" : "No", p?.fecha ? fechaBonita(p.fecha) : "", p?.resultado || "", p ? num(p.importe) : "", p?.justificante || "", pg ? `${pg.fecha} ${eur(pg.importe)}` : ""]);
    }
    descargarTexto(csv(filas), `Impuestos ${anio}.csv`);
  };

  const estado = (m) => {
    const p = presentados[m.clave];
    if (p) {
      const necesitaPago = p.resultado === "ingresar" && num(p.importe) > 0;
      const pg = necesitaPago ? pagoDe(m) : null;
      if (!necesitaPago) return ["ok", "✓ Presentado"];
      if (p.domiciliado && !pg) return ["ok", "✓ Presentado · domiciliado (aún no en el banco)"];
      return pg ? ["ok", `✓ Presentado y pagado el ${pg.fecha}`] : ["pend", "Presentado · falta ver el pago en el banco"];
    }
    if (m.plazo < hoyISO()) return ["error", "Vencido sin registrar"];
    if (m.r.hasta < hoyISO()) return ["pend", "Pendiente de presentar"];
    return ["muted", "Periodo en curso"];
  };

  const grupos = [["1", "1º trimestre"], ["2", "2º trimestre"], ["3", "3º trimestre"], ["4", "4º trimestre"], ["anio", `Resúmenes anuales e Impuesto sobre Sociedades de ${anio}`]];

  return (
    <div>
      <div className="acciones cont-barra">
        <label className="anio-sel">Año <select value={anio} onChange={(e) => cambiarAnio(+e.target.value)}>{anios.map((a) => <option key={a}>{a}</option>)}</select></label>
        <button className="btn ghost" type="button" onClick={exportar}>Exportar impuestos del año (Excel)</button>
        <label className="btn ghost">Subir justificantes<input type="file" multiple hidden accept=".pdf,image/*" onChange={async (e) => { const f = [...e.target.files]; e.target.value = ""; if (f.length) { await subir(raiz, "impuestos", f); cargarDocs(); aviso?.("Guardado en la carpeta «impuestos»"); } }} /></label>
      </div>
      <p className="muted pequeño">Aquí se apunta cada impuesto que se presenta (lo hagas tú o la gestoría): fecha, resultado, importe y el PDF del justificante, que se guarda en la carpeta «impuestos». Al registrarlo desaparece el aviso del calendario, y el pago se busca solo en el banco. Al registrar el IVA se hace el asiento de liquidación (472/477 contra 4750 o 4700).</p>

      {(props.length > 0 || docsProp.length > 0) && (
        <section className="tarjeta detectado">
          <h3>Encontrado en el banco y en la carpeta «impuestos»</h3>
          <table className="tabla"><tbody>
            {props.map((p, i) => (
              <tr key={"p" + i}><td>🏦 {p.mov.fecha}</td><td>{p.mov.concepto}</td><td className="num neg">{eur(p.mov.importe)}</td>
                <td>¿Es el <strong>{p.modelo.modelo} · {p.modelo.etiqueta}</strong>?{!p.seguro && <small className="muted"> (por fecha; compruébalo)</small>}</td>
                <td><button className="btn mini" type="button" onClick={() => setDlg({ m: p.modelo, ini: { fecha: "", resultado: "ingresar", importe: String(Math.abs(p.mov.importe)).replace(".", ","), mov: claveMov(p.mov) } })}>Sí, registrar</button></td></tr>
            ))}
            {docsProp.map((p, i) => (
              <tr key={"d" + i}><td>📄 PDF</td><td><button className="enlace" type="button" onClick={() => abrir(p.x)}>{p.x.nombre}</button></td><td></td>
                <td>Parece el <strong>{p.modelo.modelo} · {p.modelo.etiqueta}</strong></td>
                <td><button className="btn mini" type="button" onClick={() => setDlg({ m: p.modelo, ini: { archivo: p.x.nombre } })}>Registrar</button></td></tr>
            ))}
          </tbody></table>
        </section>
      )}

      {(() => {
        // IVA que se puede recuperar: lo que quedó «a compensar» en los 303 presentados + el IVA soportado de las facturas que aún no se ha declarado
        const comp = modelos.filter((m) => m.modelo === "303" && presentados[m.clave]?.resultado === "compensar").reduce((a, m) => a + num(presentados[m.clave].importe), 0);
        const sinDeclarar = modelos.filter((m) => m.modelo === "303" && presentados[m.clave]?.declarado).reduce((a, m) => {
          const p = presentados[m.clave], fs = (d.facturas || []).filter((f) => !f._duplicadoDe && !f.noFactura && f.iva_importe && fechaOrden(f.fecha) >= m.r.desde && fechaOrden(f.fecha) <= m.r.hasta);
          return a + Math.max(0, fs.reduce((x, f) => x + (f.iva_importe || 0), 0) + fs.filter((f) => f.isp).reduce((x, f) => x + Math.round(f.base * 21) / 100, 0) - (p.ivaSop || 0));
        }, 0);
        if (!comp && !sinDeclarar) return null;
        return (
          <section className="tarjeta devolucion-iva">
            <h3>IVA a recuperar (devolución)</h3>
            <div className="kpis">
              <div className="kpi"><span>A compensar de declaraciones presentadas</span><strong>{eur(comp)}</strong><small>cuenta 4700 · Hacienda deudora por IVA</small></div>
              <div className="kpi"><span>IVA de facturas aún no declarado</span><strong>{eur(sinDeclarar)}</strong><small>se puede meter en el 303 siguiente (hasta 4 años)</small></div>
              <div className="kpi bien"><span>Total que se podría pedir</span><strong>{eur(comp + sinDeclarar)}</strong><small>en el 303 del 4T (se presenta en enero) marcando «a devolver»</small></div>
            </div>
            <p className="muted pequeño">La devolución solo se puede pedir en la última declaración del año (4T), salvo que la empresa esté en el registro de devolución mensual (REDEME). Hasta entonces, lo que salga a compensar se resta de los trimestres siguientes. Confírmalo con la gestoría.</p>
          </section>);
      })()}

      <section className="tarjeta">
        <div className="acciones"><button className="btn" type="button" disabled={leyendoDecl} onClick={leerDeclaraciones}>{leyendoDecl ? "Leyendo…" : "Leer las declaraciones de la carpeta «impuestos»"}</button>
          <span className="muted pequeño">Lee los justificantes de la AEAT (PDF) y compara lo declarado con lo que hay en la contabilidad de ese trimestre.</span></div>
        {modelos.filter((m) => m.modelo === "303" && presentados[m.clave]?.declarado).map((m) => {
          const p = presentados[m.clave], fs = (d.facturas || []).filter((f) => !f._duplicadoDe && !f.noFactura && f.iva_importe && fechaOrden(f.fecha) >= m.r.desde && fechaOrden(f.fecha) <= m.r.hasta);
          const libro = fs.reduce((a, f) => a + (f.iva_importe || 0), 0) + fs.filter((f) => f.isp).reduce((a, f) => a + Math.round(f.base * 21) / 100, 0);
          const dif = Math.round((libro - (p.ivaSop || 0)) * 100) / 100;
          return (
            <div key={m.clave} className={"comprobacion " + (Math.abs(dif) < 1 ? "bien" : "mal")}>
              <strong>303 {m.etiqueta}</strong>: IVA soportado declarado {eur(p.ivaSop || 0)} (base {eur(p.baseSop || 0)}) · según las facturas del trimestre {eur(libro)} ·{" "}
              {Math.abs(dif) < 1 ? <span className="ok">cuadra</span> : <span className="pend">{dif > 0 ? `faltan por deducir ${eur(dif)}: facturas de este trimestre que no entraron en la declaración (se pueden deducir en una posterior, hasta 4 años)` : `se dedujo ${eur(-dif)} más de lo que hay en facturas: puede que falte subir alguna factura o que se metiera una de otro trimestre`}</span>}
              {Math.abs(dif) >= 1 && <details><summary className="pequeño">Ver las {fs.length} facturas del trimestre</summary><ul className="pequeño">{fs.sort((a, b) => fechaOrden(a.fecha).localeCompare(fechaOrden(b.fecha))).map((f) => <li key={f.archivo}>{f.fecha} · {f.proveedor} {f.numero} · IVA {eur(f.iva_importe)}{f.isp ? " (+ISP)" : ""}</li>)}</ul></details>}
            </div>);
        })}
      </section>

      {grupos.map(([t, titulo]) => {
        const ms = modelos.filter((m) => m.tramo === t);
        if (!ms.length) return null;
        return (
          <section key={t} className="tarjeta">
            <h3>{titulo}</h3>
            <div className="tabla-scroll"><table className="tabla impuestos-anio">
              <thead><tr><th>Modelo</th><th className="num">Según la contabilidad</th><th className="num">Presentado</th><th>Estado</th><th>Plazo</th><th></th></tr></thead>
              <tbody>{ms.map((m) => {
                const p = presentados[m.clave], [cl, txt] = estado(m);
                const dif = p && p.resultado === "ingresar" && !m.informativo && Math.abs(num(p.importe) - Math.max(m.calculado, 0)) > 1;
                return (
                  <tr key={m.clave}>
                    <td><strong>{m.modelo}</strong> <span className="muted pequeño">{NOMBRE_MODELO[m.modelo]}</span></td>
                    <td className="num">{m.nota ? <small className="muted">{m.nota}</small> : eur(m.calculado)}</td>
                    <td className="num">{p ? <>{eur(p.importe)} <small className="muted">{(RESULTADOS.find((x) => x[0] === p.resultado) || [])[1]}</small>{dif && <small className="pend" title="El importe presentado no coincide con la contabilidad: falta o sobra algún documento"> ≠</small>}</> : "—"}</td>
                    <td><span className={cl}>{txt}</span>{p?.fecha && <small className="muted"> · {fechaBonita(p.fecha)}</small>}</td>
                    <td>{fechaBonita(m.plazo)}</td>
                    <td className="acciones">
                      {p?.archivo && <button className="enlace" type="button" onClick={() => { const x = docs.find((y) => y.nombre === p.archivo); if (x) abrir(x); }}>Justificante</button>}
                      {["303", "111"].includes(m.modelo) && !p && <button className="enlace" type="button" onClick={() => setPrep(m)}>Preparar para Hacienda</button>}
                      <button className="enlace" type="button" onClick={() => setDlg({ m, ini: p || {} })}>{p ? "Editar" : "Registrar presentado"}</button>
                      {p && <button className="enlace" type="button" onClick={() => quitar(m)}>Quitar</button>}
                    </td>
                  </tr>
                );
              })}</tbody>
            </table></div>
          </section>
        );
      })}

      <OtrosTributos anio={anio} otros={otros} guardar={guardarOtros} d={d} docs={docs} raiz={raiz} recargarDocs={cargarDocs} aviso={aviso} />

      {prep && <PrepararHacienda m={prep} d={d} raiz={raiz} config={config} presentados={presentados} onCerrar={() => setPrep(null)} aviso={aviso} />}
      {dlg && <DialogoPresentado m={dlg.m} ini={dlg.ini} docs={docs} raiz={raiz} recargarDocs={cargarDocs} onCerrar={() => setDlg(null)} guardar={(x) => registrar(dlg.m, x)} />}
    </div>
  );
}

function DialogoPresentado({ m, ini, docs, raiz, recargarDocs, guardar, onCerrar }) {
  const [f, setF] = useState({
    fecha: ini.fecha || hoyISO(),
    resultado: ini.resultado || (m.informativo ? "informativa" : m.calculado > 0 ? "ingresar" : m.calculado < 0 ? "compensar" : "cero"),
    importe: ini.importe !== undefined ? String(ini.importe).replace(".", ",") : String(Math.abs(Math.round((m.calculado || 0) * 100) / 100)).replace(".", ","),
    justificante: ini.justificante || "", archivo: ini.archivo || "", domiciliado: !!ini.domiciliado, mov: ini.mov || "", notas: ini.notas || "",
  });
  const set = (k, v) => setF({ ...f, [k]: v });
  return (
    <div className="mc-fondo" role="dialog" aria-modal="true" aria-labelledby="ip-t">
      <div className="mc-dialogo">
        <header><h2 id="ip-t">Modelo {m.modelo} · {m.etiqueta}</h2><button className="mc-x" onClick={onCerrar} aria-label="Cerrar">×</button></header>
        <div className="mc-cuerpo">
          <p className="mc-nota">{NOMBRE_MODELO[m.modelo]}. Según la contabilidad: <strong>{m.nota || eur(m.calculado)}</strong>. Plazo: {fechaBonita(m.plazo)}.</p>
          <div className="rejilla-edit">
            <label className="mc-campo"><span>Fecha de presentación</span><input type="date" value={f.fecha} onChange={(e) => set("fecha", e.target.value)} /></label>
            <label className="mc-campo"><span>Resultado</span><select value={f.resultado} onChange={(e) => set("resultado", e.target.value)}>{RESULTADOS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
            <label className="mc-campo"><span>Importe del resultado</span><input inputMode="decimal" value={f.importe} onChange={(e) => set("importe", e.target.value)} /></label>
            <label className="mc-campo"><span>Nº de justificante / NRC / CSV</span><input value={f.justificante} onChange={(e) => set("justificante", e.target.value)} placeholder="p. ej. 1112026123456" /></label>
          </div>
          <label className="mc-campo"><span>PDF del justificante (carpeta «impuestos»)</span>
            <select value={f.archivo} onChange={(e) => set("archivo", e.target.value)}><option value="">— Ninguno —</option>{docs.map((x) => <option key={x.nombre} value={x.nombre}>{x.nombre}</option>)}</select>
          </label>
          <label className="enlace">o súbelo ahora<input type="file" hidden accept=".pdf,image/*" onChange={async (e) => { const file = e.target.files[0]; e.target.value = ""; if (!file) return; const [n] = await subir(raiz, "impuestos", [file]); await recargarDocs(); set("archivo", n); }} /></label>
          {f.resultado === "ingresar" && <label className="check"><input type="checkbox" checked={f.domiciliado} onChange={(e) => set("domiciliado", e.target.checked)} /> Domiciliado (lo carga Hacienda el último día del plazo)</label>}
          <label className="mc-campo"><span>Notas</span><input value={f.notas} onChange={(e) => set("notas", e.target.value)} placeholder="p. ej. presentado por la gestoría" /></label>
        </div>
        <footer>
          <button className="mc-btn sec" onClick={onCerrar}>Cancelar</button>
          <button className="mc-btn" disabled={!f.fecha} onClick={() => guardar({ ...f, importe: num(f.importe) })}>Guardar</button>
        </footer>
      </div>
    </div>
  );
}

// Lista para el motor contable: liquidación del IVA y pago de cada modelo presentado
export function impuestosParaDiario(presentados) {
  return Object.values(presentados || {}).map((p) => {
    const r = rango(p.anio, p.tramo);
    const plazo = modelosPlazo(p, r);
    return { modelo: p.modelo, etiqueta: p.tramo === "anio" ? `${p.anio}` : `${p.tramo}T ${p.anio}`, fechaFin: `${r.hasta.slice(8, 10)}/${r.hasta.slice(5, 7)}/${r.hasta.slice(0, 4)}`, plazo,
      importe: p.resultado === "ingresar" ? num(p.importe) : 0, ivaRep: p.modelo === "303" ? num(p.ivaRep) : 0, ivaSop: p.modelo === "303" ? num(p.ivaSop) : 0, justificante: p.archivo || p.justificante || "", mov: p.mov || "" };
  });
}
function modelosPlazo(p, r) {
  const y = r.anio;
  if (p.tramo === "anio") return `${y + 1}-07-31`;
  const t = +p.tramo;
  return t === 4 ? `${y + 1}-01-31` : `${y}-${String(t * 3 + 1).padStart(2, "0")}-${p.modelo === "202" ? "20" : "20"}`;
}
export { claveModelo };

// ---- Otros impuestos y tasas (autonómicos y locales) ----
export const TIPOS_OTROS = {
  itp: { nombre: "ITP – Transmisiones Patrimoniales Onerosas", modelo: "600", organismo: "Comunidad Autónoma", compra: true, ayuda: "Lo paga quien compra un inmueble o terreno a un particular (o en segunda transmisión). Se suma al precio de lo comprado." },
  ajd: { nombre: "AJD – Actos Jurídicos Documentados", modelo: "600", organismo: "Comunidad Autónoma", compra: true, ayuda: "Escrituras de compra con IVA, declaraciones de obra nueva, divisiones horizontales… Si es por una compra, se suma al precio." },
  ibi: { nombre: "IBI – Impuesto sobre Bienes Inmuebles", organismo: "Ayuntamiento", cuenta: "631", ayuda: "Recibo anual del ayuntamiento por ser propietario a 1 de enero. Es gasto del año (631)." },
  plusvalia: { nombre: "Plusvalía municipal (IIVTNU)", organismo: "Ayuntamiento", cuenta: "631", ayuda: "Lo paga quien vende un inmueble o terreno (en herencias y donaciones, quien recibe). Gasto (631)." },
  iae: { nombre: "IAE – Impuesto sobre Actividades Económicas", organismo: "Ayuntamiento", cuenta: "631", ayuda: "Solo si la cifra de negocios pasa de 1 millón de euros. Gasto (631)." },
  icio: { nombre: "ICIO – Impuesto sobre Construcciones, Instalaciones y Obras", organismo: "Ayuntamiento", compra: true, ayuda: "Al pedir licencia de obras. Se suma al coste de la obra o promoción." },
  ivtm: { nombre: "Impuesto de vehículos (IVTM)", organismo: "Ayuntamiento", cuenta: "631", ayuda: "Recibo anual del coche o furgoneta de la empresa. Gasto (631)." },
  tasa: { nombre: "Tasas (licencias, basuras, vados, registros públicos…)", organismo: "Ayuntamiento u organismo", cuenta: "631", ayuda: "Tasas por un servicio público. Normalmente gasto (631); si es para una obra o compra, se suma a su coste." },
  otro: { nombre: "Otro tributo", organismo: "", cuenta: "631", ayuda: "" },
};
const RE_OTROS = /comunidad de madrid|\bc\.?a\.?m\b|agencia tributaria (de )?madrid|\batm\b|ayuntamiento|\bayto\b|\bibi\b|plusval|transmisiones|\bitp\b|\bajd\b|\btasa|catastr|\bivtm\b|\bicio\b|modelo 600|generalitat|junta de|diputaci|gobierno de|recaudaci/i;
const aDMY = (iso) => (iso && iso.includes("-") ? iso.split("-").reverse().join("/") : iso || "");
const aISO = (f) => { const m = String(f || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : f || ""; };

export function otrosParaDiario(otros) {
  // «pendiente»: no se busca en el banco (queda en 4759); «tercero»: contra la subcuenta de quien lo pagó
  return (otros || []).map((o) => ({ modelo: "otro", etiqueta: `${(TIPOS_OTROS[o.tipo] || TIPOS_OTROS.otro).nombre.split(" – ")[0]}${o.descripcion ? " – " + o.descripcion : ""}`, fecha: aDMY(o.fecha), importe: num(o.importe), cuenta: o.cuenta || "631",
    pagadoPor: o.como === "tercero" ? o.pagadoPor : "", mov: o.como === "banco" ? o.mov || "" : o.como === "pendiente" ? "-" : "", justificante: o.archivo || "" }));
}

function OtrosTributos({ anio, otros, guardar, d, docs, raiz, recargarDocs, aviso }) {
  const [dlg, setDlg] = useState(null);
  const delAnio = otros.filter((o) => (o.fecha || "").startsWith(String(anio)));
  const usados = new Set(otros.map((o) => o.mov).filter(Boolean));
  const props = d.movimientos.filter((m) => m.importe < 0 && RE_OTROS.test(m.concepto || "") && fechaOrden(m.fecha).startsWith(String(anio)) && !usados.has(claveMov(m)));
  const guardarUno = async (o) => { const n = o.id ? otros.map((x) => (x.id === o.id ? o : x)) : [...otros, { ...o, id: Date.now() }]; await guardar(n); setDlg(null); aviso?.("Guardado"); };
  return (
    <section className="tarjeta">
      <h3>Otros impuestos y tasas de {anio} <span className="muted pequeño">(Comunidad Autónoma y ayuntamientos)</span></h3>
      <p className="muted pequeño">ITP y AJD (modelo 600), IBI, plusvalía municipal, IAE, ICIO, impuesto de vehículos y tasas. No son de la Agencia Tributaria, así que se apuntan aquí con su justificante. El ITP, el AJD y el ICIO de una compra u obra se suman a su coste; el resto es gasto (631).</p>
      {props.length > 0 && (
        <table className="tabla detectado"><tbody>{props.map((m) => (
          <tr key={m._id}><td>🏦 {m.fecha}</td><td>{m.concepto}</td><td className="num neg">{eur(m.importe)}</td>
            <td><button className="btn mini" type="button" onClick={() => setDlg({ tipo: /ibi|catastr/i.test(m.concepto) ? "ibi" : /plusval/i.test(m.concepto) ? "plusvalia" : /transmis|itp|600|comunidad|madrid/i.test(m.concepto) ? "itp" : "tasa", fecha: aISO(m.fecha), importe: String(Math.abs(m.importe)).replace(".", ","), como: "banco", mov: claveMov(m), descripcion: "" })}>Registrar</button></td></tr>
        ))}</tbody></table>
      )}
      {delAnio.length > 0 ? (
        <div className="tabla-scroll"><table className="tabla">
          <thead><tr><th>Fecha</th><th>Impuesto</th><th>Detalle</th><th className="num">Importe</th><th>Cuenta</th><th>Pago</th><th></th></tr></thead>
          <tbody>{delAnio.map((o) => (
            <tr key={o.id}><td>{aDMY(o.fecha)}</td><td>{(TIPOS_OTROS[o.tipo] || TIPOS_OTROS.otro).nombre}</td><td>{o.descripcion}</td><td className="num">{eur(o.importe)}</td><td className="cta">{o.cuenta}</td>
              <td>{o.como === "banco" ? "Banco" : o.como === "tercero" ? `Pagado por ${o.pagadoPor}` : <span className="pend">Pendiente de pago</span>}</td>
              <td className="acciones">{o.archivo && <button className="enlace" type="button" onClick={() => { const x = docs.find((y) => y.nombre === o.archivo); if (x) abrir(x); }}>Justificante</button>}
                <button className="enlace" type="button" onClick={() => setDlg(o)}>Editar</button>
                <button className="enlace" type="button" onClick={async () => { if (window.confirm("¿Quitar este impuesto?")) await guardar(otros.filter((x) => x.id !== o.id)); }}>Quitar</button></td></tr>
          ))}</tbody>
        </table></div>
      ) : <p className="muted pequeño">No hay ninguno apuntado este año.</p>}
      <button className="btn ghost" type="button" onClick={() => setDlg({ tipo: "itp", fecha: hoyISO(), importe: "", como: "banco", descripcion: "" })}>+ Añadir impuesto o tasa</button>
      {dlg && <DialogoOtro ini={dlg} docs={docs} raiz={raiz} recargarDocs={recargarDocs} onCerrar={() => setDlg(null)} guardar={guardarUno} />}
    </section>
  );
}

function DialogoOtro({ ini, docs, raiz, recargarDocs, guardar, onCerrar }) {
  const [o, setO] = useState({ cuenta: "", pagadoPor: "", archivo: "", ...ini });
  const T = TIPOS_OTROS[o.tipo] || TIPOS_OTROS.otro;
  const cuenta = o.cuenta || (T.compra ? "" : T.cuenta || "631");
  const set = (k, v) => setO({ ...o, [k]: v });
  return (
    <div className="mc-fondo" role="dialog" aria-modal="true" aria-labelledby="ot-t">
      <div className="mc-dialogo">
        <header><h2 id="ot-t">Impuesto o tasa</h2><button className="mc-x" onClick={onCerrar} aria-label="Cerrar">×</button></header>
        <div className="mc-cuerpo">
          <label className="mc-campo"><span>¿Qué es?</span><select value={o.tipo} onChange={(e) => setO({ ...o, tipo: e.target.value, cuenta: "" })}>{Object.entries(TIPOS_OTROS).map(([k, t]) => <option key={k} value={k}>{t.nombre}</option>)}</select></label>
          {T.ayuda && <p className="mc-nota">{T.ayuda}</p>}
          <div className="rejilla-edit">
            <label className="mc-campo"><span>Fecha</span><input type="date" value={o.fecha} onChange={(e) => set("fecha", e.target.value)} /></label>
            <label className="mc-campo"><span>Importe</span><input inputMode="decimal" value={o.importe} onChange={(e) => set("importe", e.target.value)} /></label>
          </div>
          <label className="mc-campo"><span>Detalle (inmueble, operación, recibo…)</span><input value={o.descripcion} onChange={(e) => set("descripcion", e.target.value)} placeholder="p. ej. compra solar manzana 19 Brunete" /></label>
          {T.compra ? (
            <div className="as-opciones">
              <p className="as-pregunta pequeño">¿Es por la compra de algo o por una obra?</p>
              <button type="button" className={cuenta && cuenta !== "631" ? "on" : ""} onClick={() => set("cuenta", "210")}>Sí: se suma al coste de lo comprado</button>
              {cuenta && cuenta !== "631" && <label className="mc-campo"><span>Cuenta del bien</span><select value={cuenta} onChange={(e) => set("cuenta", e.target.value)}>
                <option value="210">210 · Terreno o solar para usar</option><option value="211">211 · Edificio o local para usar</option>
                <option value="300">300 · Inmueble o terreno para vender (existencias)</option><option value="230">230 · Obra en curso (inmovilizado)</option>
              </select></label>}
              <button type="button" className={cuenta === "631" ? "on" : ""} onClick={() => set("cuenta", "631")}>No: es gasto del año (631)</button>
            </div>
          ) : null}
          <div className="as-opciones">
            <p className="as-pregunta pequeño">¿Cómo se pagó?</p>
            <button type="button" className={o.como === "banco" ? "on" : ""} onClick={() => set("como", "banco")}>Desde el banco de la empresa (se busca solo en el extracto)</button>
            <button type="button" className={o.como === "tercero" ? "on" : ""} onClick={() => set("como", "tercero")}>Lo pagó otro por nosotros (notaría, gestoría, abogados con la provisión de fondos)</button>
            {o.como === "tercero" && <label className="mc-campo"><span>¿Quién lo pagó?</span><input value={o.pagadoPor} onChange={(e) => set("pagadoPor", e.target.value)} placeholder="p. ej. Solve Abogados" /></label>}
            <button type="button" className={o.como === "pendiente" ? "on" : ""} onClick={() => set("como", "pendiente")}>Aún no se ha pagado</button>
          </div>
          <label className="mc-campo"><span>Justificante (carpeta «impuestos»)</span><select value={o.archivo} onChange={(e) => set("archivo", e.target.value)}><option value="">— Ninguno —</option>{docs.map((x) => <option key={x.nombre} value={x.nombre}>{x.nombre}</option>)}</select></label>
          <label className="enlace">o súbelo ahora<input type="file" hidden accept=".pdf,image/*" onChange={async (e) => { const f = e.target.files[0]; e.target.value = ""; if (!f) return; const [n] = await subir(raiz, "impuestos", [f]); await recargarDocs(); set("archivo", n); }} /></label>
        </div>
        <footer>
          <button className="mc-btn sec" onClick={onCerrar}>Cancelar</button>
          <button className="mc-btn" disabled={!o.fecha || !num(o.importe) || !cuenta || (o.como === "tercero" && !o.pagadoPor.trim())} onClick={() => guardar({ ...o, cuenta, importe: num(o.importe), modelo: T.modelo || "" })}>Guardar</button>
        </footer>
      </div>
    </div>
  );
}


// Casillas listas para pasar a la sede de la AEAT, con la cuenta bancaria (la única que hay, o la que elijas)
function PrepararHacienda({ m, d, raiz, config, presentados, onCerrar, aviso }) {
  const [cuentas, setCuentas] = useState(null);
  const [iban, setIban] = useState("");
  const [extra, setExtra] = useState("");
  useEffect(() => { cuentasEmpresa(raiz, config).then((l) => { setCuentas(l); setIban(l[0] || ""); }); }, [raiz, config]);
  // IVA soportado de trimestres anteriores ya presentados que no se dedujo (se puede incluir ahora, dentro de 4 años)
  const sinDeducir = useMemo(() => {
    if (m.modelo !== "303") return 0;
    return Object.values(presentados).filter((p) => p.modelo === "303" && p.declarado && +p.anio === +m.anio && +p.tramo < +m.tramo).reduce((a, p) => {
      const r = rango(p.anio, p.tramo), fs = (d.facturas || []).filter((f) => !f._duplicadoDe && !f.noFactura && fechaOrden(f.fecha) >= r.desde && fechaOrden(f.fecha) <= r.hasta);
      return a + Math.max(0, fs.reduce((x, f) => x + (f.iva_importe || 0), 0) + fs.filter((f) => f.isp).reduce((x, f) => x + Math.round(f.base * 21) / 100, 0) - (p.ivaSop || 0));
    }, 0);
  }, [m, d, presentados]);
  const c = m.modelo === "303" ? casillas303(d, m.r, presentados, { extraDeducible: num(extra) }) : casillas111(d, m.r);
  const RES = { ingresar: "A ingresar", compensar: "A compensar", devolver: "A devolver", cero: "Sin actividad / cero" };
  const copiar = async (v) => { try { await navigator.clipboard.writeText(String(v)); aviso?.(`Copiado: ${v}`); } catch { /* nada */ } };
  const fmt = (v) => (typeof v === "number" && !Number.isInteger(v) ? v.toFixed(2).replace(".", ",") : String(v).replace(".", ","));
  const descargar = () => {
    const filas = [["Modelo", m.modelo], ["Periodo", m.etiqueta], ["NIF", config?.empresa?.cif || ""], ["Razón social", config?.empresa?.razon_social || config?.nombre || ""], [], ["Casilla", "Concepto", "Importe"], ...c.filas.map(([k, t, v]) => [k, t, typeof v === "number" ? v : num(v)]), [], ["Resultado", RES[c.resultado]], ["Importe", c.importe], ["Cuenta (IBAN)", iban]];
    descargarTexto(csv(filas), `Modelo ${m.modelo} ${m.etiqueta} - para Hacienda.csv`);
  };
  const necesitaCuenta = c.resultado === "ingresar" || c.resultado === "devolver";
  return (
    <div className="mc-fondo" role="dialog" aria-modal="true" aria-labelledby="ph-t">
      <div className="mc-dialogo ancho">
        <header><h2 id="ph-t">Modelo {m.modelo} · {m.etiqueta} — para presentar en Hacienda</h2><button className="mc-x" onClick={onCerrar} aria-label="Cerrar">×</button></header>
        <div className="mc-cuerpo">
          <p className="mc-nota">Calculado con las facturas del periodo{m.modelo === "303" ? ` (${c.facturas.recibidas} recibidas, ${c.facturas.emitidas} emitidas, ${c.facturas.isp} con inversión del sujeto pasivo)` : ""}. Pulsa en un importe para copiarlo y pegarlo en el formulario de la sede.</p>
          {m.modelo === "303" && sinDeducir > 0.5 && (
            <label className="mc-campo"><span>IVA de trimestres anteriores que no se dedujo ({eur(sinDeducir)}). ¿Lo incluyes en este 303? (se suma a la casilla 29)</span>
              <span className="acciones"><input value={extra} placeholder="0,00" onChange={(e) => setExtra(e.target.value)} style={{ maxWidth: 140 }} /> <button className="btn ghost pequeño" type="button" onClick={() => setExtra(sinDeducir.toFixed(2).replace(".", ","))}>Incluir {eur(sinDeducir)}</button></span></label>
          )}
          <table className="tabla pequeña"><thead><tr><th>Casilla</th><th>Concepto</th><th className="num">Importe</th></tr></thead>
            <tbody>{c.filas.map(([k, t, v]) => (<tr key={k + t}><td><strong>{k}</strong></td><td>{t}</td><td className="num"><button className="enlace" type="button" title="Copiar" onClick={() => copiar(fmt(v))}>{typeof v === "number" && !Number.isInteger(v) ? eur(v) : typeof v === "number" && k !== "07" ? eur(v) : v}</button></td></tr>))}</tbody></table>
          <p><strong>Resultado: {RES[c.resultado]}{c.importe ? ` · ${eur(c.importe)}` : ""}</strong>{m.modelo === "303" && (c.c87 > 0 || c.c71 < 0) ? <span className="muted"> · total a compensar en los siguientes trimestres: {eur(c.c87 + Math.max(0, -c.c71))}{m.tramo !== "4" ? " (en el 4T se puede pedir la devolución)" : ""}</span> : ""}</p>
          {necesitaCuenta && (
            <div className="mc-campo"><span>{c.resultado === "devolver" ? "Cuenta para la devolución" : "Cuenta para el cargo (domiciliación o NRC)"}</span>
              {cuentas === null ? <span className="muted">Buscando las cuentas…</span>
                : cuentas.length === 0 ? <span className="muted">No hay ninguna cuenta guardada: conecta el banco o ponla en Ajustes › Empresa.</span>
                : cuentas.length === 1 ? <span><strong>{ibanBonito(cuentas[0])}</strong> <button className="enlace pequeño" type="button" onClick={() => copiar(cuentas[0])}>copiar</button> <small className="muted">(la única cuenta de la empresa: se pone sola)</small></span>
                : <select value={iban} onChange={(e) => setIban(e.target.value)}>{cuentas.map((x) => <option key={x} value={x}>{ibanBonito(x)}</option>)}</select>}
            </div>
          )}
        </div>
        <footer>
          <button className="mc-btn sec" type="button" onClick={descargar}>Descargar (Excel)</button>
          <a className="mc-btn sec" href={ENLACE_AEAT[m.modelo]} target="_blank" rel="noopener noreferrer">Abrir la sede de la AEAT</a>
          <button className="mc-btn" type="button" onClick={onCerrar}>Cerrar</button>
        </footer>
      </div>
    </div>
  );
}
