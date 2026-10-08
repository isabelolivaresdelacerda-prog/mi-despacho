// Exportar todo el periodo a A3 o Sage (un ZIP o archivo a archivo) y dejarlo en la carpeta de la gestoría.
import { useMemo, useState } from "react";
import { paquete, zipDe, descargarBlob } from "./paquete.js";
import { descargarTexto } from "./datos.js";
import { DialogoCorreo } from "../../lib/CorreoUI.jsx";

export default function ExportarTodo({ d, diario, extra, r, config, raiz, aviso }) {
  const [formato, setFormato] = useState("a3");
  const [correo, setCorreo] = useState(false);
  const archivos = useMemo(() => paquete({ d, diario, extra, r, formato, config }), [d, diario, extra, r, formato, config]);
  const nombreZip = `Contabilidad ${r.corta} ${formato === "sage" ? "Sage" : "A3"}.zip`;
  const guardarEnCarpeta = async () => {
    let dir = raiz; for (const p of ["para la gestoria", r.corta]) dir = await dir.getDirectoryHandle(p, { create: true });
    for (const a of archivos) { const w = await (await dir.getFileHandle(a.nombre, { create: true })).createWritable(); await w.write(a.texto); await w.close(); }
    aviso?.(`Guardado en «para la gestoria › ${r.corta}»`);
  };
  return (
    <div className="tarjeta">
      <h2>Exportar todo · {r.etiqueta}</h2>
      <div className="as-opciones fila-opciones">
        <button type="button" className={formato === "a3" ? "on" : ""} onClick={() => setFormato("a3")}><strong>A3</strong> (A3ECO / A3ASESOR)</button>
        <button type="button" className={formato === "sage" ? "on" : ""} onClick={() => setFormato("sage")}><strong>Sage</strong> (Sage 50 / ContaPlus / Despachos)</button>
      </div>
      <div className="acciones">
        <button className="btn" type="button" onClick={async () => descargarBlob(await zipDe(archivos), nombreZip)}>Descargar todo (ZIP)</button>
        <button className="btn ghost" type="button" onClick={guardarEnCarpeta}>Guardar en la carpeta de la gestoría</button>
        <button className="btn ghost" type="button" onClick={() => setCorreo(true)}>Avisar a la gestoría por correo</button>
      </div>
      <ul className="lista-docs">{archivos.map((a) => <li key={a.nombre}><button className="enlace" type="button" onClick={() => descargarTexto(a.texto, a.nombre)}>{a.nombre}</button><span className="muted">{Math.max(1, Math.round(a.texto.length / 1024))} KB</span></li>)}</ul>
      <p className="muted pequeño">Incluye el diario con las subcuentas a 8 dígitos, el plan de subcuentas con el NIF de cada proveedor y cliente, los libros de facturas recibidas y emitidas, los impuestos, el extracto conciliado y la lista de pendientes. Cada versión de A3 y Sage tiene su asistente de importación: la primera vez, la gestoría indica qué columna es cada dato. Si te pasan un archivo de ejemplo de su programa, se puede generar exactamente en su formato.</p>
      {correo && <DialogoCorreo opciones={["contabilidad_lista", "documentacion_pendiente"]}
        vars={{ empresa: config?.empresa?.razon_social || config?.nombre || "", periodo: r.corta, remitente: config?.nombre || "", destinatario: "", enlace: "(carpeta compartida › para la gestoria)" }}
        adjuntos={archivos.filter((a) => /^(Diario|Libro|Impuestos)/.test(a.nombre)).map((a) => ({ nombre: a.nombre, blob: new Blob([a.texto], { type: "text/csv" }) }))}
        onCerrar={() => setCorreo(false)} />}
    </div>
  );
}
