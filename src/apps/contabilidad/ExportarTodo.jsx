// Exportar todo el periodo a A3 o Sage (un ZIP o archivo a archivo) y dejarlo en la carpeta de la gestoría.
import { useMemo, useState } from "react";
import { paquete, zipDe, descargarBlob } from "./paquete.js";
import { descargarTexto } from "./datos.js";
import { PROGRAMAS } from "./motor.js";
import { DialogoCorreo } from "../../lib/CorreoUI.jsx";

export default function ExportarTodo({ d, diario, extra, r, config, guardarConfig, raiz, aviso }) {
  const formato = config?.programaGestoria || "a3eco";
  const setFormato = (k) => guardarConfig?.({ ...config, programaGestoria: k, digitosGestoria: "" });
  const P = PROGRAMAS[formato] || PROGRAMAS.a3eco;
  const [correo, setCorreo] = useState(false);
  const archivos = useMemo(() => paquete({ d, diario, extra, r, formato, config }), [d, diario, extra, r, formato, config]);
  const nombreZip = `Contabilidad ${r.corta} ${P.nombre.split(" (")[0].replace(/[|/\\:*?"<>]/g, "").trim()}.zip`;
  const guardarEnCarpeta = async () => {
    let dir = raiz; for (const p of ["para la gestoria", r.corta]) dir = await dir.getDirectoryHandle(p, { create: true });
    for (const a of archivos) { const w = await (await dir.getFileHandle(a.nombre, { create: true })).createWritable(); await w.write(a.texto); await w.close(); }
    aviso?.(`Guardado en «para la gestoria › ${r.corta}»`);
  };
  return (
    <div className="tarjeta">
      <h2>Exportar todo · {r.etiqueta}</h2>
      <div className="rejilla-edit">
        <label className="mc-campo"><span>Programa de la gestoría</span><select value={formato} onChange={(e) => setFormato(e.target.value)}>{Object.entries(PROGRAMAS).map(([k, x]) => <option key={k} value={k}>{x.nombre}</option>)}</select></label>
        <label className="mc-campo"><span>Dígitos de las subcuentas</span><input inputMode="numeric" value={config?.digitosGestoria || P.digitos} onChange={(e) => guardarConfig?.({ ...config, digitosGestoria: e.target.value.replace(/\D/g, "").slice(0, 2) })} /></label>
      </div>
      <p className="muted pequeño">Se guarda para esta empresa. El diario sale con las columnas, la fecha ({P.fecha === "ymd" ? "aaaammdd" : "dd/mm/aaaa"}) y la longitud de subcuenta de {P.nombre}.</p>
      <div className="acciones">
        <button className="btn" type="button" onClick={async () => descargarBlob(await zipDe(archivos), nombreZip)}>Descargar todo (ZIP)</button>
        <button className="btn ghost" type="button" onClick={guardarEnCarpeta}>Guardar en la carpeta de la gestoría</button>
        <button className="btn ghost" type="button" onClick={() => setCorreo(true)}>Avisar a la gestoría por correo</button>
      </div>
      <ul className="lista-docs">{archivos.map((a) => <li key={a.nombre}><button className="enlace" type="button" onClick={() => descargarTexto(a.texto, a.nombre)}>{a.nombre}</button><span className="muted">{Math.max(1, Math.round(a.texto.length / 1024))} KB</span></li>)}</ul>
      <p className="muted pequeño">Incluye el diario, el plan de subcuentas con el NIF de cada proveedor y cliente, los libros de facturas recibidas y emitidas, los impuestos, el extracto conciliado y la lista de pendientes. Si la gestoría usa otro programa o una plantilla propia, que pase un archivo de ejemplo y se añade a la lista.</p>
      {correo && <DialogoCorreo opciones={["contabilidad_lista", "documentacion_pendiente"]}
        vars={{ empresa: config?.empresa?.razon_social || config?.nombre || "", periodo: r.corta, remitente: config?.nombre || "", destinatario: "", enlace: "(carpeta compartida › para la gestoria)" }}
        adjuntos={archivos.filter((a) => /^(Diario|Libro|Impuestos)/.test(a.nombre)).map((a) => ({ nombre: a.nombre, blob: new Blob([a.texto], { type: "text/csv" }) }))}
        onCerrar={() => setCorreo(false)} />}
    </div>
  );
}
