import CarpetasEmpresa from "./lib/CarpetasUI.jsx";
import { PlantillasCorreo } from "./lib/CorreoUI.jsx";
import { useState } from "react";
import { PROVEEDORES, leerClaves, guardarClaves, borrarClaves, leerModo, guardarModo } from "./ia-navegador.js";
import { NUBES, puedeGuardarDirecto } from "./nube.js";
import { useAviso, EstadoIALocal } from "./comunes.jsx";
import { TIPOS } from "./almacen.js";

// Lee el logo como imagen reducida (para que quepa en el navegador)
export function leerLogo(archivo) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 320, k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = r.result;
    };
    r.onerror = reject;
    r.readAsDataURL(archivo);
  });
}

export function FormDespacho({ datos, cambiar }) {
  async function subirLogo(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    try { cambiar({ logo: await leerLogo(f) }); } catch { alert("No se ha podido leer la imagen. Prueba con un PNG o JPG."); }
  }
  return (
    <>
      <label>Nombre del despacho<input value={datos.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} maxLength={60} placeholder="Por ejemplo: Olivares Abogados" /></label>
      <div className="fila">
        <label>Color principal<input type="color" value={datos.color} onChange={(e) => cambiar({ color: e.target.value })} /></label>
        <label>Color de fondo<input type="color" value={datos.fondo} onChange={(e) => cambiar({ fondo: e.target.value })} /></label>
      </div>
      <label>Logo (PNG o JPG)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={subirLogo} /></label>
      {datos.logo && (
        <div className="logo-prev">
          <img src={datos.logo} alt="Tu logo" />
          <button className="btn ghost" type="button" onClick={() => cambiar({ logo: "" })}>Quitar logo</button>
        </div>
      )}
    </>
  );
}

export function FormNube({ datos, cambiar }) {
  const nube = datos.nube;
  const ayuda = nube === "google"
    ? "En Google Drive, haz clic derecho en la carpeta → Compartir → Copiar enlace, y pégalo aquí."
    : "En OneDrive, haz clic derecho en la carpeta → Compartir → Copiar vínculo, y pégalo aquí. Para verla dentro de la app (OneDrive personal), usa Insertar → Generar y pega el código.";
  const carpeta = (k, v) => cambiar({ carpetas: { ...datos.carpetas, [k]: v } });
  return (
    <>
      <fieldset className="opciones"><legend>¿Dónde guardas tus documentos?</legend>
        {Object.entries(NUBES).map(([k, n]) => (
          <label key={k} className="opcion">
            <input type="radio" name="nube" checked={nube === k} onChange={() => cambiar({ nube: k })} /> {n.nombre}
          </label>
        ))}
      </fieldset>
      <p className="muted">{ayuda}</p>
      <p className="nota"><strong>Al compartir, elige «Solo las personas añadidas»</strong> (o «Restringido») y añade a quien deba verla: tu equipo, tu gestoría o tu cliente. No uses «Cualquiera con el enlace»: tus contratos quedarían a la vista de quien consiga el enlace.</p>
      <label>Carpeta de contratos<input value={datos.carpetas.contratos} onChange={(e) => carpeta("contratos", e.target.value)} placeholder={nube === "google" ? "https://drive.google.com/drive/folders/…" : "https://onedrive.live.com/… o código <iframe>"} /></label>
      <label>Carpeta de contabilidad<input value={datos.carpetas.contabilidad} onChange={(e) => carpeta("contabilidad", e.target.value)} placeholder="Enlace a la carpeta (opcional)" /></label>
      <p className="nota">
        {puedeGuardarDirecto(nube)
          ? `Al crear un contrato, la app te preguntará si quieres guardarlo en tu ${NUBES[nube].nombre} y lo subirá ella sola.`
          : `Al crear un contrato, la app te preguntará si quieres guardarlo en tu ${NUBES[nube].nombre}: descargará el Word y abrirá tu carpeta para que lo arrastres.`}
      </p>
    </>
  );
}

