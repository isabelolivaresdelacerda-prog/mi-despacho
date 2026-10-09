// Cierre y firma electrónica común a todos los contratos: al cerrar se genera el PDF definitivo con su huella
// (SHA-256), cada parte lo firma aquí y el PDF firmado lleva una hoja de evidencias. Mismo sistema que el encargo.
import { useEffect, useRef, useState } from "react";
import { pdfContrato, pdfFirmado, sha256Hex } from "./contratoPDF.js";

const b64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
const deB64 = (t) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0));
const normal = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const descargar = (bytes, nombre, tipo = "application/pdf") => {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([bytes], { type: tipo })); a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};

// Expediente guardado en este navegador (uno por tipo de contrato)
export function leerExpediente(clave) { try { return JSON.parse(localStorage.getItem(clave)) || null; } catch { return null; } }
function guardarExpediente(clave, e) { try { if (e) localStorage.setItem(clave, JSON.stringify(e)); else localStorage.removeItem(clave); } catch { /* sin espacio: sigue en memoria */ } }

// Datos de firmante a partir de una parte del formulario (prefijo «a», «m», «g»…)
export function firmanteDe(d, pre, rol, etiqueta) {
  const juridica = (d[pre + "_tipo"] || "juridica") === "juridica";
  return {
    rol, etiqueta,
    entidad: (d[pre + "_nombre"] || "").trim(), nif: (d[pre + "_nif"] || "").trim(),
    nombre: juridica ? (d[pre + "_rep"] || "").trim() : (d[pre + "_nombre"] || "").trim(),
    dni: juridica ? (d[pre + "_rep_dni"] || "").trim() : (d[pre + "_nif"] || "").trim(),
    cargo: juridica ? (d[pre + "_cargo"] || "representante").trim() : "en su propio nombre",
    juridica,
  };
}

function DialogoFirma({ parte, hash, onCerrar, onFirmar }) {
  const ref = useRef();
  const [leido, setLeido] = useState(false);
  const [facultades, setFacultades] = useState(!parte.juridica);
  const [electronica, setElectronica] = useState(false);
  const [nombre, setNombre] = useState("");
  const [firmando, setFirmando] = useState(false);
  const coincide = normal(nombre) === normal(parte.nombre);
  const listo = leido && facultades && electronica && coincide && !firmando;
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal(); }, []);
  return (
    <dialog ref={ref} className="dlg dlg-ancho" onClose={onCerrar} onCancel={onCerrar} aria-labelledby="fc-t">
      <div className="dlg-in">
        <h2 id="fc-t">Firmar como {parte.etiqueta}</h2>
        <dl className="ficha">
          <dt>{parte.juridica ? "Entidad" : "Firmante"}</dt><dd>{parte.entidad} — {parte.nif}</dd>
          {parte.juridica && <><dt>Firmante</dt><dd>{parte.nombre} — DNI {parte.dni}</dd><dt>En calidad de</dt><dd>{parte.cargo}</dd></>}
          <dt>Huella del contrato (SHA-256)</dt><dd className="huella">{hash}</dd>
        </dl>
        <label className="opcion"><input type="checkbox" checked={leido} onChange={(e) => setLeido(e.target.checked)} /> <span>He leído íntegramente el contrato cuya huella figura arriba.</span></label>
        {parte.juridica && <label className="opcion"><input type="checkbox" checked={facultades} onChange={(e) => setFacultades(e.target.checked)} /> <span>Declaro que mi representación está vigente y tengo facultades suficientes para obligar a {parte.entidad}.</span></label>}
        <label className="opcion"><input type="checkbox" checked={electronica} onChange={(e) => setElectronica(e.target.checked)} /> <span>Acepto firmar electrónicamente y reconozco a esta firma plena validez (art. 25 del Reglamento eIDAS).</span></label>
        <label>Escribe tu nombre completo para firmar<input value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="off" /></label>
        {nombre && !coincide && <p className="error pequeño">Debe coincidir con el nombre del firmante: {parte.nombre}</p>}
        <div className="dlg-acciones">
          <button className="btn ghost" type="button" onClick={onCerrar}>Cancelar</button>
          <button className="btn" type="button" disabled={!listo} onClick={async () => { setFirmando(true); await onFirmar(); }}>{firmando ? "Firmando…" : "Firmar contrato"}</button>
        </div>
      </div>
    </dialog>
  );
}

