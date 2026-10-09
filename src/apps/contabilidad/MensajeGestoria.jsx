// «Mensaje a la gestoría»: lo que merece la pena contarle al gestor del periodo.
// Arriba, tus notas (se guardan en «programa › notas_gestoria.json»); debajo, lo que la app ha visto sola
// (facturas con avisos, saldos a favor, pendientes). Se compone un mensaje editable para copiar o mandar por Outlook.
import { useEffect, useMemo, useState } from "react";
import { leerJSON, escribirJSON, eur, fechaOrden } from "./datos.js";
import { porGestionar, enRango } from "./periodo.js";
import { estadoEncargo } from "../../lib/encargoEstado.js";

const ARCHIVO = "notas_gestoria.json";

// Lo que la app detecta sola en el periodo
export function vistoPorLaApp(d, diario, vinc, r) {
  const out = [];
  for (const f of d.facturas.filter((f) => enRango(f.fecha, r) && !f._duplicadoDe)) {
    const descuadre = f.total && Math.round((f.total - (f.base + f.iva_importe - f.retencion_importe)) * 100) / 100;
    if (descuadre < -0.009) out.push(`Factura ${f.proveedor || ""} ${f.numero || ""}: está mal sumada por el proveedor (${eur(-descuadre)} de diferencia). Contabilizada por su total; pedida rectificativa.`);
    if (f.nota && /gestor|ojo|retenci|falta la minuta|rectific/i.test(f.nota)) out.push(`${f.proveedor || f.archivo} ${f.numero || ""}: ${f.nota}`);
    if (f.noFactura && f.notaNoFactura && /gestor|vendedor|retenid/i.test(f.notaNoFactura)) out.push(`${f.proveedor || f.archivo} ${f.numero || ""} (no contabilizada como gasto): ${f.notaNoFactura}`);
  }
  const g = porGestionar(d, diario.asientos, diario.pendientes, vinc, r);
  for (const s of g) {
    if (/pagado de más|esperan su factura/i.test(s.titulo)) for (const i of s.items) out.push(i.texto.replace(/: pagado de más \(falta su factura o es provisión de fondos sin gastar\)/, `: ${eur(-i.importe)} pagados de más (nos los deben, o falta su factura)`));
    else if (s.items.length) out.push(`${s.titulo}: ${s.items.length}${s.items.length <= 3 ? " — " + s.items.map((i) => `${i.fecha} ${String(i.texto).slice(0, 60)} ${i.importe != null ? eur(i.importe) : ""}`.trim()).join("; ") : ""}`);
  }
  return [...new Set(out)];
}

export default function MensajeGestoria({ raiz, d, diario, extra, r, config, aviso }) {
  const [notas, setNotas] = useState(null);
  const [nueva, setNueva] = useState("");
  const [texto, setTexto] = useState("");
  const [tocado, setTocado] = useState(false);
  useEffect(() => { leerJSON(raiz, ARCHIVO, { notas: [] }).then((x) => setNotas(x.notas || [])); }, [raiz]);
  const guardar = async (n) => { setNotas(n); await escribirJSON(raiz, ARCHIVO, { notas: n }); };
  const vistas = useMemo(() => vistoPorLaApp(d, diario, extra.vinc, r), [d, diario, extra, r]);
  const empresa = config?.empresa?.razon_social || config?.nombre || "la empresa";
  const borrador = useMemo(() => {
    const abiertas = (notas || []).filter((n) => !n.hecho);
    return [`Hola,`, ``, `Os paso lo que conviene que reviséis de ${empresa} (${r.etiqueta}):`, ``,
      ...abiertas.map((n, i) => `${i + 1}. ${n.texto}`),
      ...(vistas.length ? [``, `Además, la app ha detectado:`, ...vistas.map((v) => `- ${v}`)] : []),
      ``, `La contabilidad del periodo está en la carpeta compartida «para la gestoria».`, ``, `Gracias,`, config?.nombre || ""].join("\n");
  }, [notas, vistas, r, empresa, config]);
  useEffect(() => { if (!tocado) setTexto(borrador); }, [borrador, tocado]);
  if (!notas) return <p className="muted">Cargando…</p>;
  const email = estadoEncargo().email || "";
  return (
    <section className="mensaje-gestoria">
      <h2>Mensaje a la gestoría</h2>
      <p className="muted pequeño">Apunta aquí lo que tengas que contarles (dudas, criterios, cosas raras). La app añade lo que ha visto sola en el periodo. Revisa el mensaje y cópialo o mándalo.</p>
      <h3>Tus notas para la gestoría</h3>
      <ul className="notas-g">
        {notas.map((n) => (
          <li key={n.id} className={n.hecho ? "hecha" : ""}>
            <label><input type="checkbox" checked={!!n.hecho} onChange={() => guardar(notas.map((x) => (x.id === n.id ? { ...x, hecho: !x.hecho } : x)))} title="Marcar como resuelta (ya no sale en el mensaje)" /> <span>{n.texto}</span></label>
            <span className="muted pequeño"> {n.fecha}</span> <button className="enlace pequeño" type="button" onClick={() => guardar(notas.filter((x) => x.id !== n.id))}>quitar</button>
          </li>
        ))}
      </ul>
      <div className="acciones">
        <input style={{ flex: 1 }} value={nueva} placeholder="Nueva nota para la gestoría…" onChange={(e) => setNueva(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && nueva.trim()) { guardar([...notas, { id: crypto.randomUUID(), texto: nueva.trim(), fecha: new Date().toLocaleDateString("es-ES") }]); setNueva(""); } }} />
        <button className="btn ghost" type="button" disabled={!nueva.trim()} onClick={() => { guardar([...notas, { id: crypto.randomUUID(), texto: nueva.trim(), fecha: new Date().toLocaleDateString("es-ES") }]); setNueva(""); }}>Añadir</button>
      </div>
      {vistas.length > 0 && <><h3>Lo que ha visto la app ({r.etiqueta})</h3><ul className="pequeño">{vistas.map((v, i) => <li key={i}>{v}</li>)}</ul></>}
      <h3>Mensaje</h3>
      <textarea rows={16} style={{ width: "100%", boxSizing: "border-box", font: "inherit" }} value={texto} onChange={(e) => { setTexto(e.target.value); setTocado(true); }} />
      <div className="acciones">
        <button className="btn" type="button" onClick={async () => { try { await navigator.clipboard.writeText(texto); aviso?.("Mensaje copiado"); } catch { aviso?.("No se pudo copiar: selecciónalo y pulsa Ctrl+C"); } }}>Copiar</button>
        <a className="btn ghost" href={`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`${empresa} · ${r.etiqueta} · puntos a revisar`)}&body=${encodeURIComponent(texto)}`}>Abrir en Outlook</a>
        <button className="btn ghost" type="button" onClick={async () => { let dd = raiz; for (const p of ["para la gestoria", r.corta]) dd = await dd.getDirectoryHandle(p, { create: true }); const w = await (await dd.getFileHandle("mensaje para la gestoria.txt", { create: true })).createWritable(); await w.write(texto); await w.close(); aviso?.(`Guardado en «para la gestoria › ${r.corta}»`); }}>Guardarlo en «para la gestoria»</button>
        {tocado && <button className="enlace pequeño" type="button" onClick={() => { setTocado(false); setTexto(borrador); }}>volver a generarlo</button>}
      </div>
    </section>
  );
}
