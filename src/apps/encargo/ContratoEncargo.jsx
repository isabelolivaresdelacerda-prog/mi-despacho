import { useEffect, useMemo, useState } from "react";
import { bloquesRellenos, generarContratoPDF, generarPDFFirmado, sha256Hex } from "./pdf.js";
import { VERSION_CONTRATO, TIPOS } from "./modelo.js";
import { guardar as guardarEnCarpeta, DESTINO } from "../../lib/carpetas.js";
import { DialogoCorreo } from "../../lib/CorreoUI.jsx";
import "./contrato.css";

const CLAVE = "md-contrato-encargo-v2";

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
const guardar = v => { try { localStorage.setItem(CLAVE, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };
const b64 = bytes => { let s = ""; bytes.forEach(b => (s += String.fromCharCode(b))); return btoa(s); };
const deB64 = t => Uint8Array.from(atob(t), c => c.charCodeAt(0));
const normal = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
let avisar = () => {};
const descargar = async (bytes, nombre, tipo = "application/pdf") => {
  const r = await guardarEnCarpeta(new Blob([bytes], { type: tipo }), nombre, DESTINO.encargo_tratamiento);
  avisar(r.modo === "carpeta" ? `Guardado en ${r.ruta}` : `Descargado: ${nombre}`);
};

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

// ---------- componentes de formulario ----------
function Campo({ etiqueta, valor, onChange, error, ayuda, ...rest }) {
  return (
    <label className={"ce-campo" + (error ? " ce-error" : "")}>
      <span>{etiqueta}</span>
      <input value={valor} onChange={e => onChange(e.target.value)} {...rest} />
      {error ? <small className="ce-msg">{error}</small> : ayuda ? <small>{ayuda}</small> : null}
    </label>
  );
}

function Parte({ titulo, k, datos, set, err, extra }) {
  const p = datos[k];
  const cambia = campo => v => set({ ...datos, [k]: { ...p, [campo]: v } });
  const E = c => err[`${k}.${c}`];
  return (
    <fieldset className="ce-grupo">
      <legend>{titulo}</legend>
      <div className="ce-rejilla">
        <Campo etiqueta="Razón social" valor={p.razon_social} onChange={cambia("razon_social")} error={E("razon_social")} />
        <Campo etiqueta="NIF" valor={p.nif} onChange={cambia("nif")} error={E("nif")} />
        <Campo etiqueta="Domicilio" valor={p.domicilio} onChange={cambia("domicilio")} error={E("domicilio")} className="ce-ancho" />
        <Campo etiqueta="Email para comunicaciones RGPD" type="email" valor={p.email_rgpd} onChange={cambia("email_rgpd")} error={E("email_rgpd")} />
        {extra}
      </div>
      <p className="ce-sub">Firmante</p>
      <div className="ce-rejilla">
        <Campo etiqueta="Nombre y apellidos" valor={p.firmante_nombre} onChange={cambia("firmante_nombre")} error={E("firmante_nombre")} />
        <Campo etiqueta="DNI / NIE" valor={p.firmante_dni} onChange={cambia("firmante_dni")} error={E("firmante_dni")} />
        <Campo etiqueta="Cargo o título de representación" valor={p.firmante_cargo} onChange={cambia("firmante_cargo")} error={E("firmante_cargo")}
          ayuda="Ej.: administrador único; apoderado según escritura de …" className="ce-ancho" />
      </div>
    </fieldset>
  );
}

// ---------- diálogo 1: datos ----------
function DialogoDatos({ inicial, onCerrar, onGuardar }) {
  const [d, setD] = useState(inicial);
  const [intentado, setIntentado] = useState(false);
  const err = intentado ? errores(d) : {};
  const setLaboral = v => {
    let s = d.servicios;
    if (v && !/laboral/i.test(s)) s = s.replace(/ y fiscal$/i, ", fiscal") + " y laboral";
    if (!v) s = s.replace(/, fiscal y laboral$/i, " y fiscal").replace(/ y laboral$/i, "");
    setD({ ...d, laboral: v, servicios: s });
  };
  const aceptar = () => { setIntentado(true); if (!Object.keys(errores(d)).length) onGuardar(d); };

  return (
    <div className="ce-fondo" role="dialog" aria-modal="true" aria-labelledby="ce-t1">
      <div className="ce-dialogo">
        <header><h2 id="ce-t1">Datos del contrato de encargo</h2><button className="ce-x" onClick={onCerrar} aria-label="Cerrar">×</button></header>
        <div className="ce-cuerpo">
          <Parte titulo="Responsable del tratamiento (empresa cliente)" k="resp" datos={d} set={setD} err={err} />
          <Parte titulo={`Encargado del tratamiento (${TIPOS[d.tipo].nombre.toLowerCase()})`} k="enc" datos={d} set={setD} err={err}
            extra={<Campo etiqueta="Delegado de Protección de Datos (opcional)" valor={d.enc.dpd} onChange={v => setD({ ...d, enc: { ...d.enc, dpd: v } })}
              ayuda="Nombre y email. Si no tiene, déjalo vacío." />} />
          <fieldset className="ce-grupo">
            <legend>Servicios y condiciones</legend>
            <label className="ce-campo">
              <span>Tipo de prestador (Encargado)</span>
              <select value={d.tipo} onChange={e => { const t = e.target.value; setD({ ...d, tipo: t, laboral: false, servicios: TIPOS[t].servicios || d.servicios }); }}>
                {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v.nombre}</option>)}
              </select>
            </label>
            {TIPOS[d.tipo].aviso && <p className="ce-alerta">{TIPOS[d.tipo].aviso}</p>}
            {d.tipo === "gestoria" && (
              <div className="ce-sino">
                <span>¿La gestoría lleva también la parte laboral (nóminas, Seguridad Social)?</span>
                <div role="radiogroup">
                  <button type="button" className={d.laboral ? "on" : ""} onClick={() => setLaboral(true)}>Sí</button>
                  <button type="button" className={!d.laboral ? "on" : ""} onClick={() => setLaboral(false)}>No</button>
                </div>
              </div>
            )}
            <div className="ce-rejilla">
              <Campo etiqueta="Servicios que presta el Encargado" valor={d.servicios} onChange={v => setD({ ...d, servicios: v })} error={err.servicios} className="ce-ancho" />
              {d.tipo === "otro" && <>
                <Campo etiqueta="Tratamientos que realiza el prestador" valor={d.tratamientos_otro} onChange={v => setD({ ...d, tratamientos_otro: v })} error={err.tratamientos_otro} className="ce-ancho" placeholder="consulta, conservación y elaboración de informes" />
                <Campo etiqueta="Personas cuyos datos se tratan" valor={d.interesados_otro} onChange={v => setD({ ...d, interesados_otro: v })} error={err.interesados_otro} placeholder="clientes y proveedores" />
                <Campo etiqueta="Tipos de datos" valor={d.datos_otro} onChange={v => setD({ ...d, datos_otro: v })} error={err.datos_otro} placeholder="identificativos y de contacto" />
              </>}
              <label className="ce-campo ce-ancho">
                <span>Cómo se intercambian los documentos</span>
                <select value={d.intercambio} onChange={e => setD({ ...d, intercambio: e.target.value })}>
                  <option value="carpeta">Carpeta compartida del cliente (OneDrive, Google Drive…)</option>
                  <option value="plataforma">Plataforma Mi Despacho (portal con usuarios)</option>
                  <option value="otro">Otro medio</option>
                </select>
              </label>
              {d.intercambio === "carpeta" && <Campo etiqueta="Servicio de almacenamiento" valor={d.almacenamiento} onChange={v => setD({ ...d, almacenamiento: v })} error={err.almacenamiento} />}
              {d.intercambio === "plataforma" && <>
                <Campo etiqueta="Nombre de la plataforma" valor={d.plataforma.nombre} onChange={v => setD({ ...d, plataforma: { ...d.plataforma, nombre: v } })} />
                <Campo etiqueta="Titular de la plataforma" valor={d.plataforma.titular} onChange={v => setD({ ...d, plataforma: { ...d.plataforma, titular: v } })} error={err["plataforma.titular"]} />
              </>}
              {d.intercambio !== "plataforma" && <Campo etiqueta="Subencargados del prestador (Anexo II)" valor={d.subencargados} onChange={v => setD({ ...d, subencargados: v })} error={err.subencargados} className="ce-ancho" />}
              <Campo etiqueta="Tribunales competentes" valor={d.jurisdiccion} onChange={v => setD({ ...d, jurisdiccion: v })} error={err.jurisdiccion} placeholder="Madrid capital" />
              <Campo etiqueta="Lugar de firma" valor={d.lugar} onChange={v => setD({ ...d, lugar: v })} error={err.lugar} placeholder="Madrid" />
            </div>
          </fieldset>
        </div>
        <footer>
          {intentado && Object.keys(err).length > 0 && <span className="ce-aviso">Revisa los {Object.keys(err).length} campos marcados.</span>}
          <button className="ce-btn sec" onClick={onCerrar}>Cancelar</button>
          <button className="ce-btn" onClick={aceptar}>Guardar datos</button>
        </footer>
      </div>
    </div>
  );
}