// props: clave, titulo (nombre del documento), nombreBase (archivo), bloques, partes [firmanteDe…], expediente, setExpediente, aviso
export default function FirmaContrato({ clave, titulo, nombreBase, bloques, partes, expediente, setExpediente, aviso }) {
  const [dialogo, setDialogo] = useState(null);
  const firmas = expediente?.firmas || [];
  const total = partes.length;
  const faltan = partes.flatMap((p) => [!p.entidad && `nombre del ${p.etiqueta}`, !p.nif && `NIF del ${p.etiqueta}`, !p.nombre && `firmante del ${p.etiqueta}`, p.juridica && !p.dni && `DNI del firmante del ${p.etiqueta}`].filter(Boolean));
  const conHuecos = bloques.some((b) => /\[[^\]]+\]/.test([b.text, b.a, b.b, ...(b.filas || []).flat()].filter(Boolean).join(" ")));
  const pie = `${titulo} · Mi Despacho`;
  const fijar = (e) => { setExpediente(e); guardarExpediente(clave, e); };
  const opFirmado = () => ({
    documento: titulo,
    anexa: `Anexa al ${titulo.toLowerCase()}`,
    partes: expediente.partes.map((p) => `${p.entidad} (${p.nif}) — ${p.etiqueta}`).join(" · "),
    rol: (r) => expediente.partes.find((p) => p.rol === r)?.etiqueta || r,
    total,
  });

  const borrador = async () => { const { bytes } = await pdfContrato(bloques, { titulo, pie: pie + " · BORRADOR", fecha_generacion: new Date().toISOString() }); descargar(bytes, `${nombreBase} (BORRADOR).pdf`); };
  const cerrar = async () => {
    if (faltan.length) { aviso?.("Para cerrar el contrato falta: " + faltan.join(", ") + "."); return; }
    if (conHuecos && !window.confirm("El contrato todavía tiene huecos entre corchetes [ ]. ¿Cerrarlo así?")) return;
    if (!window.confirm("Al cerrar el contrato ya no se podrán cambiar los datos ni las cláusulas. ¿Continuar?")) return;
    const fecha_generacion = new Date().toISOString();
    const { bytes, hash } = await pdfContrato(bloques, { titulo, asunto: partes.map((p) => p.entidad).join(" / "), pie, fecha_generacion });
    fijar({ fecha_generacion, contrato_b64: b64(bytes), hash, firmas: [], bloques, partes });
    aviso?.("Contrato cerrado y listo para firmar");
  };
  const firmar = async (rol) => {
    const p = expediente.partes.find((x) => x.rol === rol);
    const ahora = new Date(), fecha_utc = ahora.toISOString();
    const id_firma = await sha256Hex(new TextEncoder().encode(`${expediente.hash}|${rol}|${p.dni}|${fecha_utc}`));
    const firma = {
      rol, entidad: p.entidad, nif: p.nif, nombre: p.nombre, dni: p.dni, cargo: p.cargo,
      fecha_utc, fecha_local: ahora.toLocaleString("es-ES", { timeZoneName: "short" }),
      metodo: "Firma electrónica en Mi Despacho: aceptación expresa de declaraciones y nombre escrito por el firmante (modo local, sin segundo factor)",
      navegador: navigator.userAgent.slice(0, 160), hash_contrato: expediente.hash, id_firma,
    };
    const nuevo = { ...expediente, firmas: [...firmas, firma] };
    fijar(nuevo); setDialogo(null);
    const { bytes } = await pdfFirmado(deB64(nuevo.contrato_b64), nuevo.hash, { ...opFirmado(), partes: nuevo.partes.map((x) => `${x.entidad} (${x.nif}) — ${x.etiqueta}`).join(" · ") }, nuevo.firmas);
    descargar(bytes, `${nombreBase} (firmado ${nuevo.firmas.length} de ${total}).pdf`);
  };
  const firmado = async () => { const { bytes } = await pdfFirmado(deB64(expediente.contrato_b64), expediente.hash, opFirmado(), firmas); descargar(bytes, `${nombreBase} (firmado ${firmas.length} de ${total}).pdf`); };
  const evidencias = () => descargar(new TextEncoder().encode(JSON.stringify({ documento: titulo, generado: expediente.fecha_generacion, huella_contrato_sha256: expediente.hash, partes: expediente.partes, firmas }, null, 2)), `${nombreBase} - evidencias.json`, "application/json");
  const reabrir = () => { if (window.confirm(firmas.length ? "El contrato ya tiene firmas. Si lo reabres, se descartan y habrá que volver a firmarlo. ¿Seguro?" : "¿Reabrir el contrato para cambiar datos o cláusulas?")) fijar(null); };
  const firmo = (r) => firmas.some((f) => f.rol === r);

  return (
    <section className="editor-clausulas">
      <div className="ia-cab">
        <div>
          <h2>Firma electrónica</h2>
          <p className="muted">{!expediente
            ? "Cuando los datos estén completos, cierra el contrato: se genera el PDF definitivo con su huella (SHA-256) y cada parte lo firma aquí. El PDF firmado lleva una hoja de evidencias."
            : <>Contrato cerrado · huella <code>{expediente.hash.slice(0, 16)}…</code> · {firmas.length === total ? "firmado por todas las partes." : `${firmas.length} de ${total} firmas.`}</>}</p>
        </div>
        <div className="acciones">
          {!expediente ? <>
            <button className="btn ghost" type="button" onClick={borrador}>Descargar borrador (PDF)</button>
            <button className="btn" type="button" onClick={cerrar}>Cerrar contrato y pasar a firma</button>
          </> : <>
            {firmas.length > 0 && <button className="btn" type="button" onClick={firmado}>PDF firmado</button>}
            <button className="btn ghost" type="button" onClick={() => descargar(deB64(expediente.contrato_b64), `${nombreBase} (original sin firmas).pdf`)}>Original</button>
            {firmas.length > 0 && <button className="btn ghost" type="button" onClick={evidencias}>Evidencias (.json)</button>}
            <button className="enlace" type="button" onClick={reabrir}>Reabrir</button>
          </>}
        </div>
      </div>
      {!expediente
        ? <p className={faltan.length ? "muted" : "ok-texto"}>{faltan.length ? "Para cerrar falta: " + faltan.join(", ") + "." : "Datos de las partes completos."}</p>
        : <ul className="contratadas">
            {expediente.partes.map((p) => (
              <li key={p.rol}><span className={firmo(p.rol) ? "si" : "no"}>{firmo(p.rol) ? "✓" : "○"}</span>
                {p.etiqueta} ({p.nombre}): {firmo(p.rol) ? "firmado" : <button className="enlace" type="button" onClick={() => setDialogo(p.rol)}>Firmar ahora</button>}</li>
            ))}
          </ul>}
      {dialogo && <DialogoFirma parte={expediente.partes.find((p) => p.rol === dialogo)} hash={expediente.hash} onCerrar={() => setDialogo(null)} onFirmar={() => firmar(dialogo)} />}
    </section>
  );
}
