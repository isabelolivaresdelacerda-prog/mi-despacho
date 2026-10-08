// Carpeta dentro de Mi Despacho: OneDrive/Drive incrustado (si hay enlace de inserción) y la vista de la carpeta en el ordenador.
import { useState } from "react";
import { NUBES, enlaceIncrustable, enlaceAbrir } from "../nube.js";
import Explorador from "./Explorador.jsx";

export default function VistaCarpeta({ titulo, eyebrow, enlace, nube = "onedrive", contabilidad = false, config }) {
  const incrustado = enlaceIncrustable(enlace);
  const abrir = enlaceAbrir(enlace);
  const [vista, setVista] = useState(incrustado ? "nube" : "pc");
  const N = NUBES[nube] || NUBES.onedrive;
  return (
    <div>
      <div className="app vista-carpeta-barra">
        <nav className="cont-tabs" role="tablist">
          <button role="tab" aria-selected={vista === "nube"} className={vista === "nube" ? "on" : ""} onClick={() => setVista("nube")}>En {N.nombre}</button>
          <button role="tab" aria-selected={vista === "pc"} className={vista === "pc" ? "on" : ""} onClick={() => setVista("pc")}>En mi ordenador</button>
        </nav>
      </div>
      {vista === "pc" ? <Explorador titulo={titulo} eyebrow={eyebrow} contabilidad={contabilidad} config={config} /> : (
        <div className="app">
          <header className="app-cab">
            <div><div className="eyebrow">{eyebrow}</div><h1>{titulo}</h1><p className="muted">Tu carpeta de {N.nombre}, dentro de Mi Despacho.</p></div>
            <div className="acciones">{abrir && <a className="btn ghost" href={abrir} target="_blank" rel="noopener">Abrir en {N.corto}</a>}<a className="btn ghost" href="#/ajustes">Cambiar enlace</a></div>
          </header>
          {incrustado ? <iframe className="marco-nube" src={incrustado} title={titulo} /> : (
            <div className="vacio">
              {!enlace ? <p><strong>Para verla aquí, pega en Ajustes el código de inserción de la carpeta.</strong></p> : <p><strong>Ese enlace no se puede mostrar dentro de la app.</strong></p>}
              {nube === "onedrive"
                ? <p>En OneDrive (web), selecciona la carpeta → botón derecho → <em>Insertar</em> → <em>Generar</em>, copia el código <code>&lt;iframe…&gt;</code> y pégalo en Ajustes → Mis documentos en la nube. Un enlace normal de «Compartir» (1drv.ms/…) no sirve para verla dentro.</p>
                : <p>En Google Drive, copia el enlace de la carpeta (drive.google.com/drive/folders/…) y pégalo en Ajustes.</p>}
              {abrir && <a className="btn" href={abrir} target="_blank" rel="noopener">Abrir en {N.corto}</a>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
