// Emitir facturas con VERI*FACTU directo a la AEAT: la factura se registra (huella encadenada), se envía a Hacienda
// con el certificado de la empresa a través del Firmador de este ordenador, y se guarda en PDF con el QR y el estilo
// de papelería de la empresa en «contabilidad › facturas_emitidas». La cadena de registros vive en «programa».
import { useEffect, useMemo, useState } from "react";
import { raizGuardada, permiso, buscarContabilidad } from "../../lib/carpetas.js";
import { leerJSON, escribirJSON, guardarLectura, sub } from "../contabilidad/datos.js";
import { ENTORNOS, registroAlta, sobreSOAP, urlQR, qrPNG, firmadorEstado, firmadorCertificados, enviarAEAT, desglose, dos } from "../../lib/verifactu.js";
import { facturaPDF, ESTILOS } from "../../lib/papeleria.js";
import { useAviso } from "../../comunes.jsx";

const ARCHIVO = "verifactu_registros.json";
const eur = (v) => (+v || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const LINEA = { concepto: "", cantidad: 1, precio: "", iva: 21 };
const hoyISO = () => new Date().toISOString().slice(0, 10);
const nombreArchivo = (f, cliente, numero, total) => `${f.slice(2, 4)}${f.slice(5, 7)}${f.slice(8, 10)} - ${(cliente || "CLIENTE").toUpperCase().replace(/[\\/:*?"<>|]/g, "")} ${numero} ${(+total).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.pdf`;

export default function EmitirFactura({ config, guardar }) {
  const [aviso, nodoAviso] = useAviso();
  const vf = config.verifactu || {};
  const ajustar = (c) => guardar({ ...config, verifactu: { ...vf, ...c } });
  const empresa = { razon_social: config.nombre, ...(config.empresa || {}) };
  const [firmador, setFirmador] = useState(undefined);
  const [certs, setCerts] = useState([]);
  const [raiz, setRaiz] = useState(null);
  const [reg, setReg] = useState(null);
  const [f, setF] = useState({ fecha: hoyISO(), cliente: { nombre: "", nif: "", domicilio: "" }, descripcion: "", lineas: [{ ...LINEA }], retencion: "", notas: "" });
  const [paso, setPaso] = useState("");
  const [resultado, setResultado] = useState(null);
  const entorno = vf.entorno || "pruebas";

  const comprobar = async () => {
    const e = await firmadorEstado(); setFirmador(e);
    if (e) try { setCerts(await firmadorCertificados()); } catch { setCerts([]); }
  };
  useEffect(() => { comprobar(); (async () => { const r = await raizGuardada(); if (r && await permiso(r, false)) { const c = await buscarContabilidad(r); if (c) { setRaiz(c); setReg(await leerJSON(c, ARCHIVO, { series: {}, cadenas: {}, registros: [] })); } } })(); }, []);
  const conectarCarpeta = async () => { const r = await raizGuardada(); if (!r || !(await permiso(r, true))) return aviso("Elige primero la carpeta de la empresa en «Organizar carpetas»."); const c = await buscarContabilidad(r, true, (config.nombre || "").split(/[ ,]/)[0].toLowerCase()); setRaiz(c); setReg(await leerJSON(c, ARCHIVO, { series: {}, cadenas: {}, registros: [] })); };

  const nif = (empresa.cif || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const certsEmpresa = certs.filter((c) => [c.nif, c.representaA].some((x) => (x || "").toUpperCase().includes(nif)) || !nif);
  const cert = vf.certificado && certs.find((c) => c.huella === vf.certificado);
  const serie = vf.serie || "A";
  const anio = f.fecha.slice(0, 4);
  const claveSerie = `${entorno}|${serie}|${anio}`;
  const siguiente = ((reg?.series || {})[claveSerie] || 0) + 1;
  const numero = `${serie}-${anio}-${String(siguiente).padStart(4, "0")}`;
  const det = useMemo(() => desglose(f.lineas.filter((l) => +l.precio)), [f.lineas]);
  const base = det.reduce((s, d) => s + d.base, 0), cuota = det.reduce((s, d) => s + d.cuota, 0);
  const ret = Math.round(base * (+f.retencion || 0)) / 100;
  const total = base + cuota - ret;
  const faltan = [!nif && "el CIF de tu empresa (Ajustes › Empresa)", !f.cliente.nombre && "el cliente", !f.cliente.nif && "el NIF del cliente", !det.length && "al menos una línea con importe", !cert && "el certificado", !firmador && "el firmador encendido", !raiz && "la carpeta de contabilidad"].filter(Boolean);
  const setL = (i, k, v) => setF({ ...f, lineas: f.lineas.map((l, j) => (j === i ? { ...l, [k]: v } : l)) });

  async function emitir() {
    if (faltan.length) return;
    if (entorno === "produccion" && !confirm(`Vas a enviar la factura ${numero} (${eur(total)}) a Hacienda DE VERDAD. Una vez enviada no se puede borrar: solo anular o rectificar. ¿Seguimos?`)) return;
    setResultado(null);
    try {
      setPaso("Preparando el registro VERI*FACTU…");
      const claveCadena = `${entorno}|${nif}`;
      const anterior = (reg.cadenas || {})[claveCadena] || null;
      const sistema = { nombreRazon: vf.sistemaNombre || empresa.razon_social, nif: (vf.sistemaNif || nif), nombre: "Mi Despacho", id: "MD", version: "1.0", instalacion: vf.instalacion || "1" };
      const lineas = f.lineas.filter((l) => +l.precio).map((l) => ({ ...l, cantidad: +l.cantidad || 1, precio: +String(l.precio).replace(",", "."), iva: +l.iva }));
      const r = await registroAlta({ nif, nombre: empresa.razon_social, numero, fecha: new Date(f.fecha + "T12:00:00"), tipo: "F1", descripcion: f.descripcion || lineas.map((l) => l.concepto).join("; "), destinatario: { nombre: f.cliente.nombre, nif: f.cliente.nif.toUpperCase().replace(/[^A-Z0-9]/g, "") }, lineas }, anterior, sistema);
      setPaso("Enviando a la AEAT con tu certificado…");
      const env = await enviarAEAT({ entorno, certificado: cert.huella, soap: sobreSOAP({ nombre: empresa.razon_social, nif }, [r.xml]) });
      const resp = env.respuesta;
      if (!resp.ok) { setPaso(""); setResultado({ ok: false, resp, http: env.http, texto: env.texto }); return; }
      setPaso("Hacienda la ha aceptado. Generando el PDF con el QR…");
      const url = urlQR(entorno, nif, numero, r.fecha, r.total);
      const qr = await qrPNG(url);
      const pdf = await facturaPDF({ estilo: config.papeleria || "clasico", empresa, color: config.color, logo: config.logo, factura: { numero, fecha: new Date(f.fecha + "T12:00:00").toLocaleDateString("es-ES"), cliente: f.cliente, lineas, retencion_pct: +f.retencion || 0, notas: f.notas, qr, leyendaQR: entorno === "produccion" ? "VERI*FACTU" : "VERI*FACTU · PRUEBAS" } });
      const archivo = nombreArchivo(f.fecha, f.cliente.nombre, numero, total);
      if (entorno === "produccion") {
        const dir = await sub(raiz, "facturas_emitidas", true);
        const w = await (await dir.getFileHandle(archivo, { create: true })).createWritable(); await w.write(pdf); await w.close();
        await guardarLectura(raiz, archivo, Date.now(), { archivo, numero, fecha: new Date(f.fecha + "T12:00:00").toLocaleDateString("es-ES"), cliente: f.cliente.nombre, nif_cliente: f.cliente.nif, proveedor: empresa.razon_social, base: +dos(base), iva_pct: det.length === 1 ? det[0].tipo : 0, iva_importe: +dos(cuota), retencion_pct: +f.retencion || 0, retencion_importe: +dos(ret), total: +dos(total), cuenta_pgc: "705", analizado_ia: false, verifactu: { huella: r.huella, csv: resp.csv } }, true);
      }
      const nuevo = { ...reg, series: { ...reg.series, [claveSerie]: siguiente }, cadenas: { ...reg.cadenas, [claveCadena]: { nif, numero, fecha: r.fecha, huella: r.huella } }, registros: [...(reg.registros || []), { entorno, numero, fecha: r.fecha, ts: r.ts, cliente: f.cliente.nombre, nif_cliente: f.cliente.nif, base: r.base, cuota: r.cuota, total: r.total, huella: r.huella, anterior: anterior?.huella || "", csv: resp.csv, estado: resp.lineas[0]?.estado || resp.estado, archivo: entorno === "produccion" ? archivo : "", url }] };
      await escribirJSON(raiz, ARCHIVO, nuevo); setReg(nuevo);
      const blob = new Blob([pdf], { type: "application/pdf" }); const u = URL.createObjectURL(blob);
      setPaso(""); setResultado({ ok: true, resp, numero, url, pdf: u, archivo });
      setF({ ...f, cliente: { nombre: "", nif: "", domicilio: "" }, descripcion: "", lineas: [{ ...LINEA }], notas: "" });
    } catch (e) { setPaso(""); setResultado({ ok: false, error: String(e.message || e) }); }
  }

  return (
    <div className="app">
      <header className="app-cab">
        <div>
          <div className="eyebrow">Facturación · VERI*FACTU</div>
          <h1>Emitir factura</h1>
          <p className="muted">La factura se registra y se envía directamente a Hacienda con el certificado digital de tu empresa, desde tu ordenador. Sale en PDF con el código QR y el estilo de tu papelería ({ESTILOS[config.papeleria || "clasico"].nombre}).</p>
        </div>
      </header>

      <section className={"tarjeta vf-entorno " + entorno}>
        <div className="fila">
          <label>Envío<select value={entorno} onChange={(e) => ajustar({ entorno: e.target.value })}>{Object.entries(ENTORNOS).map(([k, v]) => <option key={k} value={k}>{v.nombre}</option>)}</select></label>
          <label>Serie<input value={serie} maxLength={6} onChange={(e) => ajustar({ serie: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} /></label>
          <div><span className="muted pequeño">Próximo número</span><br /><strong>{numero}</strong></div>
        </div>
        {entorno === "pruebas" ? <p className="pequeño muted">Modo de pruebas: se envía al entorno de pruebas de la AEAT, sin efectos fiscales. Cuando todo funcione, cambia a «Real».</p> : <p className="pequeño"><strong>Modo real:</strong> las facturas quedan registradas en Hacienda.</p>}
      </section>

      <section className="tarjeta">
        <h2>1. Firmador y certificado</h2>
        {firmador === undefined ? <p className="muted">Comprobando el firmador…</p> : !firmador ? (
          <div>
            <p>El <strong>Firmador de Mi Despacho</strong> no está encendido en este ordenador. Es un pequeño programa que usa tu certificado digital para hablar con Hacienda; el certificado no sale de tu PC.</p>
            <div className="acciones">
              <a className="btn" href="/instalar-firmador.bat" download>Descargar e instalar el firmador</a>
              <a className="btn ghost" href="midespacho-firma://encender">Encenderlo (si ya está instalado)</a>
              <button className="btn ghost" type="button" onClick={comprobar}>Ya está, comprobar</button>
            </div>
            <p className="muted pequeño">Abre el archivo descargado y acepta. Se instala para tu usuario (no pide permisos de administrador) y se enciende solo al arrancar Windows.</p>
          </div>
        ) : (
          <div>
            <p className="ok pequeño">✓ Firmador encendido (versión {firmador.version}).</p>
            <label>Certificado con el que se envía<select value={vf.certificado || ""} onChange={(e) => ajustar({ certificado: e.target.value })}>
              <option value="">— Elige —</option>
              {(certsEmpresa.length ? certsEmpresa : certs).map((c) => <option key={c.huella} value={c.huella}>{c.titular}{c.representaA ? ` · representa a ${c.representaA}` : ""} · caduca {c.caduca}</option>)}
            </select></label>
            {nif && !certsEmpresa.length && certs.length > 0 && <p className="nota pequeño">No hay ningún certificado de {empresa.razon_social} ({nif}) en este ordenador. En pruebas puedes usar otro; en real tiene que ser el de la empresa o el de su representante.</p>}
          </div>
        )}
        {!raiz && <p className="nota">Para guardar las facturas y la cadena VERI*FACTU hace falta la carpeta de contabilidad. <button className="enlace" type="button" onClick={conectarCarpeta}>Permitir el acceso</button></p>}
      </section>

      <section className="tarjeta">
        <h2>2. La factura</h2>
        <div className="formulario">
          <div className="fila">
            <label>Fecha<input type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></label>
            <label>Cliente<input value={f.cliente.nombre} onChange={(e) => setF({ ...f, cliente: { ...f.cliente, nombre: e.target.value } })} /></label>
            <label>NIF del cliente<input value={f.cliente.nif} onChange={(e) => setF({ ...f, cliente: { ...f.cliente, nif: e.target.value } })} /></label>
          </div>
          <label>Domicilio del cliente<input value={f.cliente.domicilio} onChange={(e) => setF({ ...f, cliente: { ...f.cliente, domicilio: e.target.value } })} /></label>
          <table className="tabla vf-lineas"><thead><tr><th>Concepto</th><th className="num">Cant.</th><th className="num">Precio (€)</th><th className="num">IVA</th><th className="num">Importe</th><th /></tr></thead>
            <tbody>{f.lineas.map((l, i) => (
              <tr key={i}>
                <td><input value={l.concepto} onChange={(e) => setL(i, "concepto", e.target.value)} placeholder="Servicio prestado" /></td>
                <td className="num"><input type="number" min="0" step="any" value={l.cantidad} onChange={(e) => setL(i, "cantidad", e.target.value)} style={{ width: 70 }} /></td>
                <td className="num"><input type="number" min="0" step="0.01" value={l.precio} onChange={(e) => setL(i, "precio", e.target.value)} style={{ width: 110 }} /></td>
                <td className="num"><select value={l.iva} onChange={(e) => setL(i, "iva", e.target.value)}>{[21, 10, 4, 0].map((t) => <option key={t} value={t}>{t} %</option>)}</select></td>
                <td className="num">{eur((+l.cantidad || 0) * (+l.precio || 0))}</td>
                <td>{f.lineas.length > 1 && <button className="enlace" type="button" onClick={() => setF({ ...f, lineas: f.lineas.filter((_, j) => j !== i) })}>quitar</button>}</td>
              </tr>))}</tbody></table>
          <button className="enlace" type="button" onClick={() => setF({ ...f, lineas: [...f.lineas, { ...LINEA }] })}>+ Añadir línea</button>
          <div className="fila">
            <label>Retención IRPF (%)<input type="number" min="0" max="50" step="0.5" value={f.retencion} onChange={(e) => setF({ ...f, retencion: e.target.value })} placeholder="Solo si facturas como profesional" /></label>
            <label>Descripción de la operación (para Hacienda)<input value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} placeholder="Si lo dejas vacío, se usan los conceptos" /></label>
          </div>
          <label>Observaciones (salen en el PDF)<textarea rows={2} value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} /></label>
          <div className="vf-totales"><span>Base {eur(base)}</span>{det.map((d) => <span key={d.tipo}>IVA {d.tipo}% {eur(d.cuota)}</span>)}{ret > 0 && <span>Retención −{eur(ret)}</span>}<strong>Total {eur(total)}</strong></div>
        </div>
        {faltan.length > 0 && <p className="muted pequeño">Falta: {faltan.join(", ")}.</p>}
        <div className="acciones">
          <button className="btn" type="button" disabled={!!faltan.length || !!paso} onClick={emitir}>{paso ? "Enviando…" : `Emitir ${numero} y enviar a Hacienda`}</button>
        </div>
        {paso && <p role="status"><span className="girando" aria-hidden="true" /> {paso}</p>}
        {resultado?.ok && (
          <div className="mc-ok">
            <p><strong>✓ Factura {resultado.numero} registrada en Hacienda</strong>{resultado.resp.csv ? ` · CSV ${resultado.resp.csv}` : ""}{resultado.resp.estado === "ParcialmenteCorrecto" || resultado.resp.lineas[0]?.estado === "AceptadoConErrores" ? ` · aceptada con avisos: ${resultado.resp.error}` : ""}.</p>
            <p className="acciones"><a className="btn" href={resultado.pdf} download={resultado.archivo}>Descargar el PDF</a> <a className="btn ghost" href={resultado.url} target="_blank" rel="noopener noreferrer">Comprobarla en la AEAT</a></p>
            {entorno === "produccion" ? <p className="pequeño muted">Guardada en «contabilidad › facturas_emitidas»: ya está en tu contabilidad.</p> : <p className="pequeño muted">Es de pruebas: no se guarda en la contabilidad.</p>}
          </div>
        )}
        {resultado && !resultado.ok && (
          <div className="nota" role="alert">
            <p><strong>Hacienda no la ha aceptado.</strong> {resultado.error || resultado.resp?.error || resultado.resp?.estado || ""}</p>
            {resultado.resp?.lineas?.map((l, i) => l.codigo && <p key={i} className="pequeño">Error {l.codigo}: {l.error}</p>)}
            <p className="pequeño muted">El número {numero} no se ha gastado: corrige y vuelve a emitir.</p>
            {resultado.texto && <details className="pequeño"><summary>Respuesta técnica</summary><pre style={{ whiteSpace: "pre-wrap", maxHeight: 220, overflow: "auto" }}>{resultado.texto.slice(0, 4000)}</pre></details>}
          </div>
        )}
      </section>

      {reg?.registros?.length > 0 && (
        <section className="tarjeta">
          <h2>Facturas registradas</h2>
          <table className="tabla pequeña"><thead><tr><th>Nº</th><th>Fecha</th><th>Cliente</th><th className="num">Total</th><th>Envío</th><th>Estado</th><th /></tr></thead>
            <tbody>{[...reg.registros].reverse().slice(0, 50).map((r) => (
              <tr key={r.entorno + r.numero}><td>{r.numero}</td><td>{r.fecha}</td><td>{r.cliente}</td><td className="num">{eur(r.total)}</td><td>{r.entorno === "produccion" ? "Real" : "Pruebas"}</td><td>{r.estado}</td><td><a className="enlace" href={r.url} target="_blank" rel="noopener noreferrer">QR</a></td></tr>
            ))}</tbody></table>
        </section>
      )}
      {nodoAviso}
    </div>
  );
}
