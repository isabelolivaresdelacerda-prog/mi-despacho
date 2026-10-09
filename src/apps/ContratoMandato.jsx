// Contrato de mandato de venta (intermediación inmobiliaria o de activos). Plantilla jurídica fija y genérica:
// mismo sistema que cuentas en participación (formulario + borrador en vivo + Word + cláusulas editables).
import { useMemo, useState } from "react";
import { bloquesADocx, bloquesATexto } from "../docx.js";
import { GuardarEnNube, RevisionIA, useAviso } from "../comunes.jsx";
import { DialogoCorreo } from "../lib/CorreoUI.jsx";
import { EditorClausulas, VistaDocumento, aplicarCambios, leerCambios } from "../lib/contratoUI.jsx";
import { guardar as guardarEnCarpeta, raizGuardada, DESTINO } from "../lib/carpetas.js";
import { eurosEnLetras } from "../lib/numeroLetras.js";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const fmtFecha = (v, etq = "fecha") => { if (!v) return `[${etq}]`; const [y, m, d] = v.split("-").map(Number); return d + " de " + MESES[m - 1] + " de " + y; };
const fmtEur = (v) => { const n = parseFloat(v); return isNaN(n) ? "[importe]" : n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " euros"; };
const or = (v, etq = "●") => (String(v ?? "")).trim() || `[${etq}]`;
const num = (v, etq) => (String(v ?? "").trim() === "" ? `[${etq}]` : String(v).trim().replace(".", ","));

// Artículo de cada tipo, para que concuerde («titular del solar», «titular de la promoción»…)
const ART = { promocion: "de la", vivienda: "de la", nave: "de la", oficina: "de la", cartera: "de la", sociedad: "de las" };
const TIPOS_ACTIVO = {
  solar: "solar o parcela", edificio: "edificio", promocion: "promoción inmobiliaria en curso", vivienda: "vivienda", local: "local comercial",
  nave: "nave industrial", oficina: "oficina", cartera: "cartera de activos inmobiliarios", sociedad: "participaciones sociales de una sociedad titular de activos", otro: "activo",
};

const VACIO = {
  ciudad: "", fecha: new Date().toISOString().slice(0, 10),
  a_tipo: "juridica", a_nombre: "", a_nif: "", a_dom: "", a_rm: "", a_rep: "", a_rep_dni: "", a_cargo: "administrador único",
  m_tipo: "juridica", m_nombre: "", m_nif: "", m_dom: "", m_rm: "", m_rep: "", m_rep_dni: "", m_cargo: "administrador único",
  act_tipo: "solar", act_dir: "", act_mun: "", act_cat: "", act_reg: "", act_sup: "", act_desc: "", act_cargas: "", act_lic: "",
  exclusiva: "si", precio: "", margen: "5",
  hon_tipo: "pct", hon_pct: "3", hon_fijo: "", devengo: "arras", plazo_fra: "15", gastos: "Mandatario",
  dur: "6", prorroga: "6", preaviso: "30", proteccion: "12", conf: "2", subsana: "15", trib: "",
};

function parte(d, pre, rol) {
  const juridica = d[pre + "_tipo"] === "juridica";
  let s = or(d[pre + "_nombre"], rol.toUpperCase()) + ", con " + (juridica ? "NIF " : "DNI/NIF ") + or(d[pre + "_nif"], "NIF del " + rol) + " y domicilio" + (juridica ? " social" : "") + " en " + or(d[pre + "_dom"], "domicilio del " + rol);
  if (juridica) {
    if ((d[pre + "_rm"] || "").trim()) s += ", inscrita en el Registro Mercantil de " + d[pre + "_rm"].trim();
    s += ", representada en este acto por D./D.ª " + or(d[pre + "_rep"], "representante") + ", con DNI " + or(d[pre + "_rep_dni"], "DNI del representante") + ", en su condición de " + or(d[pre + "_cargo"], "cargo");
  } else s += ", que actúa en su propio nombre y derecho";
  return s + " (en adelante, el «" + rol + "»).";
}

