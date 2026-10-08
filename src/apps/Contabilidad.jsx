// Contabilidad: abre la app de contabilidad de la usuaria (por ejemplo, la que tiene en su ordenador)
export default function Contabilidad({ direccion, irAAjustes }) {
  return (
    <div className="app">
      <header className="app-cab">
        <div>
          <div className="eyebrow">Contabilidad</div>
          <h1>Mi contabilidad</h1>
          <p className="muted">Tu app de contabilidad, dentro de Mi Despacho.</p>
        </div>
        <div className="acciones">
          {direccion && <a className="btn" href={direccion} target="_blank" rel="noopener">Abrir en otra pestaña</a>}
          <button className="btn ghost" type="button" onClick={irAAjustes}>Cambiar dirección</button>
        </div>
      </header>

      {!direccion ? (
        <div className="vacio">
          <p><strong>Aún no has indicado dónde está tu app de contabilidad.</strong></p>
          <p>Si la tienes en tu ordenador, suele ser <code>http://127.0.0.1:5000</code>. Ponla en Ajustes.</p>
          <button className="btn" type="button" onClick={irAAjustes}>Ir a Ajustes</button>
        </div>
      ) : (
        <>
          <iframe className="marco-nube" src={direccion} title="Contabilidad" />
          <p className="muted pie">Si no se ve nada, comprueba que tu app de contabilidad está abierta en tu ordenador y pulsa «Abrir en otra pestaña».</p>
        </>
      )}
    </div>
  );
}
