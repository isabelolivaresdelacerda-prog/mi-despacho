import { useEffect, useMemo, useRef, useState } from "react";
import { generarContratoPDF, generarPDFFirmado, sha256Hex } from "./pdf.js";
import { bloquesEncargo } from "./bloques.js";
import { VERSION_CONTRATO, TIPOS } from "./modelo.js";
import { bloquesADocx, bloquesATexto } from "../../docx.js";
import { GuardarEnNube, RevisionIA, useAviso } from "../../comunes.jsx";
import { EditorClausulas, VistaDocumento, aplicarCambios, leerCambios } from "../../lib/contratoUI.jsx";
import { guardar as guardarEnCarpeta, raizGuardada, DESTINO } from "../../lib/carpetas.js";
import { DialogoCorreo } from "../../lib/CorreoUI.jsx";

const CLAVE = "md-contrato-encargo-v2"; // la lee también lib/encargoEstado.js
const CLAVE_CAMBIOS = "md-encargo-clausulas";

const PARTE_VACIA = { razon_social: "", nif: "", domicilio: "", email_rgpd: "", firmante_nombre: "", firmante_dni: "", firmante_cargo: "" };
const VACIO = {
  resp: { ...PARTE_VACIA },
  enc: { ...PARTE_VACIA, dpd: "" },
  tipo: "gestoria",
  servicios: TIPOS.gestoria.servicios,
  laboral: false,
  intercambio: "carpeta",
  almacenamiento: "OneDrive",
  tratamientos_otro: "", interesados_otro: "", datos_otro: "",
  subencargados: "El Encargado no recurre a subencargados distintos de los proveedores de almacenamiento y comunicaciones del propio Responsable.",
  plataforma: { nombre: "Mi Despacho", titular: "" },
  jurisdiccion: "",
  lugar: "",
};

// ---------- utilidades ----------
const leer = () => { try { return JSON.parse(localStorage.getItem(CLAVE)); } catch { return null; } };
const guardarLocal = v => { try { localStorage.setItem(CLAVE, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };
const b64 = bytes => { let s = ""; bytes.forEach(b => (s += String.fromCharCode(b))); return btoa(s); };
const deB64 = t => Uint8Array.from(atob(t), c => c.charCodeAt(0));
const normal = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

// Validación de NIF/NIE/CIF españoles
function docValido(v) {
  const s = String(v || "").toUpperCase().replace(/[\s-]/g, "");
  const letras = "TRWAGMYFPDXBNJZSQVHLCKE";
  if (/^\d{8}[A-Z]$/.test(s)) return letras[+s.slice(0, 8) % 23] === s[8];
  if (/^[XYZ]\d{7}[A-Z]$/.test(s)) return letras[+("XYZ".indexOf(s[0]) + s.slice(1, 8)) % 23] === s[8];
  if (/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(s)) {
    const d = s.slice(1, 8).split("").map(Number);
    let suma = 0;
    d.forEach((n, i) => { if (i % 2 === 0) { const x = n * 2; suma += Math.floor(x / 10) + (x % 10); } else suma += n; });
    const c = (10 - (suma % 10)) % 10;
    return s[8] === String(c) || s[8] === "JABCDEFGHI"[c];
  }
  return false;
}
const emailValido = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || ""));

function errores(d) {
  const e = {};
  for (const k of ["resp", "enc"]) {
    const p = d[k];
    if (!p.razon_social.trim()) e[`${k}.razon_social`] = "Obligatorio";
    if (!docValido(p.nif)) e[`${k}.nif`] = "NIF no válido";
    if (!p.domicilio.trim()) e[`${k}.domicilio`] = "Obligatorio";
    if (!emailValido(p.email_rgpd)) e[`${k}.email_rgpd`] = "Email no válido";
    if (!p.firmante_nombre.trim()) e[`${k}.firmante_nombre`] = "Obligatorio";
    if (!docValido(p.firmante_dni)) e[`${k}.firmante_dni`] = "DNI/NIE no válido";
    if (!p.firmante_cargo.trim()) e[`${k}.firmante_cargo`] = "Obligatorio";
  }
  if (!d.servicios.trim()) e.servicios = "Obligatorio";
  if (d.intercambio === "plataforma" && !d.plataforma.titular.trim()) e["plataforma.titular"] = "Obligatorio";
  if (d.intercambio === "carpeta" && !d.almacenamiento.trim()) e.almacenamiento = "Obligatorio";
  if (d.intercambio !== "plataforma" && !d.subencargados.trim()) e.subencargados = "Obligatorio";
  if (d.tipo === "otro") for (const k of ["tratamientos_otro", "interesados_otro", "datos_otro"]) if (!d[k].trim()) e[k] = "Obligatorio";
  if (!d.jurisdiccion.trim()) e.jurisdiccion = "Obligatorio";
  if (!d.lugar.trim()) e.lugar = "Obligatorio";
  return e;
}