export function construir(d) {
  const B = [];
  const h = (t) => B.push({ t: "h", text: t });
  const p = (t, lead) => B.push({ t: "p", text: t, lead });
  const tipo = TIPOS_ACTIVO[d.act_tipo] || "activo";
  const excl = d.exclusiva === "si";
  const precio = parseFloat(d.precio);
  const precioTxt = isNaN(precio) ? "[precio mínimo]" : fmtEur(precio) + " (" + eurosEnLetras(precio).toUpperCase() + ")";
  const honorarios = d.hon_tipo === "fijo"
    ? "una cantidad fija de " + fmtEur(d.hon_fijo)
    : "el " + num(d.hon_pct, "porcentaje") + " % del precio final de venta efectivamente cobrado por el Mandante";
  const devengo = d.devengo === "escritura"
    ? "en el momento del otorgamiento de la escritura pública de compraventa o del documento por el que se formalice la operación"
    : "en el momento de la firma del contrato de arras, señal o documento equivalente por el que el Mandante y el comprador o inversor queden vinculados, con independencia de que la escritura pública se otorgue después";

  B.push({ t: "title", text: "CONTRATO DE MANDATO DE VENTA" });
  p("En " + or(d.ciudad, "ciudad") + ", a " + fmtFecha(d.fecha, "fecha") + ".");
  h("REUNIDOS");
  p("De una parte, " + parte(d, "a", "Mandante"));
  p("De otra parte, " + parte(d, "m", "Mandatario"));
  p("Ambas partes se reconocen mutuamente la capacidad legal necesaria para otorgar el presente contrato de mandato de venta (en adelante, el «Contrato») y, a tal efecto,");
  h("EXPONEN");
  p("I. Que el Mandante es titular " + (ART[d.act_tipo] || "del") + " " + tipo + " que se describe en la cláusula primera (en adelante, el «Activo»).");
  p("II. Que el Mandante está interesado en vender el Activo, o en dar entrada en él a un inversor, y desea encomendar la búsqueda de comprador o inversor al Mandatario.");
  p("III. Que el Mandatario cuenta con los medios y la red de contactos necesarios para desarrollar esa labor de intermediación.");
  p("En su virtud, las partes acuerdan suscribir el presente Contrato con arreglo a las siguientes");
  h("CLÁUSULAS");
  p("El Mandante encomienda al Mandatario, que lo acepta, la gestión de venta del Activo, con las siguientes características:", "Primera. Objeto.");
  const filas = [
    ["Tipo de activo", tipo.charAt(0).toUpperCase() + tipo.slice(1)],
    ["Ubicación", [d.act_dir, d.act_mun].map((x) => (x || "").trim()).filter(Boolean).join(", ") || "[ubicación del Activo]"],
    ["Referencia catastral", (d.act_cat || "").trim() || "Pendiente de facilitar por el Mandante"],
    ["Datos registrales", (d.act_reg || "").trim()],
    ["Superficie", (d.act_sup || "").trim()],
    ["Descripción", (d.act_desc || "").trim()],
    ["Cargas", (d.act_cargas || "").trim() || "Libre de cargas, según manifestación del Mandante"],
    ["Licencias", (d.act_lic || "").trim()],
  ].filter(([, v]) => v);
  filas.forEach(([k, v]) => p(v, k + ":"));
  p("El mandato comprende, salvo pacto distinto por escrito: (a) la búsqueda activa de comprador o inversor para el Activo, ya sea mediante compraventa directa, entrada en el capital de la sociedad titular o cualquier otra estructura que acuerden las partes; (b) la preparación y presentación de documentación comercial y financiera del Activo a los potenciales interesados; (c) la negociación de las condiciones económicas con los interesados, dentro de los límites fijados en la cláusula segunda; y (d) el acompañamiento hasta la firma del contrato de arras o de compraventa, cuya firma corresponderá siempre al Mandante.");
  p("El presente mandato se otorga " + (excl ? "con carácter exclusivo." : "sin carácter exclusivo, pudiendo el Mandante encomendar la venta del Activo simultáneamente a otros intermediarios."));
  p("El Mandante fija como precio mínimo autorizado de venta del Activo la cantidad de " + precioTxt + ", más los impuestos que en su caso correspondan. El Mandatario podrá negociar con los interesados dentro de un margen de hasta el " + num(d.margen, "porcentaje") + " % por debajo de dicho precio, y trasladará al Mandante toda oferta recibida, cualquiera que sea su cuantía, para que decida si la acepta. Ninguna oferta vinculará al Mandante hasta su aceptación expresa y por escrito. La forma de pago de cada operación requerirá igualmente la aprobación expresa del Mandante.", "Segunda. Precio y condiciones de venta.");
  p("En concepto de honorarios por la intermediación, el Mandatario percibirá " + honorarios + ", más el IVA legalmente aplicable. Los honorarios se devengarán " + devengo + ". Si la operación se formaliza en varias fases o tramos, los honorarios se devengarán proporcionalmente a medida que se formalice cada uno. El Mandatario emitirá la correspondiente factura, que el Mandante abonará en el plazo de " + num(d.plazo_fra, "número de") + " días naturales desde su recepción. Los honorarios solo serán debidos si la operación se formaliza durante la vigencia del Contrato o dentro del plazo de protección de la cláusula cuarta, y con un comprador o inversor presentado o gestionado por el Mandatario. Los gastos de elaboración de materiales comerciales correrán por cuenta del " + (d.gastos === "Mandante" ? "Mandante" : "Mandatario") + "; cualquier gasto extraordinario requerirá autorización previa y por escrito del Mandante.", "Tercera. Honorarios.");
  p("El Contrato entrará en vigor en la fecha de su firma y tendrá una duración de " + num(d.dur, "número de") + " meses. A su vencimiento se prorrogará tácitamente por periodos sucesivos de " + num(d.prorroga, "número de") + " meses, salvo que cualquiera de las partes comunique a la otra su voluntad de no prorrogarlo con una antelación mínima de " + num(d.preaviso, "número de") + " días. Si dentro de los " + num(d.proteccion, "número de") + " meses siguientes a la terminación del Contrato el Mandante formaliza la venta con un comprador o inversor presentado por el Mandatario durante su vigencia, este conservará su derecho a los honorarios, siempre que haya comunicado por escrito al Mandante, antes de la terminación, la identidad de dicho interesado. " + (excl
    ? "Durante la vigencia del Contrato, el Mandante se obliga a no encomendar la venta del Activo a otro intermediario ni a negociarla directamente, salvo con compradores que acrediten haber contactado con él de forma espontánea y sin intervención del Mandatario, en cuyo caso no se devengarán honorarios. El incumplimiento de esta exclusiva dará derecho al Mandatario a percibir, como indemnización, el importe de los honorarios que le hubieran correspondido."
    : "Al no ser exclusivo, el Mandante podrá vender el Activo por sí mismo o a través de terceros sin devengar honorarios a favor del Mandatario, salvo lo previsto para los interesados presentados por este."), "Cuarta. Duración" + (excl ? ", protección y exclusiva." : " y protección."));
  p("El Mandante facilitará al Mandatario la documentación necesaria para la venta (nota simple registral, certificación catastral, licencias, proyecto técnico y certificado de eficiencia energética cuando proceda), le comunicará cualquier circunstancia relevante que afecte al Activo, permitirá las visitas de los interesados, responderá con diligencia a las ofertas y abonará los honorarios en plazo. El Mandatario desarrollará la búsqueda con diligencia profesional, trasladará al Mandante todas las ofertas recibidas, no comprometerá al Mandante frente a terceros sin su autorización expresa y por escrito, y llevará un registro de los interesados contactados a disposición del Mandante.", "Quinta. Obligaciones de las partes.");
  p("El Mandatario tratará como confidencial toda la información que reciba del Mandante y solo la facilitará a los potenciales compradores o inversores en la medida necesaria para el encargo, pudiendo exigirles previamente un acuerdo de confidencialidad. Esta obligación se mantendrá durante la vigencia del Contrato y los " + num(d.conf, "número de") + " años siguientes a su terminación. Ambas partes tratarán los datos personales que se intercambien conforme al Reglamento (UE) 2016/679 (RGPD) y a la Ley Orgánica 3/2018, exclusivamente para los fines de este Contrato.", "Sexta. Confidencialidad y protección de datos.");
  p("El Contrato podrá resolverse anticipadamente por mutuo acuerdo o por incumplimiento grave de cualquiera de las partes, previo requerimiento fehaciente concediendo un plazo de " + num(d.subsana, "número de") + " días para subsanarlo. La resolución no afectará a los honorarios ya devengados ni a la cláusula de protección. Este Contrato tiene naturaleza mercantil de mediación o corretaje y no genera relación laboral, societaria ni de representación orgánica entre las partes; el Mandatario actúa como profesional independiente.", "Séptima. Resolución y naturaleza del contrato.");
  p("Cada parte declara que actúa con fondos y bienes de origen lícito y se compromete a facilitar la documentación que se le solicite para cumplir la normativa de prevención del blanqueo de capitales y de la financiación del terrorismo, incluida la identificación de los compradores o inversores y de su titular real.", "Octava. Prevención del blanqueo de capitales.");
  p("Este Contrato se rige por la ley española. Para cualquier controversia, las partes se someten, con renuncia a cualquier otro fuero, a los juzgados y tribunales de " + or(d.trib, "ciudad") + ".", "Novena. Ley aplicable y jurisdicción.");
  p("Y en prueba de conformidad, las partes firman el presente Contrato por duplicado y a un solo efecto en el lugar y fecha indicados en el encabezamiento.");
  B.push({ t: "sig", a: "El Mandante\n" + or(d.a_nombre, "MANDANTE") + (d.a_tipo === "juridica" && d.a_rep ? "\np.p. " + d.a_rep : ""), b: "El Mandatario\n" + or(d.m_nombre, "MANDATARIO") + (d.m_tipo === "juridica" && d.m_rep ? "\np.p. " + d.m_rep : "") });
  return B;
}

