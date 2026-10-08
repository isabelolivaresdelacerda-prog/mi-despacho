import { useEffect, useRef, useState } from "react";
import { NUBES, puedeGuardarDirecto, guardarEnNube, descargar, enlaceAbrir } from "./nube.js";
import { preguntarIA, tieneAlgunaGratis, leerClaves, guardarClaves, estadoLocal, leerModo } from "./ia-navegador.js";

// --- Aviso flotante ----------------------------------------------
export function useAviso() {
  const [msg, setMsg] = useState(null);
  const t = useRef();
  const mostrar = (m) => { setMsg(m); clearTimeout(t.current); t.current = setTimeout(() => setMsg(null), 2600); };
  const nodo = msg ? <div className="toast" role="status">{msg}</div> : null;
  return [mostrar, nodo];
}

// --- Ventana: "¿Quieres guardar el contrato en tu Drive?" ----------
// Se abre sola cada vez que se crea un documento.
export function GuardarEnNube({ abierto, blob, nombre, config, onCerrar, irAAjustes }) {
  const ref = useRef();
  const [estado, setEstado] = useState("pregunta"); // pregunta | guardando | hecho | error
  const [detalle, setDetalle] = useState("");
  const [enlace, setEnlace] = useState("");
  const nube = config.nube;
  const nombreNube = NUBES[nube].nombre;
  const carpeta = enlaceAbrir(config.carpetas.contratos);
  const directo = puedeGuardarDirecto(nube);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) { setEstado("pregunta"); setDetalle(""); setEnlace(""); d.showModal(); }
    if (!abierto && d.open) d.close();
  }, [abierto]);

  async function guardar() {
    if (!directo) {
      // Sin conexión directa: descarga y abre su carpeta para que lo arrastre
      if (carpeta) window.open(carpeta, "_blank", "noopener");
      descargar(blob, nombre);
      setEstado("hecho");
      setDetalle(carpeta
        ? `El Word se ha descargado y se ha abierto tu carpeta de ${nombreNube} en otra pestaña. Arrastra el archivo a la carpeta.`
        : `El Word se ha descargado. Para que se abra tu carpeta de ${nombreNube} automáticamente, pega su enlace en Ajustes.`);
      return;
    }
    setEstado("guardando");
    try {
      const url = await guardarEnNube(nube, blob, nombre);
      setEnlace(url || "");
      setEstado("hecho");
      setDetalle(`Guardado en tu ${nombreNube}, en la carpeta «Mi Despacho - Contratos».`);
    } catch (e) {
      setEstado("error");
      setDetalle((e && e.message) || `No se pudo guardar en ${nombreNube}.`);
    }
  }

  return (
    <dialog ref={ref} className="dlg" onClose={onCerrar} onCancel={onCerrar}>
      <div className="dlg-in">
        {estado === "pregunta" && (<>
          <h2>¿Quieres guardar el contrato en tu {NUBES[nube].corto}?</h2>
          <p className="muted">{nombre}</p>
          {!directo && <p className="nota">Se descargará el Word y se abrirá tu carpeta de {nombreNube} para que lo arrastres.</p>}
          <div className="dlg-acciones">
            <button className="btn ghost" type="button" onClick={onCerrar}>No, gracias</button>
            <button className="btn ghost" type="button" onClick={() => { descargar(blob, nombre); onCerrar(); }}>Solo descargar</button>
            <button className="btn" type="button" onClick={guardar} autoFocus>Sí, guardar en {NUBES[nube].corto}</button>
          </div>
        </>)}
        {estado === "guardando" && <><h2>Guardando…</h2><p className="muted">Si es la primera vez, {nombreNube} te pedirá permiso en una ventana.</p></>}
        {(estado === "hecho" || estado === "error") && (<>
          <h2>{estado === "hecho" ? "Listo" : "No se ha podido guardar"}</h2>
          <p>{detalle}</p>
          <div className="dlg-acciones">
            {estado === "error" && <button className="btn ghost" type="button" onClick={() => { descargar(blob, nombre); onCerrar(); }}>Descargar el Word</button>}
            {!carpeta && irAAjustes && <button className="btn ghost" type="button" onClick={() => { onCerrar(); irAAjustes(); }}>Ir a Ajustes</button>}
            {enlace && <a className="btn ghost" href={enlace} target="_blank" rel="noopener">Abrir el contrato</a>}
            <button className="btn" type="button" onClick={onCerrar}>Cerrar</button>
          </div>
        </>)}
      </div>
    </dialog>
  );
}