function FormIA() {
  const [modo, setModo] = useState(leerModo());
  const [claves, setClaves] = useState(leerClaves());
  const [ver, setVer] = useState({});
  const [aviso, nodo] = useAviso();
  const cambiarModo = (m) => { setModo(m); guardarModo(m); };
  return (
    <>
      <fieldset className="opciones columna"><legend>¿Dónde trabaja la IA?</legend>
        <label className="opcion"><input type="radio" name="modo-ia" checked={modo === "local"} onChange={() => cambiarModo("local")} /> <span><strong>Solo en mi ordenador</strong> (recomendado). Los documentos no salen de tu ordenador.</span></label>
        <label className="opcion"><input type="radio" name="modo-ia" checked={modo === "nube"} onChange={() => cambiarModo("nube")} /> <span>En mi ordenador y, si no está, en la nube con mis claves.</span></label>
      </fieldset>
      <EstadoIALocal compacto />
      {modo === "nube" && (<>
        <p className="nota"><strong>Ojo con los datos personales:</strong> en la nube el texto sale de tu ordenador, y en los planes gratuitos el proveedor puede usarlo para mejorar sus productos. No lo uses con contratos con datos reales de clientes.</p>
        <p className="muted">Orden en la nube: Gemma 4 → Gemini Flash → gpt-oss → Llama → OpenRouter y, solo si se agotan todas, Claude (de pago, siempre te pregunta antes). Tus claves se guardan solo en este navegador.</p>
        {PROVEEDORES.map((p) => (
          <label key={p.id}>
            <span className="lbl-clave">{p.nombre} <span className={"etiqueta" + (p.gratis ? "" : " pago")}>{p.gratis ? "gratis" : "de pago"}</span> <a href={p.conseguir} target="_blank" rel="noopener">Conseguir clave</a></span>
            <span className="fila-btn">
              <input type={ver[p.id] ? "text" : "password"} value={claves[p.id] || ""} placeholder={p.ejemplo} autoComplete="off" spellCheck={false}
                onChange={(e) => setClaves({ ...claves, [p.id]: e.target.value.trim() })} />
              <button className="btn ghost" type="button" onClick={() => setVer({ ...ver, [p.id]: !ver[p.id] })}>{ver[p.id] ? "Ocultar" : "Ver"}</button>
            </span>
          </label>
        ))}
        <div className="acciones">
          <button className="btn" type="button" onClick={() => { guardarClaves(claves); aviso("Claves guardadas en este navegador"); }}>Guardar claves</button>
          <button className="btn ghost" type="button" onClick={() => { borrarClaves(); setClaves({}); aviso("Claves borradas"); }}>Borrar mis claves</button>
        </div>
      </>)}
      {nodo}
    </>
  );
}

export default function Ajustes({ config, guardar }) {
  const [datos, setDatos] = useState(config);
  const [aviso, nodo] = useAviso();
  const cambiar = (c) => setDatos({ ...datos, ...c });

  return (
    <div className="app">
      <header className="app-cab">
        <div>
          <div className="eyebrow">Ajustes</div>
          <h1>Mi despacho</h1>
          <p className="muted">Todo se guarda solo en este navegador.</p>
        </div>
      </header>

      <div className="tarjetas">
        <section className="tarjeta">
          <h2>Imagen del despacho</h2>
          <fieldset className="opciones"><legend>Tipo de cuenta</legend>
            {Object.entries(TIPOS).map(([k, t]) => (
              <label key={k} className="opcion">
                <input type="radio" name="tipo-aj" checked={datos.tipo === k} onChange={() => cambiar({ tipo: k })} /> {t.nombre}
              </label>
            ))}
          </fieldset>
          <FormDespacho datos={datos} cambiar={cambiar} />
          <button className="btn" type="button" onClick={() => { guardar(datos); aviso("Guardado"); }}>Guardar</button>
        </section>

        <section className="tarjeta">
          <h2>Mis documentos en la nube</h2>
          <FormNube datos={datos} cambiar={cambiar} />
          <button className="btn" type="button" onClick={() => { guardar(datos); aviso("Guardado"); }}>Guardar</button>
        </section>

        <CarpetasEmpresa config={datos} guardar={(c) => { setDatos(c); guardar({ ...config, sector: c.sector }); }} />

        <section className="tarjeta"><PlantillasCorreo /></section>

        <section className="tarjeta">
          <h2>Contabilidad</h2>
          <label>Dirección de mi app de contabilidad<input value={datos.appContabilidad} onChange={(e) => cambiar({ appContabilidad: e.target.value })} placeholder="http://127.0.0.1:5000" /></label>
          <p className="muted">Si tu app de contabilidad funciona en tu ordenador, tiene que estar abierta para verla aquí.</p>
          <button className="btn" type="button" onClick={() => { guardar(datos); aviso("Guardado"); }}>Guardar</button>
        </section>

        <section className="tarjeta">
          <h2>Apps contratadas</h2>
          <ul className="contratadas">
            <li><span className={datos.apps.contabilidad ? "si" : "no"}>{datos.apps.contabilidad ? "✓" : "–"}</span> Contabilidad</li>
            <li><span className={datos.apps.contratos ? "si" : "no"}>{datos.apps.contratos ? "✓" : "–"}</span> Contratos</li>
          </ul>
          <p className="muted">Para contratar o dar de baja apps, escribe a mi.despacho.</p>
        </section>

        <section className="tarjeta">
          <h2>Inteligencia artificial</h2>
          <FormIA />
        </section>
      </div>
      {nodo}
    </div>
  );
}
