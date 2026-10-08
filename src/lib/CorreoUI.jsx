// Componentes de correo: diálogo para enviar (abre Outlook) y editor de plantillas (para Ajustes).
import { useState } from "react";
import { plantillas, guardarPlantilla, restaurarPlantilla, rellenarPlantilla, abrirCorreo, mayus } from "./correo.js";
import "./correo.css";

// Diálogo "Enviar por correo". `opciones`: ids de plantilla que tienen sentido aquí.
export function DialogoCorreo({ opciones, vars, para: paraInicial = "", adjuntos = [], onCerrar }) {
  const todas = plantillas();
  const [id, setId] = useState(opciones[0]);
  const [para, setPara] = useState(paraInicial);
  const [cc, setCc] = useState("");
  const [hecho, setHecho] = useState("");
  const p = todas[id];

  const abrir = async () => {
    const modo = await abrirCorreo({ plantilla: id, vars, para, cc, adjuntos: await Promise.all(adjuntos.map(async a => ({ nombre: a.nombre, blob: typeof a.blob === "function" ? await a.blob() : a.blob }))) });
    setHecho(modo === "eml"
      ? "Se ha descargado el borrador. Ábrelo: Outlook lo muestra como un correo nuevo con el adjunto, listo para revisar y enviar."
      : "Se ha abierto tu programa de correo con el mensaje redactado. Revísalo y pulsa Enviar.");
  };

  return (
    <div className="mc-fondo" role="dialog" aria-modal="true" aria-labelledby="mc-t">
      <div className="mc-dialogo">
        <header><h2 id="mc-t">Enviar por correo</h2><button className="mc-x" onClick={onCerrar} aria-label="Cerrar">×</button></header>
        <div className="mc-cuerpo">
          {opciones.length > 1 && (
            <label className="mc-campo"><span>Mensaje</span>
              <select value={id} onChange={e => setId(e.target.value)}>{opciones.map(o => <option key={o} value={o}>{todas[o].nombre}</option>)}</select>
            </label>
          )}
          <label className="mc-campo"><span>Para</span><input type="email" value={para} onChange={e => setPara(e.target.value)} placeholder="correo@empresa.com" /></label>
          <label className="mc-campo"><span>CC (opcional)</span><input value={cc} onChange={e => setCc(e.target.value)} /></label>
          <div className="mc-vista">
            <p className="mc-asunto">{mayus(rellenarPlantilla(p.asunto, vars))}</p>
            <pre>{rellenarPlantilla(p.cuerpo, vars)}</pre>
            {adjuntos.length > 0 && <p className="mc-adj">Adjunto: {adjuntos.map(a => a.nombre).join(", ")}</p>}
          </div>
          <p className="mc-nota">Podrás cambiar el texto en Outlook antes de enviarlo. Para cambiar el texto de base para siempre, ve a Ajustes → Plantillas de correo.</p>
          {hecho && <p className="mc-ok">{hecho}</p>}
        </div>
        <footer>
          <button className="mc-btn sec" onClick={onCerrar}>Cerrar</button>
          <button className="mc-btn" onClick={abrir}>Abrir en Outlook</button>
        </footer>
      </div>
    </div>
  );
}

// Editor de plantillas (para la pantalla de Ajustes)
export function PlantillasCorreo() {
  const [todas, setTodas] = useState(plantillas());
  const [id, setId] = useState(Object.keys(todas)[0]);
  const [asunto, setAsunto] = useState(todas[id].asunto);
  const [cuerpo, setCuerpo] = useState(todas[id].cuerpo);
  const elegir = k => { setId(k); setAsunto(todas[k].asunto); setCuerpo(todas[k].cuerpo); };
  const guardarla = () => { guardarPlantilla(id, { asunto, cuerpo }); setTodas(plantillas()); };
  const original = () => { restaurarPlantilla(id); const t = plantillas(); setTodas(t); setAsunto(t[id].asunto); setCuerpo(t[id].cuerpo); };

  return (
    <section className="mc-editor">
      <h3>Plantillas de correo</h3>
      <p className="mc-nota">Texto que se usa al enviar desde Mi Despacho. Puedes usar: {"{{destinatario}} {{remitente}} {{empresa}} {{documento}} {{periodo}} {{enlace}} {{fecha}}"}.</p>
      <label className="mc-campo"><span>Plantilla</span>
        <select value={id} onChange={e => elegir(e.target.value)}>
          {Object.entries(todas).map(([k, v]) => <option key={k} value={k}>{v.nombre}{v.modificada ? " (modificada)" : ""}</option>)}
        </select>
      </label>
      <label className="mc-campo"><span>Asunto</span><input value={asunto} onChange={e => setAsunto(e.target.value)} /></label>
      <label className="mc-campo"><span>Texto</span><textarea rows={10} value={cuerpo} onChange={e => setCuerpo(e.target.value)} /></label>
      <div className="mc-acciones">
        <button className="mc-btn" onClick={guardarla}>Guardar plantilla</button>
        {todas[id].modificada && <button className="mc-btn sec" onClick={original}>Volver al texto original</button>}
      </div>
    </section>
  );
}