// --- Estado de la IA en el ordenador -------------------------------
export function EstadoIALocal({ compacto }) {
  const [estado, setEstado] = useState(null);
  const comprobar = () => { setEstado(null); estadoLocal().then(setEstado); };
  useEffect(comprobar, []);

  if (!estado) return <div className="ia-local">Comprobando la IA de tu ordenador…</div>;
  if (estado.ok) return (
    <div className="ia-local ok">
      <strong>IA en tu ordenador lista</strong> ({estado.modelo}). El contrato no sale de tu ordenador.
    </div>
  );
  if (estado.motivo === "cargando") return (
    <div className="ia-local falta">
      <p><strong>La IA de tu ordenador se está encendiendo.</strong> Espera unos segundos y pulsa <button className="enlace" type="button" onClick={comprobar}>Comprobar de nuevo</button>.</p>
    </div>
  );
  return (
    <div className="ia-local falta">
      <p><strong>La IA de tu ordenador está apagada o no está instalada.</strong></p>
      {!compacto && <p>Para que tus contratos no salgan de tu ordenador, la IA trabaja en él. No hace falta ninguna clave. Solo usa memoria mientras la tienes encendida: al cerrar su ventana, la memoria queda libre del todo.</p>}
      <p><strong>Si ya la tienes instalada:</strong> abre en tu escritorio <em>«IA local de Mi Despacho»</em>, espera a que diga que está lista y pulsa <button className="enlace" type="button" onClick={comprobar}>Comprobar de nuevo</button>.</p>
      <p><strong>Si es la primera vez:</strong></p>
      <ol>
        <li><a className="btn" href="/instalar-ia-local.bat" download>Descargar el instalador</a></li>
        <li>Ábrelo con doble clic. Si Windows avisa, pulsa <em>Más información → Ejecutar de todas formas</em>. Instala la IA con PowerShell, sin Ollama y sin nada que se quede funcionando de fondo.</li>
        <li>La primera vez descarga el modelo Gemma 4 (unos minutos). Cuando la ventana diga que está lista, pulsa <button className="enlace" type="button" onClick={comprobar}>Comprobar de nuevo</button>. Si el navegador pregunta por la red local, pulsa <em>Permitir</em>.</li>
      </ol>
      <p className="muted">Solo para Windows.</p>
    </div>
  );
}

// --- Revisión con IA (en tu ordenador; nube solo si lo permites en Ajustes) --
export function RevisionIA({ construirPrompt, irAAjustes }) {
  const [ctx, setCtx] = useState("");
  const [salida, setSalida] = useState(null);
  const [cargando, setCargando] = useState(false);
  const modo = leerModo();
  const [hayClave, setHayClave] = useState(tieneAlgunaGratis());
  const [claveRapida, setClaveRapida] = useState("");
  const [vuelta, setVuelta] = useState(0);

  function guardarClaveRapida() {
    if (!claveRapida.trim()) return;
    guardarClaves({ ...leerClaves(), gemini: claveRapida.trim() });
    setClaveRapida("");
    setHayClave(true);
  }

  async function revisar(permitirPago = false) {
    setCargando(true);
    setSalida({ texto: "Revisando en tu ordenador… puede tardar un minuto." });
    const r = await preguntarIA(construirPrompt(ctx), { permitirPago, maxTokens: 2500 });
    setCargando(false);
    if (r.estado === "ok") return setSalida({ texto: r.texto, ia: r.ia, dePago: r.dePago, local: r.local });
    if (r.estado === "local_no_disponible") { setVuelta(vuelta + 1); return setSalida({ error: true, texto: "La IA de tu ordenador está apagada. Enciéndela con «IA local de Mi Despacho» en tu escritorio (o instálala con los pasos de arriba) y vuelve a pulsar «Revisar el contrato»." }); }
    if (r.estado === "sin_claves") { setHayClave(false); return setSalida({ error: true, texto: "La IA de tu ordenador no está disponible y no hay claves para la nube.", ajustes: true }); }
    if (r.estado === "gratis_agotadas") {
      if (window.confirm("Las IA gratuitas están agotadas. ¿Usar Claude (de pago, con tu clave)?")) return revisar(true);
      return setSalida({ error: true, texto: "Las IA gratuitas están agotadas por ahora. Vuelve a intentarlo más tarde.", ajustes: true });
    }
    setSalida({ error: true, texto: "No se pudo completar la revisión: " + (r.intentos || []).join(" · ") });
  }

  return (
    <section className="ia">
      <div className="ia-cab">
        <div>
          <h2>Revisar con IA</h2>
          <p className="muted">La IA lee el borrador y el contexto que añadas, y señala riesgos y huecos. {modo === "local" ? "Trabaja en tu ordenador: el contrato no se envía a ningún sitio." : "Primero usa la IA de tu ordenador; si no está, la nube con tus claves."}</p>
        </div>
        <button className="btn" type="button" onClick={() => revisar(false)} disabled={cargando}>Revisar el contrato</button>
      </div>
      <EstadoIALocal key={vuelta} />
      {modo === "nube" && !hayClave && (
        <div className="clave-rapida">
          <p>Para usar la nube cuando la IA de tu ordenador no esté, pega tu clave gratuita de Google. <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Conseguir clave</a></p>
          <div className="fila-btn">
            <input type="password" value={claveRapida} onChange={(e) => setClaveRapida(e.target.value)} placeholder="AIza…" autoComplete="off" aria-label="Clave de Google" />
            <button className="btn" type="button" onClick={guardarClaveRapida}>Guardar</button>
          </div>
        </div>
      )}
      <label>Contexto del caso (opcional)
        <textarea value={ctx} onChange={(e) => setCtx(e.target.value)} placeholder="Por ejemplo: el partícipe es una sociedad extranjera; el negocio puede alargarse más de lo previsto…" />
      </label>
      {salida && (
        <div className={"ia-salida" + (salida.error ? " err" : "")}>
          {salida.texto}
          {salida.ia && <div className={"ia-quien" + (salida.dePago ? " pago" : "")}>Respuesta de {salida.ia}{salida.local ? " · no ha salido de tu ordenador" : salida.dePago ? " · de pago, en la nube" : " · en la nube"}</div>}
          {salida.ajustes && irAAjustes && <div><button className="btn ghost" type="button" onClick={irAAjustes}>Ir a Ajustes</button></div>}
        </div>
      )}
    </section>
  );
}