const CLAVE_CAMBIOS = "md-mandato-clausulas";
const nombreArchivo = (d) => "Contrato de mandato de venta - " + ((d.a_nombre || "mandante").trim()) + " - " + ((d.m_nombre || "mandatario").trim()) + ".docx";

export default function ContratoMandato({ config, irAAjustes }) {
  // El Mandatario suele ser tu propia empresa: se rellena con tus datos (Ajustes › Empresa)
  const [d, setD] = useState(() => ({ ...VACIO, m_nombre: config?.empresa?.razon_social || "", m_nif: config?.empresa?.cif || "", m_dom: config?.empresa?.domicilio || "" }));
  const [doc, setDoc] = useState(null);
  const [aviso, nodoAviso] = useAviso();
  const [correo, setCorreo] = useState(false);
  const [cambios, setCambios] = useState(() => leerCambios(CLAVE_CAMBIOS));
  const base = useMemo(() => construir(d), [d]);
  const bloques = useMemo(() => aplicarCambios(base, cambios), [base, cambios]);
  const campo = (k) => ({ value: d[k], onChange: (e) => setD({ ...d, [k]: e.target.value }) });

  async function crear() {
    const nombre = nombreArchivo(d);
    try {
      const blob = await bloquesADocx(bloques);
      if (await raizGuardada()) {
        const r = await guardarEnCarpeta(blob, nombre, DESTINO.mandato_venta);
        if (r.modo === "carpeta") { aviso("Guardado en " + r.ruta); return; }
      }
      setDoc({ blob, nombre });
    } catch { aviso("No se pudo crear el Word. Prueba con «Copiar texto»."); }
  }
  function copiar() {
    try { navigator.clipboard.writeText(bloquesATexto(bloques)).then(() => aviso("Texto copiado"), () => aviso("No se pudo copiar")); } catch { aviso("No se pudo copiar"); }
  }
  function vaciar() { setD({ ...VACIO, ciudad: d.ciudad, trib: d.trib, fecha: new Date().toISOString().slice(0, 10) }); }

  const prompt = (ctx) => [
    "Actúa como especialista en derecho inmobiliario y mercantil español. Revisa este borrador de contrato de mandato de venta (mediación o corretaje inmobiliario).",
    "Señala, en español y sin tecnicismos innecesarios, un máximo de 8 puntos ordenados de más a menos importante. Para cada uno: el riesgo o hueco en una frase y una propuesta concreta de redacción.",
    "Fíjate en: devengo y cobro de honorarios, exclusiva y su indemnización, cláusula de protección, precio mínimo y margen, prevención del blanqueo (la intermediación inmobiliaria es sujeto obligado), protección de datos, coherencia de datos e importes y huecos marcados [●].",
    "No inventes artículos, sentencias ni cifras. Termina con una línea recordando que es una revisión orientativa. Formato: texto plano numerado, sin tablas.",
    ctx ? "\nCONTEXTO DEL CASO:\n" + ctx : "",
    "\nBORRADOR:\n" + bloquesATexto(bloques),
  ].join("\n");

  const Parte = ({ k, titulo }) => (
    <fieldset><legend>{titulo}</legend>
      <label>Es<select {...campo(k + "_tipo")}><option value="juridica">Una sociedad</option><option value="fisica">Una persona física</option></select></label>
      <label>{d[k + "_tipo"] === "juridica" ? "Razón social" : "Nombre y apellidos"}<input {...campo(k + "_nombre")} /></label>
      <div className="fila">
        <label>{d[k + "_tipo"] === "juridica" ? "NIF" : "DNI / NIF"}<input {...campo(k + "_nif")} /></label>
        <label>Domicilio<input {...campo(k + "_dom")} /></label>
      </div>
      {d[k + "_tipo"] === "juridica" && <>
        <label>Registro Mercantil de<input {...campo(k + "_rm")} /></label>
        <div className="fila">
          <label>Representante<input {...campo(k + "_rep")} /></label>
          <label>DNI del representante<input {...campo(k + "_rep_dni")} /></label>
        </div>
        <label>Cargo<select {...campo(k + "_cargo")}><option>administrador único</option><option>administrador solidario</option><option>administrador mancomunado</option><option>consejero delegado</option><option>apoderado</option></select></label>
      </>}
    </fieldset>
  );

  return (
    <div className="app">
      <header className="app-cab">
        <div>
          <div className="eyebrow">Contratos · Crear</div>
          <h1>Contrato de mandato de venta</h1>
          <p className="muted">Encargo de venta de un activo (inmueble, solar, promoción, cartera o sociedad) a un intermediario. Rellena los datos y el borrador se escribe solo; los huecos entre corchetes se completan con tus datos.</p>
        </div>
        <div className="acciones">
          <button className="btn" type="button" onClick={crear}>Crear contrato</button>
          <button className="btn ghost" type="button" onClick={copiar}>Copiar texto</button>
          <button className="btn ghost" type="button" onClick={() => setCorreo(true)}>Enviar por correo</button>
          <button className="btn ghost" type="button" onClick={vaciar}>Vaciar</button>
        </div>
      </header>

      <div className="dos-col">
        <form className="formulario" onSubmit={(e) => e.preventDefault()} autoComplete="off">
          <fieldset><legend>Lugar y fecha</legend>
            <div className="fila"><label>Ciudad<input {...campo("ciudad")} /></label><label>Fecha<input type="date" {...campo("fecha")} /></label></div>
          </fieldset>
          {Parte({ k: "a", titulo: "Mandante (propietario que vende)" })}
          {Parte({ k: "m", titulo: "Mandatario (intermediario)" })}
          <fieldset><legend>El activo</legend>
            <label>Tipo<select {...campo("act_tipo")}>{Object.entries(TIPOS_ACTIVO).map(([k, t]) => <option key={k} value={k}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}</select></label>
            <div className="fila"><label>Dirección<input {...campo("act_dir")} /></label><label>Municipio y provincia<input {...campo("act_mun")} /></label></div>
            <div className="fila"><label>Referencia catastral<input {...campo("act_cat")} placeholder="Si no la tienes, se pone «pendiente»" /></label><label>Finca registral / Registro<input {...campo("act_reg")} /></label></div>
            <label>Superficie<input {...campo("act_sup")} placeholder="p. ej. 6.545 m² sobre rasante y 3.477 m² bajo rasante" /></label>
            <label>Descripción<textarea rows={3} {...campo("act_desc")} placeholder="Qué es, qué permite construir, estado de ejecución…" /></label>
            <label>Cargas<textarea rows={2} {...campo("act_cargas")} placeholder="Vacío = libre de cargas según el Mandante" /></label>
            <label>Licencias<input {...campo("act_lic")} /></label>
          </fieldset>
          <fieldset><legend>Precio y exclusiva</legend>
            <div className="fila">
              <label>Precio mínimo (€)<input type="number" min="0" step="1" {...campo("precio")} /></label>
              <label>Margen de negociación (%)<input type="number" min="0" max="100" step="0.5" {...campo("margen")} /></label>
            </div>
            <label>Mandato<select {...campo("exclusiva")}><option value="si">En exclusiva</option><option value="no">Sin exclusiva</option></select></label>
          </fieldset>
          <fieldset><legend>Honorarios</legend>
            <div className="fila">
              <label>Tipo<select {...campo("hon_tipo")}><option value="pct">% sobre el precio</option><option value="fijo">Importe fijo</option></select></label>
              {d.hon_tipo === "fijo" ? <label>Importe (€, + IVA)<input type="number" min="0" step="0.01" {...campo("hon_fijo")} /></label> : <label>Porcentaje (+ IVA)<input type="number" min="0" max="100" step="0.1" {...campo("hon_pct")} /></label>}
            </div>
            <div className="fila">
              <label>Se cobran<select {...campo("devengo")}><option value="arras">A la firma de las arras</option><option value="escritura">A la firma de la escritura</option></select></label>
              <label>Pago de la factura (días)<input type="number" min="0" {...campo("plazo_fra")} /></label>
            </div>
            <label>Gastos de materiales comerciales<select {...campo("gastos")}><option value="Mandatario">A cargo del Mandatario</option><option value="Mandante">A cargo del Mandante</option></select></label>
          </fieldset>
          <fieldset><legend>Duración y otras condiciones</legend>
            <div className="fila"><label>Duración (meses)<input type="number" min="1" {...campo("dur")} /></label><label>Prórroga tácita (meses)<input type="number" min="0" {...campo("prorroga")} /></label></div>
            <div className="fila"><label>Preaviso de no prórroga (días)<input type="number" min="0" {...campo("preaviso")} /></label><label>Protección tras terminar (meses)<input type="number" min="0" {...campo("proteccion")} /></label></div>
            <div className="fila"><label>Confidencialidad (años)<input type="number" min="0" {...campo("conf")} /></label><label>Plazo para subsanar (días)<input type="number" min="0" {...campo("subsana")} /></label></div>
            <label>Tribunales de<input {...campo("trib")} /></label>
          </fieldset>
        </form>
        <VistaDocumento bloques={bloques} />
      </div>

      <EditorClausulas base={base} cambios={cambios} setCambios={setCambios} aviso={aviso} clave={CLAVE_CAMBIOS} ejemploTitulo="Décima. Título de la cláusula." />
      <div className="sin-ia"><strong>Este contrato no lo escribe la IA.</strong> El texto es una plantilla jurídica fija que se completa con tus datos y con las cláusulas que tú modifiques. La IA solo lo revisa si tú se lo pides aquí abajo, y no cambia nada por su cuenta.</div>
      <RevisionIA construirPrompt={prompt} irAAjustes={irAAjustes} />
      <p className="muted pie">Borrador orientativo. Revísalo y adáptalo a cada operación antes de firmar.</p>

      <GuardarEnNube abierto={!!doc} blob={doc?.blob} nombre={doc?.nombre || ""} config={config} onCerrar={() => setDoc(null)} irAAjustes={irAAjustes} />
      {correo && <DialogoCorreo opciones={["contrato_firma", "contrato_firmado"]}
        vars={{ documento: "contrato de mandato de venta", empresa: d.m_nombre, destinatario: (d.a_rep || d.a_nombre || "").split(" ")[0], remitente: config?.nombre || "" }}
        adjuntos={[{ nombre: nombreArchivo(d), blob: () => bloquesADocx(bloques) }]}
        onCerrar={() => setCorreo(false)} />}
      {nodoAviso}
    </div>
  );
}
