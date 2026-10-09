// Papelería corporativa: la empresa elige uno de los 4 estilos y queda fijo para sus documentos
// (hoja corporativa y plantilla de informe en Word, facturas en PDF). Se puede cambiar, pero pide confirmación.
import { useState } from "react";
import { ESTILOS, textoLegal, docxCorporativo, facturaPDF, facturaExcel } from "./lib/papeleria.js";
import { pilaCSS } from "./lib/marca.js";
import { useAviso } from "./comunes.jsx";

const descargar = (blob, nombre) => { const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 3000); };

// Miniatura HTML de cada documento (A4 a escala), con el mismo aspecto que el Word/PDF
function Mini({ estilo, tipo, config }) {
  const e = config.empresa || {}, c = config.color || "#7A1F2B", nombre = e.razon_social || config.nombre || "Tu empresa", L = textoLegal(e);
  const logo = config.logo ? <img src={config.logo} alt="" /> : null;
  const cab = {
    clasico: <div className="pm-cab pm-clasico" style={{ borderColor: c }}>{logo}<b style={{ color: c }}>{nombre}</b></div>,
    moderno: <div className="pm-cab pm-moderno" style={{ borderColor: c }}>{logo || <b style={{ color: c }}>{nombre}</b>}<span><b>{nombre}</b><small>{e.web || e.email || "www.tuempresa.com"}</small></span></div>,
    minimal: <div className="pm-cab pm-minimal">{logo}<span>{nombre}</span></div>,
    ejecutivo: <div className="pm-cab pm-ejecutivo" style={{ background: c }}>{logo}<b>{nombre}</b></div>,
  }[estilo];
  const pie = <div className={"pm-pie pm-pie-" + estilo} style={estilo === "ejecutivo" ? { background: c } : estilo === "moderno" ? { borderColor: c } : {}}>{L.linea1 || "Razón social · CIF · domicilio"}</div>;
  const cuerpo = tipo === "carta"
    ? <div className="pm-cuerpo"><p className="pm-der">Madrid, 9 de octubre de 2026</p><p><b>Destinatario</b><br />Empresa · Dirección</p><p><b>Asunto:</b> …</p><i /><i /><i /><i className="corta" /><p>Atentamente,</p></div>
    : tipo === "informe"
      ? <div className="pm-cuerpo pm-portada"><small style={{ color: c }}>INFORME</small><strong style={{ color: estilo === "ejecutivo" ? c : undefined }}>Título del informe</strong><span>Subtítulo o asunto</span></div>
      : <div className="pm-cuerpo"><div className="pm-fact-t" style={{ color: estilo === "minimal" ? undefined : c }}>FACTURA</div><div className="pm-fact-dos"><span><b>Emisor</b><br />{nombre}</span><span><b>Cliente</b><br />Cliente S.L.</span></div><div className="pm-fact-tabla" style={estilo === "moderno" || estilo === "ejecutivo" ? { background: c } : { borderColor: c }} /><i /><i /><div className="pm-fact-total" style={estilo === "moderno" || estilo === "ejecutivo" ? { background: c, color: "#fff" } : {}}>TOTAL 1.210,00 €</div></div>;
  return <div className={"pm-hoja pm-" + estilo} style={{ "--pm-c": c, ...(config.marca?.fuenteTxt ? { fontFamily: pilaCSS(config.marca.fuenteTxt) } : {}) }}>{estilo === "moderno" && <span className="pm-franja" style={{ background: c }} />}{cab}{cuerpo}{pie}</div>;
}

