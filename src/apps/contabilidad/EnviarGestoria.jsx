// "Enviar a la gestoría": comprueba el contrato de encargo, deja el paquete del periodo en la carpeta compartida
// (la gestoría lo ve al momento) y abre Outlook con el aviso.
import { useMemo, useState } from "react";
import { estadoEncargo, marcarFirmadoFuera } from "../../lib/encargoEstado.js";
import { DialogoCorreo } from "../../lib/CorreoUI.jsx";
import { leerJSON, escribirJSON, leerVinculados } from "./datos.js";
import { paquete } from "./paquete.js";
import { enRango, noPagada } from "./periodo.js";

async function escribirArchivo(raiz, ruta, nombre, texto) {
  let d = raiz;
  for (const p of ruta) d = await d.getDirectoryHandle(p, { create: true });
  const w = await (await d.getFileHandle(nombre, { create: true })).createWritable();
  await w.write(texto); await w.close();
}

export default function EnviarGestoria({ raiz, empresa, datos, diario, extra, r, config, onCerrar, aviso }) {
  const [enc, setEnc] = useState(estadoEncargo);
  const [seguir, setSeguir] = useState(false);
  const [fuera, setFuera] = useState({ abierto: false, gestoria: enc.gestoria || "", fecha: "" });
  const [hecho, setHecho] = useState(null);
  const [correo, setCorreo] = useState(false);
  const [formato, setFormato] = useState(config?.formatoGestoria || "a3");
  const firmado = enc.estado === "firmado";
  const fact = datos.facturas.filter((f) => enRango(f.fecha, r));
  const etiqueta = r.corta;
  const sinRevisar = fact.filter((f) => !f._leida || (f.analizado_ia && !f._editada));
  const pendientes = fact.filter((f) => f.total && noPagada(f, datos));

  const enviar = async () => {
    const ruta = ["para la gestoria", etiqueta];
    for (const a of paquete({ d: datos, diario, extra, r, formato, config })) await escribirArchivo(raiz, ruta, a.nombre, a.texto);
    // Copia de las escrituras y contratos vinculados que la gestoría aún no tiene (los originales siguen en su carpeta)
    const vinc = await leerVinculados(raiz);
    const previos = await leerJSON(raiz, "envios_gestoria.json", []);
    const yaCopiados = new Set(previos.flatMap((e) => e.vinculados_copiados || []));
    const copiados = [];
    for (const v of vinc.filter((x) => !yaCopiados.has(x.id))) {
      try {
        let d = empresa; for (const p of v.ruta) d = await d.getDirectoryHandle(p);
        const f = await (await d.getFileHandle(v.archivo)).getFile();
        let dd = raiz; for (const p of ["para la gestoria", "escrituras y contratos"]) dd = await dd.getDirectoryHandle(p, { create: true });
        const w = await (await dd.getFileHandle(v.archivo, { create: true })).createWritable(); await w.write(f); await w.close();
        copiados.push(v.id);
      } catch { /* si se ha movido el original, se avisa en el resumen */ }
    }
    previos.push({ vinculados_copiados: copiados, periodo: etiqueta, formato, fecha: new Date().toISOString(), facturas: fact.length, sin_revisar: sinRevisar.length, contrato_encargo: enc.estado, sin_contrato_aceptado: !firmado });
    await escribirJSON(raiz, "envios_gestoria.json", previos);
    setHecho(ruta.join(" › "));
    aviso?.("Paquete guardado en la carpeta compartida");
  };

  return (
    <div className="mc-fondo" role="dialog" aria-modal="true" aria-labelledby="eg-t">
      <div className="mc-dialogo">
        <header><h2 id="eg-t">Enviar a la gestoría</h2><button className="mc-x" onClick={onCerrar} aria-label="Cerrar">×</button></header>
        <div className="mc-cuerpo">
          <div className={"encargo " + (firmado ? "ok" : "mal")}>
            {firmado ? (
              <p>✓ <strong>Contrato de encargo del tratamiento firmado</strong>{enc.gestoria ? ` con ${enc.gestoria}` : ""}{enc.fecha ? ` (${enc.fecha})` : ""} · {enc.origen}.</p>
            ) : (
              <>
                <p>⚠ <strong>{enc.estado === "a_medias" ? "El contrato de encargo del tratamiento está firmado solo por una parte." : "No consta firmado el contrato de encargo del tratamiento con la gestoría."}</strong></p>
                <p className="mc-nota">La gestoría trata datos personales por cuenta de tu empresa (proveedores, clientes, cuentas bancarias…). El RGPD (art. 28) exige un contrato firmado antes de darle acceso.</p>
                <div className="mc-acciones">
                  <a className="mc-btn" href="#/contratos/crear/encargo-tratamiento" onClick={onCerrar}>{enc.estado === "no_existe" ? "Preparar el contrato" : "Ir a firmarlo"}</a>
                  <button className="mc-btn sec" type="button" onClick={() => setFuera({ ...fuera, abierto: !fuera.abierto })}>Ya lo firmé fuera de Mi Despacho</button>
                </div>
                {fuera.abierto && (
                  <div className="mc-acciones" style={{ marginTop: 10 }}>
                    <label className="mc-campo"><span>Gestoría</span><input value={fuera.gestoria} onChange={(e) => setFuera({ ...fuera, gestoria: e.target.value })} /></label>
                    <label className="mc-campo"><span>Fecha de firma</span><input type="date" value={fuera.fecha} onChange={(e) => setFuera({ ...fuera, fecha: e.target.value })} /></label>
                    <button className="mc-btn" type="button" disabled={!fuera.gestoria.trim() || !fuera.fecha} onClick={() => { marcarFirmadoFuera({ gestoria: fuera.gestoria.trim(), email: enc.email, fecha: fuera.fecha.split("-").reverse().join("/") }); setEnc(estadoEncargo()); }}>Confirmar</button>
                  </div>
                )}
                <label className="ce-check" style={{ marginTop: 10, display: "flex", gap: 8 }}><input type="checkbox" checked={seguir} onChange={(e) => setSeguir(e.target.checked)} /> Entiendo el riesgo y quiero enviarlo igualmente (quedará registrado).</label>
              </>
            )}
          </div>

          {(firmado || seguir) && (
            <>
              <p><strong>Periodo: {r.etiqueta}</strong> <span className="muted pequeño">(se cambia arriba, en el selector de periodo)</span></p>
              <label className="mc-campo"><span>Programa de la gestoría</span><select value={formato} onChange={(e) => setFormato(e.target.value)}><option value="a3">A3</option><option value="sage">Sage / ContaPlus</option></select></label>
              <p className="mc-nota">{fact.length} facturas · {pendientes.length} pendientes de pago{sinRevisar.length ? ` · ${sinRevisar.length} sin revisar` : ""}. Se guardarán el diario para {formato === "sage" ? "Sage" : "A3"}, el plan de subcuentas, los libros de facturas, los impuestos, el extracto conciliado y lo pendiente en <strong>para la gestoria › {etiqueta}</strong>, dentro de la carpeta compartida: la gestoría lo verá al momento.</p>
              {hecho && <p className="mc-ok">Hecho: guardado en {hecho}. Ahora puedes avisar a la gestoría por correo.</p>}
            </>
          )}
        </div>
        <footer>
          <button className="mc-btn sec" onClick={onCerrar}>Cerrar</button>
          {(firmado || seguir) && !hecho && <button className="mc-btn" onClick={enviar}>Enviar a la gestoría</button>}
          {hecho && <button className="mc-btn" onClick={() => setCorreo(true)}>Avisar por correo (Outlook)</button>}
        </footer>
      </div>
      {correo && <DialogoCorreo opciones={["contabilidad_lista"]} para={enc.email || ""}
        vars={{ empresa: config?.empresa?.razon_social || config?.nombre || "", periodo: etiqueta, remitente: config?.nombre || "", destinatario: "", enlace: config?.carpetas?.contabilidad || "(carpeta compartida › para la gestoria)" }}
        onCerrar={() => setCorreo(false)} />}
    </div>
  );
}