// ---------- diálogo 2: firma ----------
function DialogoFirma({ rol, datos, hash, onCerrar, onFirmar }) {
  const p = datos[rol];
  const [leido, setLeido] = useState(false);
  const [facultades, setFacultades] = useState(false);
  const [electronica, setElectronica] = useState(false);
  const [nombre, setNombre] = useState("");
  const [firmando, setFirmando] = useState(false);
  const coincide = normal(nombre) === normal(p.firmante_nombre);
  const listo = leido && facultades && electronica && coincide && !firmando;

  return (
    <div className="ce-fondo" role="dialog" aria-modal="true" aria-labelledby="ce-t2">
      <div className="ce-dialogo ce-estrecho">
        <header><h2 id="ce-t2">Firmar como {rol === "resp" ? "Responsable" : "Encargado"}</h2><button className="ce-x" onClick={onCerrar} aria-label="Cerrar">×</button></header>
        <div className="ce-cuerpo">
          <dl className="ce-ficha">
            <dt>Entidad</dt><dd>{p.razon_social} — {p.nif}</dd>
            <dt>Firmante</dt><dd>{p.firmante_nombre} — DNI {p.firmante_dni}</dd>
            <dt>En calidad de</dt><dd>{p.firmante_cargo}</dd>
            <dt>Huella del contrato (SHA-256)</dt><dd className="ce-hash">{hash}</dd>
          </dl>
          <label className="ce-check"><input type="checkbox" checked={leido} onChange={e => setLeido(e.target.checked)} /> He leído íntegramente el contrato cuya huella figura arriba.</label>
          <label className="ce-check"><input type="checkbox" checked={facultades} onChange={e => setFacultades(e.target.checked)} /> Declaro que mi representación está vigente y tengo facultades suficientes para obligar a {p.razon_social}.</label>
          <label className="ce-check"><input type="checkbox" checked={electronica} onChange={e => setElectronica(e.target.checked)} /> Acepto firmar electrónicamente y reconozco a esta firma plena validez (art. 25 eIDAS).</label>
          <Campo etiqueta="Escribe tu nombre completo para firmar" valor={nombre} onChange={setNombre} autoComplete="off"
            error={nombre && !coincide ? "Debe coincidir con el nombre del firmante" : ""} />
        </div>
        <footer>
          <button className="ce-btn sec" onClick={onCerrar}>Cancelar</button>
          <button className="ce-btn" disabled={!listo} onClick={async () => { setFirmando(true); await onFirmar(); }}>
            {firmando ? "Firmando…" : "Firmar contrato"}
          </button>
        </footer>
      </div>
    </div>
  );
}