export default function Papeleria({ config, guardar }) {
  const [aviso, nodoAviso] = useAviso();
  const [ocupado, setOcupado] = useState("");
  const elegido = config.papeleria;
  const datos = { empresa: { razon_social: config.nombre, ...(config.empresa || {}) }, color: config.color, logo: config.logo, marca: config.marca || {} };
  const faltan = !datos.empresa.cif || !datos.empresa.domicilio;
  const elegir = (id) => {
    if (elegido && elegido !== id && !confirm(`Tu empresa ya usa el estilo «${ESTILOS[elegido].nombre}». ¿Cambiarlo por «${ESTILOS[id].nombre}» para todos los documentos nuevos?`)) return;
    guardar({ ...config, papeleria: id }); aviso(`Estilo «${ESTILOS[id].nombre}» fijado para ${datos.empresa.razon_social || "tu empresa"}`);
  };
  const bajar = async (tipo) => {
    setOcupado(tipo);
    try {
      const est = elegido || "clasico", base = (datos.empresa.razon_social || "Empresa").trim();
      if (tipo === "factura-excel") descargar(await facturaExcel({ estilo: est, ...datos }), `${base} - plantilla de factura.xlsx`);
      else if (tipo === "factura") {
        const bytes = await facturaPDF({ estilo: est, ...datos, factura: { serie: "A", numero: "2026-001", fecha: new Date().toLocaleDateString("es-ES"), cliente: { nombre: "Cliente de ejemplo, S.L.", nif: "B00000000", domicilio: "Calle Ejemplo 1, Madrid" }, lineas: [{ concepto: "Servicios de asesoramiento (ejemplo)", cantidad: 1, precio: 1000, iva: 21 }] } });
        descargar(new Blob([bytes], { type: "application/pdf" }), `${base} - factura (ejemplo).pdf`);
      } else descargar(await docxCorporativo({ tipo, estilo: est, ...datos }), `${base} - ${tipo === "carta" ? "hoja corporativa" : "plantilla de informe"}.docx`);
    } catch (e) { aviso("No se pudo generar: " + (e.message || e)); }
    setOcupado("");
  };
  return (
    <div className="app">
      <header className="app-cab">
        <div>
          <div className="eyebrow">Documentos</div>
          <h1>Papelería corporativa</h1>
          <p className="muted">Elige el estilo de tu empresa: se queda fijo para la hoja corporativa, los informes y las facturas. Usa tu logo, tu color y tus datos legales de <a href="#/ajustes">Ajustes › Empresa</a>.</p>
        </div>
      </header>
      {faltan && <p className="nota">Faltan datos de la empresa (CIF o domicilio) para el pie legal. Complétalos en <a href="#/ajustes">Ajustes › Empresa</a>.</p>}
      {elegido && (
        <section className="tarjeta pap-elegido">
          <h2>Tu estilo: {ESTILOS[elegido].nombre}</h2>
          <p className="muted">Descarga tus plantillas ya preparadas con tu logo, tus colores, tu tipografía y tus datos. La factura en Excel calcula sola importes, IVA por tipo, retención y total.</p>
          <div className="acciones">
            <button className="btn" type="button" disabled={!!ocupado} onClick={() => bajar("carta")}>{ocupado === "carta" ? "Preparando…" : "Hoja corporativa (Word)"}</button>
            <button className="btn" type="button" disabled={!!ocupado} onClick={() => bajar("informe")}>{ocupado === "informe" ? "Preparando…" : "Plantilla de informe (Word)"}</button>
            <button className="btn" type="button" disabled={!!ocupado} onClick={() => bajar("factura-excel")}>{ocupado === "factura-excel" ? "Preparando…" : "Plantilla de factura (Excel)"}</button>
            <button className="btn ghost" type="button" disabled={!!ocupado} onClick={() => bajar("factura")}>{ocupado === "factura" ? "Preparando…" : "Factura de ejemplo (PDF)"}</button>
          </div>
        </section>
      )}
      <div className="pap-estilos">
        {Object.entries(ESTILOS).map(([id, s]) => (
          <section key={id} className={"tarjeta pap-estilo" + (elegido === id ? " elegido" : elegido ? " apagado" : "")}>
            <div className="pap-cab"><h2>{s.nombre}</h2>{elegido === id && <span className="pap-sello">✓ Estilo de tu empresa</span>}</div>
            <p className="muted pequeño">{s.desc}</p>
            <div className="pap-minis">
              {[["carta", "Hoja corporativa"], ["informe", "Informe"], ["factura", "Factura"]].map(([t, n]) => <figure key={t}><Mini estilo={id} tipo={t} config={config} /><figcaption>{n}</figcaption></figure>)}
            </div>
            {elegido !== id && <button className="btn" type="button" onClick={() => elegir(id)}>{elegido ? "Cambiar a este estilo" : "Elegir este estilo"}</button>}
          </section>
        ))}
      </div>
      {nodoAviso}
    </div>
  );
}
