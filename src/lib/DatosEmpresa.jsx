// Ajustes → Datos de la empresa (para la papelería corporativa, facturas y contratos)
import { useState } from "react";
import { FORMAS, OPCIONES_ESFL } from "./entidad.js";
import { EMPRESA_VACIA, nifValido, pieMercantil } from "./empresa.js";

export default function DatosEmpresa({ config, guardar }) {
  const [e, setE] = useState({ ...EMPRESA_VACIA, razon_social: config.nombre || "", ...(config.empresa || {}) });
  const [msg, setMsg] = useState("");
  const c = (k, t, props = {}) => (
    <label className={props.ancho ? "ancho" : undefined}>{t}<input value={e[k]} onChange={(ev) => setE({ ...e, [k]: ev.target.value })} {...props} ancho={undefined} /></label>
  );
  const errores = [];
  if (e.cif && !nifValido(e.cif)) errores.push("El CIF no es válido.");

  return (
    <section className="tarjeta">
      <h2>Datos de la entidad</h2>
      <p className="muted">Salen en las facturas, la hoja de carta, los informes y los contratos.</p>
      <label>Forma jurídica
        <select value={e.forma || "sl"} onChange={(ev) => setE({ ...e, forma: ev.target.value })}>{Object.entries(FORMAS).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
      </label>
      {["asociacion", "fundacion"].includes(e.forma) && (
        <div className="nota">
          <p><strong>{e.forma === "asociacion" ? "Asociación" : "Fundación"}:</strong> la contabilidad usará el plan de entidades sin fines lucrativos (fondo social, cuotas de asociados, donativos, subvenciones, excedente), los impuestos de una entidad sin ánimo de lucro y el calendario de asamblea y rendición de cuentas. Tienes una guía en el menú: «Guía: asociaciones».</p>
          {OPCIONES_ESFL.map(([k, t]) => <label key={k} className="check"><input type="checkbox" checked={!!e.esfl?.[k]} onChange={(ev) => setE({ ...e, esfl: { ...(e.esfl || {}), [k]: ev.target.checked } })} /> {t}</label>)}
        </div>
      )}
      <div className="rejilla-2">
        {c("razon_social", ["asociacion", "fundacion"].includes(e.forma) ? "Denominación" : "Razón social", { placeholder: "Beatriz Inversiones, S.L.", ancho: true })}
        {c("cif", "CIF")}
        {c("email", "Correo", { type: "email" })}
        {c("domicilio", "Domicilio social", { placeholder: "Calle, número, piso", ancho: true })}
        {c("cp", "Código postal")}
        {c("municipio", "Municipio")}
        {c("provincia", "Provincia")}
        {c("telefono", "Teléfono")}
        {c("web", "Web")}
      </div>
      {["asociacion", "fundacion"].includes(e.forma) ? (<>
        <p className="ce-sub">Inscripción en el registro</p>
        <div className="rejilla-2">
          {c("registro", e.forma === "asociacion" ? "Registro de Asociaciones" : "Registro de Fundaciones", { placeholder: e.forma === "asociacion" ? "Nacional / de la Comunidad de Madrid" : "Estatal / autonómico" })}
          {c("inscripcion", "Número de inscripción")}
        </div>
      </>) : (<>
        <p className="ce-sub">Inscripción en el Registro Mercantil</p>
        <div className="rejilla-2">
          {c("registro", "Registro Mercantil de", { placeholder: "Madrid" })}
          {c("tomo", "Tomo")}
          {c("folio", "Folio")}
          {c("hoja", "Hoja", { placeholder: "M-000000" })}
          {c("inscripcion", "Inscripción", { placeholder: "1ª" })}
        </div>
      </>)}
      {pieMercantil(e) && <p className="nota"><strong>Pie de documentos:</strong> {pieMercantil(e)}</p>}
      {errores.length > 0 && <p className="nota error">{errores.join(" ")}</p>}
      {msg && <p className="muted">{msg}</p>}
      <button className="btn" type="button" disabled={errores.length > 0} onClick={() => { guardar({ ...config, empresa: { ...e, cif: e.cif.toUpperCase().replace(/[\s.-]/g, ""), cuentas: config.empresa?.cuentas, iban: config.empresa?.iban } }); /* las cuentas se guardan en su propio apartado */ setMsg("Guardado"); }}>Guardar</button>
    </section>
  );
}