// ---------- miniapp ----------
export default function ContratoEncargo() {
  const guardado = useMemo(leer, []);
  const [datos, setDatos] = useState(guardado?.datos || VACIO);
  const [expediente, setExpediente] = useState(guardado?.expediente || null); // { contrato_b64, hash, fecha_generacion, firmas: [] }
  const [dialogo, setDialogo] = useState(null); // "datos" | "resp" | "enc"
  const [aviso, setAviso] = useState("");

  useEffect(() => guardar({ datos, expediente }), [datos, expediente]);
  useEffect(() => { avisar = setAviso; return () => { avisar = () => {}; }; }, []);

  const bloques = useMemo(() => bloquesRellenos(datos), [datos]);
  const completo = Object.keys(errores(datos)).length === 0;
  const firmas = expediente?.firmas || [];
  const firmo = r => firmas.some(f => f.rol === r);
  const nombreBase = `Contrato encargo tratamiento - ${datos.resp.razon_social || "cliente"} - ${datos.enc.razon_social || "prestador"}`;

  const texto = () => bloques.map(b => b.tipo === "lista" ? b.items.map(i => "• " + i).join("\n") : b.texto || "").filter(Boolean).join("\n\n");

  const borrador = async () => {
    const { bytes } = await generarContratoPDF(datos);
    descargar(bytes, `${nombreBase} (BORRADOR).pdf`);
  };

  const cerrar = async () => {
    const fecha_generacion = new Date().toISOString();
    const { bytes, hash } = await generarContratoPDF({ ...datos, fecha_generacion });
    setExpediente({ version: VERSION_CONTRATO, fecha_generacion, contrato_b64: b64(bytes), hash, firmas: [] });
    setAviso("Contrato cerrado. Ya no se puede modificar: cualquier cambio exigiría generar uno nuevo.");
  };

  const firmar = async rol => {
    const p = datos[rol];
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
    const { bytes, hash } = await generarPDFFirmado(deB64(nuevo.contrato_b64), nuevo.hash, datos, nuevo.firmas);
    await descargar(bytes, `${nombreBase} (firmado ${nuevo.firmas.length} de 2).pdf`);
    setAviso(a => `Firma registrada (huella del PDF con evidencias: ${hash.slice(0, 16)}…). ${a}`);
  };

  const descargarFirmado = async () => {
    const { bytes } = await generarPDFFirmado(deB64(expediente.contrato_b64), expediente.hash, datos, firmas);
    descargar(bytes, `${nombreBase} (firmado ${firmas.length} de 2).pdf`);
  };
  const descargarEvidencias = () => {
    const ev = { documento: "Contrato de encargo del tratamiento", version_modelo: expediente.version, generado: expediente.fecha_generacion, huella_contrato_sha256: expediente.hash, partes: { responsable: datos.resp, encargado: datos.enc }, laboral: datos.laboral, firmas };
    descargar(new TextEncoder().encode(JSON.stringify(ev, null, 2)), `${nombreBase} - evidencias.json`, "application/json");
  };
  const descargarOriginal = () => descargar(deB64(expediente.contrato_b64), `${nombreBase} (original sin firmas).pdf`);

  const vaciar = () => {
    if (expediente?.firmas?.length && !window.confirm("Hay firmas registradas. Descarga antes el PDF firmado y las evidencias. ¿Seguro que quieres empezar de nuevo?")) return;
    setDatos(VACIO); setExpediente(null); setAviso("");
  };

  return (
    <div className="ce">
      <div className="ce-cabecera">
        <div>
          <h1>Contrato de encargo del tratamiento</h1>
          <p>Art. 28 RGPD · empresa y prestador de servicios · modelo v{VERSION_CONTRATO}</p>
        </div>
        <div className="ce-acciones">
          {!expediente && <>
            <button className="ce-btn" onClick={() => setDialogo("datos")}>{completo ? "Editar datos" : "Rellenar datos"}</button>
            <button className="ce-btn sec" onClick={borrador}>Descargar borrador</button>
            <button className="ce-btn sec" onClick={() => navigator.clipboard?.writeText(texto())}>Copiar texto</button>
          </>}
          <button className="ce-btn sec" onClick={vaciar}>Vaciar</button>
        </div>
      </div>

      <div className="ce-estado">
        {!expediente ? (
          <>
            <span className={"ce-paso" + (completo ? " ok" : "")}>1. Datos {completo ? "completos" : "pendientes"}</span>
            <button className="ce-btn" disabled={!completo} onClick={cerrar} title={completo ? "" : "Completa los datos primero"}>2. Cerrar contrato y pasar a firma</button>
          </>
        ) : (
          <>
            <span className="ce-paso ok">Contrato cerrado · huella <code>{expediente.hash.slice(0, 16)}…</code></span>
            {["resp", "enc"].map(r => (
              <span key={r} className={"ce-paso" + (firmo(r) ? " ok" : "")}>
                {r === "resp" ? "Responsable" : "Encargado"}: {firmo(r) ? "firmado" : <button className="ce-btn mini" onClick={() => setDialogo(r)}>Firmar</button>}
              </span>
            ))}
            <span className="ce-descargas">
              {firmas.length > 0 && <button className="ce-btn mini" onClick={descargarFirmado}>PDF firmado</button>}
              <button className="ce-btn mini sec" onClick={descargarOriginal}>Original</button>
              {firmas.length > 0 && <button className="ce-btn mini sec" onClick={descargarEvidencias}>Evidencias (.json)</button>}
              <button className="ce-btn mini" onClick={() => setDialogo("correo")}>Enviar por correo</button>
            </span>
          </>
        )}
      </div>
      {aviso && <p className="ce-nota">{aviso}</p>}

      <article className="ce-vista" aria-label="Vista previa del contrato">
        {bloques.map((b, i) => {
          const marca = t => t.split(/(\[[^\]]+\])/).map((x, j) => /^\[.+\]$/.test(x) ? <mark key={j}>{x}</mark> : x);
          switch (b.tipo) {
            case "titulo": return <h2 key={i}>{b.texto}</h2>;
            case "subtitulo": return <p key={i} className="ce-subt">{b.texto}</p>;
            case "seccion": return <h3 key={i}>{b.texto}</h3>;
            case "clausula": return <h4 key={i}>{b.texto}</h4>;
            case "p": return <p key={i}>{marca(b.texto)}</p>;
            case "lista": return <ul key={i}>{b.items.map((t, j) => <li key={j}>{marca(t)}</li>)}</ul>;
            case "salto": return <hr key={i} />;
            case "firmas": return <div key={i} className="ce-firmas"><div><b>Fdo.: El Responsable</b><br />{marca(datos.resp.razon_social || "[Razón social del Responsable]")}</div><div><b>Fdo.: El Encargado</b><br />{marca(datos.enc.razon_social || "[Razón social de la gestoría]")}</div></div>;
            default: return null;
          }
        })}
      </article>

      {dialogo === "datos" && <DialogoDatos inicial={datos} onCerrar={() => setDialogo(null)} onGuardar={d => { setDatos(d); setDialogo(null); }} />}
      {dialogo === "correo" && <DialogoCorreo
        opciones={firmas.length === 2 ? ["contrato_firmado", "contrato_firma"] : ["contrato_firma"]}
        para={datos.enc.email_rgpd}
        vars={{ documento: "contrato de encargo del tratamiento de datos", empresa: datos.resp.razon_social, destinatario: datos.enc.firmante_nombre?.split(" ")[0] || "", remitente: datos.resp.firmante_nombre }}
        adjuntos={[{ nombre: `${nombreBase.replace(/\.$/, "")}${firmas.length ? ` (firmado ${firmas.length} de 2)` : ""}.pdf`,
          blob: async () => new Blob([firmas.length ? (await generarPDFFirmado(deB64(expediente.contrato_b64), expediente.hash, datos, firmas)).bytes : deB64(expediente.contrato_b64)], { type: "application/pdf" }) }]}
        onCerrar={() => setDialogo(null)} />}
      {(dialogo === "resp" || dialogo === "enc") && <DialogoFirma rol={dialogo} datos={datos} hash={expediente.hash} onCerrar={() => setDialogo(null)} onFirmar={() => firmar(dialogo)} />}
    </div>
  );
}