// ---------- campos (mismo aspecto que el formulario de cuentas en participación) ----------
function Campo({ etiqueta, error, ayuda, ...rest }) {
  return (
    <label className={error ? "campo-error" : undefined}>
      {etiqueta}
      <input {...rest} aria-invalid={error ? true : undefined} />
      {error ? <small className="msg-error">{error}</small> : ayuda ? <small>{ayuda}</small> : null}
    </label>
  );
}

function Parte({ titulo, k, d, setD, err, extra, disabled }) {
  const p = d[k];
  const campo = c => ({ value: p[c], onChange: e => setD({ ...d, [k]: { ...p, [c]: e.target.value } }), error: err[`${k}.${c}`] });
  return (
    <fieldset disabled={disabled}><legend>{titulo}</legend>
      <Campo etiqueta="Razón social" {...campo("razon_social")} />
      <div className="fila">
        <Campo etiqueta="NIF" {...campo("nif")} />
        <Campo etiqueta="Email para comunicaciones RGPD" type="email" {...campo("email_rgpd")} />
      </div>
      <Campo etiqueta="Domicilio" {...campo("domicilio")} />
      {extra}
      <p className="ce-sub">Firmante</p>
      <div className="fila">
        <Campo etiqueta="Nombre y apellidos" {...campo("firmante_nombre")} />
        <Campo etiqueta="DNI / NIE" {...campo("firmante_dni")} />
      </div>
      <Campo etiqueta="Cargo o título de representación" ayuda="Ej.: administrador único; apoderado según escritura de …" {...campo("firmante_cargo")} />
    </fieldset>
  );
}

