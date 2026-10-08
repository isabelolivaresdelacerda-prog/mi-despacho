import { NUBES, enlaceIncrustable, enlaceAbrir } from "../nube.js";

// Muestra dentro de la app la carpeta de Drive u OneDrive de la usuaria
export default function Carpeta({ titulo, eyebrow, enlace, nube, irAAjustes }) {
  const nombreNube = NUBES[nube].nombre;
  const incrustado = enlaceIncrustable(enlace);
  const abrir = enlaceAbrir(enlace);

  return (
    <div className="app">
      <header className="app-cab">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h1>{titulo}</h1>
          <p className="muted">Tus documentos siguen en tu {nombreNube}. La app solo te los enseña aquí.</p>
        </div>
        <div className="acciones">
          {abrir && <a className="btn" href={abrir} target="_blank" rel="noopener">Abrir en {NUBES[nube].corto}</a>}
          <button className="btn ghost" type="button" onClick={irAAjustes}>Cambiar carpeta</button>
        </div>
      </header>

      {!enlace && (
        <div className="vacio">
          <p><strong>Aún no has conectado tu carpeta.</strong></p>
          <p>Ve a Ajustes y pega el enlace de tu carpeta de {nombreNube}.</p>
          <button className="btn" type="button" onClick={irAAjustes}>Ir a Ajustes</button>
        </div>
      )}

      {enlace && incrustado && (
        <>
          <iframe className="marco-nube" src={incrustado} title={titulo} />
          <p className="muted pie">Si no ves la carpeta, es que tu navegador bloquea la vista incrustada o no has iniciado sesión en {nombreNube}. Pulsa «Abrir en {NUBES[nube].corto}».</p>
        </>
      )}

      {enlace && !incrustado && (
        <div className="vacio">
          <p>Tu carpeta está lista para abrirse en otra pestaña.</p>
          <a className="btn" href={abrir} target="_blank" rel="noopener">Abrir mi carpeta en {nombreNube}</a>
          {nube === "onedrive" && (
            <p className="muted">Para verla aquí dentro: en OneDrive, haz clic derecho en la carpeta → <em>Insertar</em> → <em>Generar</em>, copia el código y pégalo en Ajustes. (Con cuentas de OneDrive de empresa, Microsoft no siempre lo permite; entonces se abre en otra pestaña.)</p>
          )}
        </div>
      )}
    </div>
  );
}
