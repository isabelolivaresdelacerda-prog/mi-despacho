import { useState } from "react";
import { FormDespacho, FormNube } from "./Ajustes.jsx";
import { TIPOS } from "./almacen.js";

// Primera vez: nombre, logo y colores; después, dónde guarda sus documentos
export default function Bienvenida({ config, guardar }) {
  const [paso, setPaso] = useState(1);
  const [datos, setDatos] = useState(config);
  const cambiar = (c) => setDatos({ ...datos, ...c });

  return (
    <div className="bienvenida" style={{ "--brand": datos.color, "--fondo": datos.fondo }}>
      <div className="bienvenida-caja">
        <div className="eyebrow">Paso {paso} de 2</div>
        {paso === 1 ? (
          <>
            <h1>Bienvenida a tu despacho</h1>
            <p className="muted">Pon el nombre, el logo y los colores de tu despacho. Podrás cambiarlos cuando quieras en Ajustes.</p>
            <fieldset className="opciones"><legend>¿Qué eres?</legend>
              {Object.entries(TIPOS).map(([k, t]) => (
                <label key={k} className="opcion">
                  <input type="radio" name="tipo" checked={datos.tipo === k} onChange={() => cambiar({ tipo: k })} /> {t.nombre}
                </label>
              ))}
            </fieldset>
            <FormDespacho datos={datos} cambiar={cambiar} />
            <div className="vista-previa">
              {datos.logo ? <img className="logo-lateral" src={datos.logo} alt="" /> : <><span className="logo-letra">{(datos.nombre || "D").trim()[0]}</span>
              <strong>{datos.nombre || "Mi Despacho"}</strong></>}
            </div>
            <div className="acciones">
              <button className="btn" type="button" onClick={() => setPaso(2)}>Siguiente</button>
            </div>
          </>
        ) : (
          <>
            <h1>Tus documentos</h1>
            <p className="muted">Elige dónde guardas tus documentos. Si aún no tienes el enlace de la carpeta, puedes ponerlo después.</p>
            <FormNube datos={datos} cambiar={cambiar} />
            <div className="acciones">
              <button className="btn ghost" type="button" onClick={() => setPaso(1)}>Atrás</button>
              <button className="btn" type="button" onClick={() => guardar({ ...datos, configurado: true })}>Entrar en mi despacho</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