// ---------- ventana de firma ----------
function DialogoFirma({ rol, datos, hash, onCerrar, onFirmar }) {
  const ref = useRef();
  const p = datos[rol];
  const [leido, setLeido] = useState(false);
  const [facultades, setFacultades] = useState(false);
  const [electronica, setElectronica] = useState(false);
  const [nombre, setNombre] = useState("");
  const [firmando, setFirmando] = useState(false);
  const coincide = normal(nombre) === normal(p.firmante_nombre);
  const listo = leido && facultades && electronica && coincide && !firmando;
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal(); }, []);

  return (
    <dialog ref={ref} className="dlg dlg-ancho" onClose={onCerrar} onCancel={onCerrar} aria-labelledby="ce-firma-t">
      <div className="dlg-in">
        <h2 id="ce-firma-t">Firmar como {rol === "resp" ? "Responsable" : "Encargado"}</h2>
        <dl className="ficha">
          <dt>Entidad</dt><dd>{p.razon_social} — {p.nif}</dd>
          <dt>Firmante</dt><dd>{p.firmante_nombre} — DNI {p.firmante_dni}</dd>
          <dt>En calidad de</dt><dd>{p.firmante_cargo}</dd>
          <dt>Huella del contrato (SHA-256)</dt><dd className="huella">{hash}</dd>
        </dl>
        <label className="opcion"><input type="checkbox" checked={leido} onChange={e => setLeido(e.target.checked)} /> <span>He leído íntegramente el contrato cuya huella figura arriba.</span></label>
        <label className="opcion"><input type="checkbox" checked={facultades} onChange={e => setFacultades(e.target.checked)} /> <span>Declaro que mi representación está vigente y tengo facultades suficientes para obligar a {p.razon_social}.</span></label>
        <label className="opcion"><input type="checkbox" checked={electronica} onChange={e => setElectronica(e.target.checked)} /> <span>Acepto firmar electrónicamente y reconozco a esta firma plena validez (art. 25 eIDAS).</span></label>
        <Campo etiqueta="Escribe tu nombre completo para firmar" value={nombre} onChange={e => setNombre(e.target.value)} autoComplete="off"
          error={nombre && !coincide ? "Debe coincidir con el nombre del firmante" : ""} />
        <div className="dlg-acciones">
          <button className="btn ghost" type="button" onClick={onCerrar}>Cancelar</button>
          <button className="btn" type="button" disabled={!listo} onClick={async () => { setFirmando(true); await onFirmar(); }}>
            {firmando ? "Firmando…" : "Firmar contrato"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

// ---------- miniapp ----------
export default function ContratoEncargo({ config, irAAjustes }) {
  const guardado = useMemo(leer, []);
  const [d, setD] = useState(guardado?.datos || VACIO);
  const [expediente, setExpediente] = useState(guardado?.expediente || null); // { contrato_b64, hash, fecha_generacion, firmas: [], bloques }
  const [dialogo, setDialogo] = useState(null); // "correo" | "resp" | "enc"
  const [doc, setDoc] = useState(null); // { blob, nombre } cuando se crea el Word
  const [intentado, setIntentado] = useState(false);
  const [aviso, nodoAviso] = useAviso();
  const [cambios, setCambios] = useState(() => leerCambios(CLAVE_CAMBIOS));

  useEffect(() => guardarLocal({ datos: d, expediente }), [d, expediente]);

  const base = useMemo(() => bloquesEncargo(d), [d]);
  // Cerrado el contrato, se muestra exactamente el texto que se firma
  const bloques = useMemo(() => expediente?.bloques || aplicarCambios(base, cambios), [base, cambios, expediente]);
  const listaErr = errores(d);
  const completo = Object.keys(listaErr).length === 0;
  const err = intentado ? listaErr : {};
  const bloqueado = !!expediente;
  const firmas = expediente?.firmas || [];
  const firmo = r => firmas.some(f => f.rol === r);
  const nombreBase = `Contrato encargo tratamiento - ${(d.resp.razon_social || "cliente").trim()} - ${(d.enc.razon_social || "prestador").trim()}`;

  const set = (k, v) => setD({ ...d, [k]: v });
  const campo = (k) => ({ value: d[k], onChange: e => set(k, e.target.value), error: err[k] });

  // Guarda en la carpeta de la empresa si está elegida; si no, descarga
  const guardarArchivo = async (bytes, nombre, tipo = "application/pdf") => {
    const r = await guardarEnCarpeta(new Blob([bytes], { type: tipo }), nombre, DESTINO.encargo_tratamiento);
    aviso(r.modo === "carpeta" ? "Guardado en " + r.ruta : "Descargado: " + nombre);
  };

  async function crear() {
    const nombre = nombreBase + ".docx";
    try {
      const blob = await bloquesADocx(bloques);
      if (await raizGuardada()) {
        const r = await guardarEnCarpeta(blob, nombre, DESTINO.encargo_tratamiento);
        if (r.modo === "carpeta") { aviso("Guardado en " + r.ruta); return; }
      }
      setDoc({ blob, nombre }); // sin carpeta de empresa: "¿Quieres guardarlo en tu Drive?"
    } catch {
      aviso("No se pudo crear el Word. Prueba con «Copiar texto».");
    }
  }

  function copiar() {
    try { navigator.clipboard.writeText(bloquesATexto(bloques)).then(() => aviso("Texto copiado"), () => aviso("No se pudo copiar")); }
    catch { aviso("No se pudo copiar"); }
  }

  function vaciar() {
    if (firmas.length && !window.confirm("Hay firmas registradas. Descarga antes el PDF firmado y las evidencias. ¿Seguro que quieres empezar de nuevo?")) return;
    setD({ ...VACIO, jurisdiccion: d.jurisdiccion, lugar: d.lugar });
    setExpediente(null);
    setIntentado(false);
  }

  // ---- firma electrónica ----
  const borradorPDF = async () => {
    const { bytes } = await generarContratoPDF(d, bloques);
    guardarArchivo(bytes, `${nombreBase} (BORRADOR).pdf`);
  };

  const cerrar = async () => {
    setIntentado(true);
    if (!completo) { aviso(`Revisa los ${Object.keys(listaErr).length} datos marcados en el formulario.`); return; }
    if (!window.confirm("Al cerrar el contrato ya no se podrán cambiar los datos ni las cláusulas. ¿Continuar?")) return;
    const fecha_generacion = new Date().toISOString();
    const { bytes, hash } = await generarContratoPDF({ ...d, fecha_generacion }, bloques);
    setExpediente({ version: VERSION_CONTRATO, fecha_generacion, contrato_b64: b64(bytes), hash, firmas: [], bloques });
    aviso("Contrato cerrado y listo para firmar");
  };

  const firmar = async rol => {
    const p = d[rol];
    const ahora = new Date();
    const fecha_utc = ahora.toISOString();
    const id_firma = await sha256Hex(new TextEncoder().encode(`${expediente.hash}|${rol}|${p.firmante_dni}|${fecha_utc}`));
    const firma = {
      rol, entidad: p.razon_social, nif: p.nif, nombre: p.firmante_nombre, dni: p.firmante_dni, cargo: p.firmante_cargo,
      fecha_utc, fecha_local: ahora.toLocaleString("es-ES", { timeZoneName: "short" }),
      metodo: "Firma electrónica en Mi Despacho: aceptación expresa de declaraciones y nombre escrito por el firmante (modo local, sin segundo factor)",
      navegador: navigator.userAgent.slice(0, 160),
      hash_contrato: expediente.hash, id_firma,
    };
    const nuevo = { ...expediente, firmas: [...firmas, firma] };
    setExpediente(nuevo);
    setDialogo(null);
    const { bytes } = await generarPDFFirmado(deB64(nuevo.contrato_b64), nuevo.hash, d, nuevo.firmas);
    await guardarArchivo(bytes, `${nombreBase} (firmado ${nuevo.firmas.length} de 2).pdf`);
  };

  const descargarFirmado = async () => {
    const { bytes } = await generarPDFFirmado(deB64(expediente.contrato_b64), expediente.hash, d, firmas);
    guardarArchivo(bytes, `${nombreBase} (firmado ${firmas.length} de 2).pdf`);
  };
  const descargarEvidencias = () => {
    const ev = { documento: "Contrato de encargo del tratamiento", version_modelo: expediente.version, generado: expediente.fecha_generacion, huella_contrato_sha256: expediente.hash, partes: { responsable: d.resp, encargado: d.enc }, laboral: d.laboral, firmas };
    guardarArchivo(new TextEncoder().encode(JSON.stringify(ev, null, 2)), `${nombreBase} - evidencias.json`, "application/json");
  };
  const descargarOriginal = () => guardarArchivo(deB64(expediente.contrato_b64), `${nombreBase} (original sin firmas).pdf`);

  const setLaboral = v => {
    let s = d.servicios;
    if (v && !/laboral/i.test(s)) s = s.replace(/ y fiscal$/i, ", fiscal") + " y laboral";
    if (!v) s = s.replace(/, fiscal y laboral$/i, " y fiscal").replace(/ y laboral$/i, "");
    setD({ ...d, laboral: v, servicios: s });
  };

  const prompt = (ctx) => [
    "Actúa como especialista en protección de datos español. Revisa este borrador de contrato de encargo del tratamiento (art. 28 del RGPD y art. 33 de la LOPDGDD).",
    "Señala, en español y sin tecnicismos innecesarios, un máximo de 8 puntos ordenados de más a menos importante. Para cada uno: el riesgo o hueco en una frase y una propuesta concreta de redacción o de cambio.",
    "Fíjate en: que estén todos los contenidos mínimos del art. 28.3 RGPD, coherencia entre las partes y los servicios, si el prestador es realmente encargado o responsable, categorías de datos e interesados, subencargados y transferencias internacionales, plazo de notificación de brechas, medidas de seguridad del Anexo I, uso de IA, destino de los datos al terminar, y datos marcados entre corchetes pendientes.",
    "No inventes artículos, sentencias ni cifras. Si citas una norma y no estás seguro, dilo. Termina con una línea recordando que es una revisión orientativa.",
    "Formato: texto plano con números (1., 2., …), sin tablas.",
    ctx ? "\nCONTEXTO DEL CASO:\n" + ctx : "",
    "\nBORRADOR:\n" + bloquesATexto(bloques),
  ].join("\n");

  const adjuntoCorreo = expediente
    ? { nombre: `${nombreBase}${firmas.length ? ` (firmado ${firmas.length} de 2)` : ""}.pdf`,
        blob: async () => new Blob([firmas.length ? (await generarPDFFirmado(deB64(expediente.contrato_b64), expediente.hash, d, firmas)).bytes : deB64(expediente.contrato_b64)], { type: "application/pdf" }) }
    : { nombre: nombreBase + ".docx", blob: () => bloquesADocx(bloques) };

  return (
    <div className="app">
      <header className="app-cab">
        <div>
          <div className="eyebrow">Contratos · Crear</div>
          <h1>Contrato de encargo del tratamiento</h1>
          <p className="muted">Rellena los datos y el borrador se escribe solo (art. 28 RGPD y art. 33 LOPDGDD · modelo v{VERSION_CONTRATO}). Los huecos entre corchetes se rellenan con tus datos.</p>
        </div>
        <div className="acciones">
          <button className="btn" type="button" onClick={crear}>Crear contrato</button>
          <button className="btn ghost" type="button" onClick={copiar}>Copiar texto</button>
          <button className="btn ghost" type="button" onClick={() => setDialogo("correo")}>Enviar por correo</button>
          <button className="btn ghost" type="button" onClick={vaciar}>Vaciar</button>
        </div>
      </header>

      <div className="dos-col">
        <form className="formulario" onSubmit={(e) => e.preventDefault()} autoComplete="off">
          {bloqueado && <p className="nota">El contrato está cerrado para la firma: los datos ya no se pueden cambiar. Para preparar otro, pulsa «Vaciar».</p>}
          <fieldset disabled={bloqueado}><legend>Lugar y tribunales</legend>
            <div className="fila">
              <Campo etiqueta="Lugar de firma" placeholder="Madrid" {...campo("lugar")} />
              <Campo etiqueta="Tribunales de" placeholder="Madrid capital" {...campo("jurisdiccion")} />
            </div>
          </fieldset>
          <Parte titulo="Responsable del tratamiento (empresa cliente)" k="resp" d={d} setD={setD} err={err} disabled={bloqueado} />
          <Parte titulo={`Encargado del tratamiento (${TIPOS[d.tipo].nombre.toLowerCase()})`} k="enc" d={d} setD={setD} err={err} disabled={bloqueado}
            extra={<Campo etiqueta="Delegado de Protección de Datos (opcional)" ayuda="Nombre y email. Si no tiene, déjalo vacío."
              value={d.enc.dpd} onChange={e => setD({ ...d, enc: { ...d.enc, dpd: e.target.value } })} />} />
          <fieldset disabled={bloqueado}><legend>Servicios</legend>
            <label>Tipo de prestador (Encargado)
              <select value={d.tipo} onChange={e => { const t = e.target.value; setD({ ...d, tipo: t, laboral: false, servicios: TIPOS[t].servicios || d.servicios }); }}>
                {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v.nombre}</option>)}
              </select>
            </label>
            {TIPOS[d.tipo].aviso && <p className="nota">{TIPOS[d.tipo].aviso}</p>}
            {d.tipo === "gestoria" && (
              <label>¿Lleva también la parte laboral (nóminas, Seguridad Social)?
                <select value={d.laboral ? "si" : "no"} onChange={e => setLaboral(e.target.value === "si")}>
                  <option value="no">No</option><option value="si">Sí</option>
                </select>
              </label>
            )}
            <Campo etiqueta="Servicios que presta el Encargado" {...campo("servicios")} />
            {d.tipo === "otro" && <>
              <Campo etiqueta="Tratamientos que realiza el prestador" placeholder="consulta, conservación y elaboración de informes" {...campo("tratamientos_otro")} />
              <div className="fila">
                <Campo etiqueta="Personas cuyos datos se tratan" placeholder="clientes y proveedores" {...campo("interesados_otro")} />
                <Campo etiqueta="Tipos de datos" placeholder="identificativos y de contacto" {...campo("datos_otro")} />
              </div>
            </>}
          </fieldset>
          <fieldset disabled={bloqueado}><legend>Intercambio de documentos</legend>
            <label>Cómo se intercambian los documentos
              <select value={d.intercambio} onChange={e => set("intercambio", e.target.value)}>
                <option value="carpeta">Carpeta compartida del cliente (OneDrive, Google Drive…)</option>
                <option value="plataforma">Plataforma Mi Despacho (portal con usuarios)</option>
                <option value="otro">Otro medio</option>
              </select>
            </label>
            {d.intercambio === "carpeta" && <Campo etiqueta="Servicio de almacenamiento" {...campo("almacenamiento")} />}
            {d.intercambio === "plataforma" && <div className="fila">
              <Campo etiqueta="Nombre de la plataforma" value={d.plataforma.nombre} onChange={e => set("plataforma", { ...d.plataforma, nombre: e.target.value })} />
              <Campo etiqueta="Titular de la plataforma" value={d.plataforma.titular} onChange={e => set("plataforma", { ...d.plataforma, titular: e.target.value })} error={err["plataforma.titular"]} />
            </div>}
            {d.intercambio !== "plataforma" && <label className={err.subencargados ? "campo-error" : undefined}>Subencargados del prestador (Anexo II)
              <textarea rows={3} value={d.subencargados} onChange={e => set("subencargados", e.target.value)} />
              {err.subencargados && <small className="msg-error">{err.subencargados}</small>}
            </label>}
          </fieldset>
        </form>

        <VistaDocumento bloques={bloques} />
      </div>

      <EditorClausulas base={base} cambios={cambios} setCambios={setCambios} aviso={aviso} clave={CLAVE_CAMBIOS}
        ejemploTitulo="13. Título de la cláusula." bloqueado={bloqueado} />

      <section className="editor-clausulas">
        <div className="ia-cab">
          <div>
            <h2>Firma electrónica</h2>
            <p className="muted">
              {!expediente
                ? "Cuando los datos estén completos, cierra el contrato: se genera el PDF definitivo con su huella (SHA-256) y cada parte lo firma aquí. El PDF firmado lleva una hoja de evidencias."
                : <>Contrato cerrado · huella <code>{expediente.hash.slice(0, 16)}…</code> · {firmas.length === 2 ? "firmado por ambas partes." : `${firmas.length} de 2 firmas.`}</>}
            </p>
          </div>
          <div className="acciones">
            {!expediente ? <>
              <button className="btn ghost" type="button" onClick={borradorPDF}>Descargar borrador (PDF)</button>
              <button className="btn" type="button" onClick={cerrar}>Cerrar contrato y pasar a firma</button>
            </> : <>
              {firmas.length > 0 && <button className="btn" type="button" onClick={descargarFirmado}>PDF firmado</button>}
              <button className="btn ghost" type="button" onClick={descargarOriginal}>Original</button>
              {firmas.length > 0 && <button className="btn ghost" type="button" onClick={descargarEvidencias}>Evidencias (.json)</button>}
            </>}
          </div>
        </div>
        {!expediente
          ? <p className={completo ? "ok-texto" : "muted"}>{completo ? "Datos completos." : `Faltan ${Object.keys(listaErr).length} datos por completar o corregir.`}</p>
          : <ul className="contratadas">
              {["resp", "enc"].map(r => (
                <li key={r}>
                  <span className={firmo(r) ? "si" : "no"}>{firmo(r) ? "✓" : "○"}</span>
                  {r === "resp" ? "Responsable" : "Encargado"} ({d[r].firmante_nombre}): {firmo(r) ? "firmado" : <button className="enlace" type="button" onClick={() => setDialogo(r)}>Firmar ahora</button>}
                </li>
              ))}
            </ul>}
      </section>

      <div className="sin-ia">
        <strong>Este contrato no lo escribe la IA.</strong> El texto es una plantilla jurídica fija que se completa con tus datos y con las cláusulas que tú modifiques. La IA solo lo revisa si tú se lo pides aquí abajo, y no cambia nada por su cuenta.
      </div>

      <RevisionIA construirPrompt={prompt} irAAjustes={irAAjustes} />
      <p className="muted pie">Borrador orientativo. Revísalo y adáptalo a cada caso antes de firmar.</p>

      {config && <GuardarEnNube abierto={!!doc} blob={doc?.blob} nombre={doc?.nombre || ""} config={config} onCerrar={() => setDoc(null)} irAAjustes={irAAjustes} />}
      {dialogo === "correo" && <DialogoCorreo
        opciones={firmas.length === 2 ? ["contrato_firmado", "contrato_firma"] : ["contrato_firma"]}
        para={d.enc.email_rgpd}
        vars={{ documento: "contrato de encargo del tratamiento de datos", empresa: d.resp.razon_social, destinatario: d.enc.firmante_nombre?.split(" ")[0] || "", remitente: d.resp.firmante_nombre || config?.nombre || "" }}
        adjuntos={[adjuntoCorreo]}
        onCerrar={() => setDialogo(null)} />}
      {(dialogo === "resp" || dialogo === "enc") && <DialogoFirma rol={dialogo} datos={d} hash={expediente.hash} onCerrar={() => setDialogo(null)} onFirmar={() => firmar(dialogo)} />}
      {nodoAviso}
    </div>
  );
}
