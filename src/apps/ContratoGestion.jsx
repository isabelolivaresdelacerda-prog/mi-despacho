// Contrato de gestión (asset management) de una sociedad inversora inmobiliaria. Plantilla jurídica fija y anónima:
// formulario + borrador en vivo + Word + cláusulas editables, igual que el resto de contratos.
import { useMemo, useState } from "react";
import FirmaContrato, { leerExpediente, firmanteDe } from "../lib/FirmaContrato.jsx";
import { bloquesADocx, bloquesATexto } from "../docx.js";
import { GuardarEnNube, RevisionIA, useAviso } from "../comunes.jsx";
import { DialogoCorreo } from "../lib/CorreoUI.jsx";
import { EditorClausulas, VistaDocumento, aplicarCambios, leerCambios, AvisoSinIA } from "../lib/contratoUI.jsx";
import { guardar as guardarEnCarpeta, raizGuardada, DESTINO } from "../lib/carpetas.js";
import { cifraYLetras } from "../lib/numeroLetras.js";
import { parte, firma, ParteForm, parteVacia, fmtFecha, or, num, eurosTxt, hoy, ACTIVO_VACIO, bloquesActivos, ActivosForm, tipoDe } from "../lib/contratoInmo.jsx";

// Bloques de funciones que se pueden incluir (se marcan en el formulario)
const FUNCIONES = {
  financieras: ["Funciones financieras", [
    "Supervisión de los informes financieros, que se elaborarán con periodicidad trimestral y se revisarán anualmente.",
    "Coordinación, recopilación de documentación y supervisión del proceso de formulación de las cuentas anuales, incluido el apoyo a los auditores.",
    "Relación con las entidades financiadoras, incluido el seguimiento del cumplimiento de las obligaciones (covenants) de los contratos de financiación.",
    "Supervisión del flujo de caja.",
    "Organización del pago de dividendos cuando proceda.",
  ]],
  inversion: ["Inversiones y desinversiones", [
    "Análisis de nuevas oportunidades de inversión, elaboración de modelos financieros y cartas de intenciones.",
    "Organización de los procesos de captación de fondos vinculados a nuevas adquisiciones.",
    "Preparación y coordinación de los procesos de venta de los Inmuebles.",
    "Asesoramiento al órgano de administración en las decisiones que requieran aprobación societaria.",
  ]],
  operativa: ["Gestión operativa y representación", [
    "Contratación y supervisión de proveedores.",
    "Seguimiento de pagos y facturación.",
    "Gestión de valoraciones y procesos de due diligence.",
    "Representación ante autoridades públicas y terceros.",
    "Gestión de garantías y fianzas.",
    "Obtención de certificaciones energéticas y demás documentación técnica de los Inmuebles.",
  ]],
  arrendamiento: ["Gestión de arrendamientos", [
    "Comercialización de los Inmuebles en arrendamiento y negociación de los contratos.",
    "Cobro de rentas, gestión de impagos y relación con los arrendatarios.",
    "Coordinación del mantenimiento y de las reparaciones.",
  ]],
  promocion: ["Desarrollo y promoción", [
    "Coordinación de la gestión urbanística y de la obtención de licencias.",
    "Selección y supervisión de proyectistas, dirección facultativa y constructoras.",
    "Control de plazos, presupuesto y calidad de las obras.",
  ]],
  secretaria: ["Secretaría societaria y soporte jurídico ordinario", [
    "Preparación de convocatorias, actas y certificaciones del órgano de administración y de la junta general, y llevanza de los libros societarios.",
    "Redacción y revisión de contratos ordinarios y ejecución práctica de los acuerdos sociales.",
    "Supervisión de las funciones desarrolladas por otros profesionales externos de la Sociedad.",
  ]],
};

const VACIO = {
  ciudad: "", fecha: hoy(),
  ...parteVacia("a"), ...parteVacia("m"),
  actividad: "la inversión inmobiliaria en sentido amplio, incluidas la adquisición, tenencia, gestión, arrendamiento, promoción, desarrollo, explotación y transmisión de bienes inmuebles, así como la participación en proyectos inmobiliarios de cualquier naturaleza",
  inmuebles: "lista", activos: [{ ...ACTIVO_VACIO }],
  dur: "10", prorroga: "10", preaviso: "12", obligatorio: "si",
  fn: { financieras: true, inversion: true, operativa: true, secretaria: false, arrendamiento: false, promocion: false },
  subcontratar: "si",
  fijo: "", dia_pago: "5", ipc: "si",
  variable: "no", var_pct: "", var_down: "", var_up: "",
  externos: "si", subsana: "30",
  pen_cuotas: "si", pen_f1: "", pen_f2: "",
  trib: "",
};

export function construir(d) {
  const B = [];
  const h = (t) => B.push({ t: "h", text: t });
  const p = (t, lead) => B.push({ t: "p", text: t, lead });
  const lista = d.inmuebles === "lista";
  const activos = d.activos && d.activos.length ? d.activos : [ACTIVO_VACIO];
  const varios = activos.length > 1;
  const fns = Object.keys(FUNCIONES).filter((k) => d.fn?.[k]);
  const durN = parseInt(d.dur, 10), proN = parseInt(d.prorroga, 10), preN = parseInt(d.preaviso, 10);
  const anios = (n, txt) => (isNaN(n) ? `[${txt}]` : cifraYLetras(n) + (n === 1 ? " año" : " años"));
  const meses = (n, txt) => (isNaN(n) ? `[${txt}]` : cifraYLetras(n) + (n === 1 ? " mes" : " meses"));
  const escenarios = d.variable === "escenarios";

  B.push({ t: "title", text: "CONTRATO DE GESTIÓN" });
  p("En " + or(d.ciudad, "ciudad") + ", a " + fmtFecha(d.fecha) + ".");
  h("REUNIDOS");
  p("De una parte, " + parte(d, "a", "Propietario").replace("(en adelante, el «Propietario»)", "(en adelante, la «Sociedad» o el «Propietario»)"));
  p("De otra parte, " + parte(d, "m", "Gestor"));
  p("Ambas, en adelante, conjuntamente, las «Partes» e individualmente, una «Parte».");
  h("EXPONEN");
  p("I. Que el Propietario tiene por actividad " + or(d.actividad, "actividad de la Sociedad") + ".");
  const resumen = activos.map((a, i) => (varios ? "(" + (i + 1) + ") " : "") + tipoDe(a).toLowerCase() + ([a.nombre, a.dir, a.mun].some((v) => (v || "").trim()) ? " — " + [a.nombre, [a.dir, a.mun].filter((v) => (v || "").trim()).join(", ")].filter((v) => (v || "").trim()).join(", ") : "") + ((a.reg || "").trim() ? ", " + a.reg.trim() : "")).join("; ");
  p("II. " + (lista
    ? "Que, a la fecha de este Contrato, el Propietario es titular de " + (varios ? "los siguientes inmuebles: " : "el siguiente inmueble: ") + resumen + ", que se describe" + (varios ? "n" : "") + " con detalle en el Anexo I (en adelante, junto con los que adquiera en el futuro, los «Inmuebles» y cada uno de ellos, un «Inmueble»). Los inmuebles que el Propietario adquiera durante la vigencia del Contrato quedarán sujetos a él desde su adquisición y se incorporarán al Anexo I."
    : "Que los inmuebles objeto del presente Contrato (en adelante, los «Inmuebles» y cada uno de ellos, un «Inmueble») se incorporarán progresivamente al patrimonio del Propietario conforme se vayan materializando las adquisiciones, quedarán sujetos al presente Contrato desde el momento de su adquisición y se relacionarán en el Anexo I."));
  p("III. Que el Gestor cuenta con la experiencia y los medios técnicos y humanos necesarios para prestar servicios de gestión inmobiliaria, operativa, administrativa, financiera y de desinversión.");
  p("IV. Que el Propietario desea encomendar al Gestor la prestación de los servicios descritos en el presente Contrato (en adelante, los «Servicios»), y el Gestor la acepta con sujeción a las siguientes");
  h("CLÁUSULAS");
  p("El presente Contrato tiene por objeto regular los términos y condiciones en los que el Gestor prestará al Propietario los servicios de gestión integral de los Inmuebles relacionados en el Anexo I, de los que se incorporen a él en el futuro y de la actividad de la Sociedad (en adelante, el «Proyecto»). Las Partes actualizarán el Anexo I, mediante documento firmado por ambas, cada vez que el Propietario adquiera o transmita un Inmueble.", "Primera. Objeto.");
  p("El nombramiento del Gestor comenzará en la fecha de firma del presente Contrato y tendrá una duración inicial " + (d.obligatorio === "si" ? "obligatoria " : "") + "de " + anios(durN, "duración") + ", prorrogable tácitamente por periodos sucesivos de " + anios(proN, "prórroga") + ", salvo que cualquiera de las Partes notifique de forma fehaciente a la otra su voluntad de no prorrogarlo con un preaviso mínimo de " + meses(preN, "preaviso") + "." + (d.obligatorio === "si" ? " Tanto el periodo inicial como sus prórrogas tendrán carácter obligatorio para ambas Partes." : "") +
    "\nLa Sociedad nombra al Gestor gestor de activos (asset manager), con responsabilidad principal en la prestación de los Servicios, siempre con sujeción a las políticas generales, directrices y control del órgano de administración y al plan de negocio vigente en cada momento. La Sociedad comunicará al Gestor cualquier modificación del plan de negocio que pueda afectar al presente Contrato, y el Gestor no ejercerá facultades discrecionales contrarias a dicho plan." +
    "\nEl Gestor deberá: (a) actuar con la diligencia, el cuidado y la pericia propios de un gestor profesional; (b) realizar sus mejores esfuerzos para que la Sociedad cumpla el plan de negocio; (c) servir fielmente los intereses de la Sociedad; y (d) actuar en todo momento de buena fe, sin provocar el incumplimiento por la Sociedad de sus estatutos, del plan de negocio, de las instrucciones válidas de su órgano de administración, de sus contratos de financiación o de su régimen fiscal.", "Segunda. Nombramiento y duración.");
  p(fns.length
    ? "Durante la vigencia del Contrato, el Gestor asumirá las siguientes funciones:\n" + fns.map((k, i) => (i + 1) + ". " + FUNCIONES[k][0] + ":\n" + FUNCIONES[k][1].map((t) => "– " + t).join("\n")).join("\n")
    : "[Funciones del Gestor]", "Tercera. Funciones del Gestor.");
  p("El Gestor dispondrá de las facultades necesarias para el cumplimiento de sus funciones, dentro de los límites del plan de negocio y del poder que le confiera la Sociedad. En particular, podrá, en nombre y por cuenta de la Sociedad: (a) negociar y formalizar los contratos necesarios para la prestación de los Servicios; (b) designar asesores y expertos; (c) representar a la Sociedad en procedimientos administrativos o judiciales relacionados con los Servicios; (d) solicitar licencias y autorizaciones; y (e) preparar documentación para su firma por la Sociedad. Estas facultades permanecerán vigentes mientras lo esté el Contrato.", "Cuarta. Facultades del Gestor.");
  p((d.subcontratar === "si"
    ? "El Gestor podrá prestar los Servicios directamente o mediante la subcontratación parcial de algunos de ellos, y seguirá siendo responsable frente a la Sociedad de las actuaciones de sus subcontratistas. "
    : "El Gestor prestará los Servicios directamente, sin subcontratarlos. ") + "La delegación de funciones requerirá la autorización previa y por escrito de la Sociedad, sin perjuicio de la responsabilidad del Gestor frente a ésta.", "Quinta. Subcontratación y delegación.");
  let hon = "Como contraprestación por los Servicios, la Sociedad abonará al Gestor una retribución fija de " + eurosTxt(d.fijo, "importe") + " mensuales, más el IVA aplicable, pagadera dentro de los " + num(d.dia_pago, "número de") + " primeros días de cada mes mediante transferencia bancaria contra factura.";
  if (d.ipc === "si") hon += "\nDicha retribución se actualizará automáticamente el 1 de enero de cada año conforme a la variación interanual del Índice de Precios al Consumo (IPC) general publicada por el Instituto Nacional de Estadística para el mes de diciembre anterior. Si la variación fuese negativa, la retribución no se reducirá.";
  if (d.variable !== "no") {
    hon += "\nAdemás, el Gestor tendrá derecho a una retribución variable equivalente " + (escenarios
      ? "al " + num(d.var_down, "porcentaje") + " % del Beneficio Neto Final del Proyecto si se alcanza el escenario downside case, y al " + num(d.var_up, "porcentaje") + " % si se alcanza el escenario upside case. Los escenarios downside case y upside case son los definidos en el plan de negocio aprobado por el órgano de administración al inicio del Proyecto o en su última versión aprobada."
      : "al " + num(d.var_pct, "porcentaje") + " % del Beneficio Neto Final del Proyecto.");
    hon += "\nSe entiende por «Beneficio Neto Final del Proyecto» el resultado positivo obtenido por la Sociedad tras la completa ejecución y desinversión del Proyecto, una vez deducidos todos los costes de adquisición, urbanización, construcción, comercialización, financiación externa, gastos operativos e Impuesto sobre Sociedades efectivamente satisfecho, sin deducir los intereses de préstamos concedidos por socios o partes vinculadas. La retribución variable solo se devengará una vez materializada la desinversión total del Proyecto y percibido íntegramente su precio, y no se devengará si el resultado del Proyecto es negativo.";
  }
  hon += "\nTodos los importes de este Contrato se entienden más IVA.";
  p(hon, "Sexta. Honorarios.");
  if (d.externos === "si") p("Quedan fuera del objeto del presente Contrato y de la responsabilidad técnica del Gestor las funciones especializadas de carácter contable, fiscal, financiero o de cumplimiento normativo que requieran informe, certificación u opinión profesional independiente, incluidas la llevanza material de la contabilidad, la formulación técnica de las cuentas anuales y la confección y presentación de impuestos y declaraciones tributarias. Estas funciones las prestarán asesores externos contratados por la Sociedad mediante mandatos independientes, y el Gestor se limitará a organizar, coordinar y supervisar sus trabajos. Quedan igualmente excluidos los trabajos propios de auditor, experto independiente o certificador.", "Séptima. Funciones excluidas.");
  p("La Sociedad reembolsará al Gestor los gastos razonables y debidamente justificados en que incurra en la prestación de los Servicios, salvo los gastos estructurales propios del Gestor (personal y oficinas), salvo pacto expreso en contrario.", "Octava. Gastos.");
  p("El Gestor actuará de buena fe y con la diligencia debida. No responderá de la falta de rentabilidad del Proyecto ni de los errores de juicio adoptados de buena fe, salvo en caso de dolo, negligencia grave o incumplimiento contractual. La Sociedad mantendrá indemne al Gestor frente a las reclamaciones derivadas del ejercicio legítimo de sus funciones, salvo en los supuestos anteriores.", "Novena. Responsabilidad.");
  p("Ninguna de las Partes podrá ceder el presente Contrato sin el consentimiento previo y por escrito de la otra, salvo la cesión por la Sociedad a otra sociedad de su grupo.", "Décima. Cesión.");
  let res = "Cualquiera de las Partes podrá resolver el presente Contrato en caso de incumplimiento grave de la otra que no se subsane en el plazo de " + num(d.subsana, "número de") + " días desde su notificación fehaciente.";
  const pen = [];
  if (d.obligatorio === "si") {
    pen.push("percibir los honorarios fijos devengados y no satisfechos hasta la fecha efectiva de terminación");
    if (d.pen_cuotas === "si") pen.push("percibir, en concepto de cláusula penal, el importe equivalente a las mensualidades fijas que resten hasta el final del periodo obligatorio en curso");
    if (escenarios && ((d.pen_f1 || "").trim() || (d.pen_f2 || "").trim())) pen.push("percibir una indemnización por la pérdida de expectativa de la retribución variable equivalente al " + num(d.pen_f1, "porcentaje") + " % del beneficio estimado en el escenario upside case del último plan de negocio aprobado si la resolución se produce en la fase de adquisición, estructuración y ordenación urbanística inicial del Proyecto, o al " + num(d.pen_f2, "porcentaje") + " % si se produce en la fase de desarrollo, ejecución de obra o comercialización avanzada. Esta cantidad tendrá carácter liquidatorio y compensatorio definitivo respecto de la retribución variable no devengada");
    res += "\nSi la Sociedad pone fin al Contrato anticipadamente durante el periodo obligatorio sin causa imputable al Gestor, éste tendrá derecho a: " + pen.map((x, i) => "(" + "abc"[i] + ") " + x).join("; ") + ".";
  }
  res += "\nA la terminación del Contrato, el Gestor entregará a la Sociedad toda la documentación y facilitará una transición ordenada de los Servicios.";
  p(res, "Undécima. Resolución.");
  p("Las Partes mantendrán la confidencialidad de la información a la que accedan con ocasión del presente Contrato, salvo obligación legal o requerimiento de autoridad. Tratarán los datos personales que intercambien conforme al Reglamento (UE) 2016/679 y a la Ley Orgánica 3/2018, únicamente para los fines de este Contrato.", "Duodécima. Confidencialidad y protección de datos.");
  p("Cualquier modificación del presente Contrato deberá formalizarse por escrito y firmarse por ambas Partes.", "Decimotercera. Modificaciones.");
  p("El presente Contrato se rige por el Derecho español. Las Partes se someten a los Juzgados y Tribunales de " + or(d.trib, "ciudad") + ", con renuncia a cualquier otro fuero.", "Decimocuarta. Ley aplicable y jurisdicción.");
  p("Y en prueba de conformidad, las Partes firman el presente Contrato por duplicado y a un solo efecto en el lugar y fecha indicados en el encabezamiento.");
  B.push({ t: "sig", a: firma(d, "a", "La Sociedad"), b: firma(d, "m", "El Gestor") });
  B.push({ t: "salto" });
  h("ANEXO I · INMUEBLES");
  if (lista) bloquesActivos(B, activos, {});
  else p("A la fecha de firma, el Propietario no es titular de ningún inmueble. Los Inmuebles se irán incorporando a este Anexo conforme se adquieran, mediante documento firmado por ambas Partes.");
  return B;
}

const CLAVE_CAMBIOS = "md-gestion-clausulas";
const nombreArchivo = (d) => ("Contrato de gestión - " + ((d.a_nombre || "sociedad").trim()) + " - " + ((d.m_nombre || "gestor").trim())).replace(/[\\/:*?"<>|]/g, "") + ".docx";

export default function ContratoGestion({ config, irAAjustes }) {
  // El Gestor suele ser tu propia empresa: se rellena con tus datos (Ajustes › Empresa)
  const [d, setD] = useState(() => ({ ...VACIO, m_nombre: config?.empresa?.razon_social || "", m_nif: config?.empresa?.cif || "", m_dom: config?.empresa?.domicilio || "" }));
  const [doc, setDoc] = useState(null);
  const [aviso, nodoAviso] = useAviso();
  const [correo, setCorreo] = useState(false);
  const [cambios, setCambios] = useState(() => leerCambios(CLAVE_CAMBIOS));
  const base = useMemo(() => construir(d), [d]);
  const [exp, setExp] = useState(() => leerExpediente("md-gestion-expediente")); // contrato cerrado para firmar
  const bloquesVivos = useMemo(() => aplicarCambios(base, cambios), [base, cambios]);
  const bloques = exp?.bloques || bloquesVivos;
  const campo = (k) => ({ value: d[k], onChange: (e) => setD({ ...d, [k]: e.target.value }) });

  async function crear() {
    const nombre = nombreArchivo(d);
    try {
      const blob = await bloquesADocx(bloques);
      if (await raizGuardada()) {
        const r = await guardarEnCarpeta(blob, nombre, DESTINO.gestion);
        if (r.modo === "carpeta") { aviso("Guardado en " + r.ruta); return; }
      }
      setDoc({ blob, nombre });
    } catch { aviso("No se pudo crear el Word. Prueba con «Copiar texto»."); }
  }
  function copiar() {
    try { navigator.clipboard.writeText(bloquesATexto(bloques)).then(() => aviso("Texto copiado"), () => aviso("No se pudo copiar")); } catch { aviso("No se pudo copiar"); }
  }
  const vaciar = () => setD({ ...VACIO, ciudad: d.ciudad, trib: d.trib, m_nombre: d.m_nombre, m_nif: d.m_nif, m_dom: d.m_dom });

  const prompt = (ctx) => [
    "Actúa como especialista en derecho mercantil e inmobiliario español. Revisa este borrador de contrato de gestión (asset management) entre una sociedad inversora inmobiliaria y su gestor.",
    "Señala, en español y sin tecnicismos innecesarios, un máximo de 8 puntos ordenados de más a menos importante. Para cada uno: el riesgo o hueco en una frase y una propuesta concreta de redacción.",
    "Fíjate en: duración obligatoria y su exigibilidad, cláusula penal y su posible moderación judicial (art. 1154 CC), definición y devengo de la retribución variable, límites de las facultades del gestor y conflictos de interés, responsabilidad, funciones excluidas, coherencia de importes y huecos marcados [●].",
    "No inventes artículos, sentencias ni cifras. Si citas una norma y no estás seguro, dilo. Termina con una línea recordando que es una revisión orientativa. Formato: texto plano numerado, sin tablas.",
    ctx ? "\nCONTEXTO DEL CASO:\n" + ctx : "",
    "\nBORRADOR:\n" + bloquesATexto(bloques),
  ].join("\n");

  return (
    <div className="app">
      <header className="app-cab">
        <div>
          <div className="eyebrow">Contratos · Crear</div>
          <h1>Contrato de gestión</h1>
          <p className="muted">Encargo de la gestión integral (asset management) de una sociedad inversora inmobiliaria y de sus inmuebles. Rellena los datos y el borrador se escribe solo; los huecos entre corchetes se completan con tus datos.</p>
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
          {exp && <p className="nota">El contrato está cerrado para la firma: los datos ya no se pueden cambiar. Para cambiarlos, pulsa «Reabrir» en «Firma electrónica».</p>}
          <fieldset disabled={!!exp} className="bloqueo">
          <fieldset><legend>Lugar y fecha</legend>
            <div className="fila"><label>Ciudad<input {...campo("ciudad")} /></label><label>Fecha<input type="date" {...campo("fecha")} /></label></div>
          </fieldset>
          {ParteForm(d, campo, "a", "Sociedad (propietaria)", { enConstitucion: true })}
          {ParteForm(d, campo, "m", "Gestor")}
          <fieldset><legend>Actividad e inmuebles</legend>
            <label>Actividad de la sociedad<textarea rows={3} {...campo("actividad")} /></label>
            <label>Inmuebles<select {...campo("inmuebles")}>
              <option value="lista">Ya tiene inmuebles o suelos (descríbelos abajo)</option>
              <option value="progresivos">Todavía no tiene ninguno; se irán incorporando</option>
            </select></label>
          </fieldset>
          {d.inmuebles === "lista" && <ActivosForm activos={d.activos} setActivos={(activos) => setD({ ...d, activos })} titulo="Inmueble o suelo" textoAnadir="+ Añadir otro inmueble o suelo" />}
          <fieldset><legend>Duración</legend>
            <div className="fila"><label>Duración inicial (años)<input type="number" min="1" {...campo("dur")} /></label><label>Prórrogas (años)<input type="number" min="0" {...campo("prorroga")} /></label></div>
            <div className="fila">
              <label>Preaviso de no prórroga (meses)<input type="number" min="0" {...campo("preaviso")} /></label>
              <label>Duración obligatoria<select {...campo("obligatorio")}><option value="si">Sí, para ambas partes</option><option value="no">No</option></select></label>
            </div>
          </fieldset>
          <fieldset><legend>Funciones del gestor</legend>
            {Object.entries(FUNCIONES).map(([k, [t]]) => (
              <label key={k} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={!!d.fn[k]} onChange={(e) => setD({ ...d, fn: { ...d.fn, [k]: e.target.checked } })} style={{ width: "auto" }} />{t}
              </label>
            ))}
            <p className="nota">Las tareas de cada bloque se pueden cambiar después en «Modificar cláusulas».</p>
            <label>Subcontratar parte de los servicios<select {...campo("subcontratar")}><option value="si">Puede subcontratar (responde de sus subcontratistas)</option><option value="no">No puede subcontratar</option></select></label>
            <label>Contabilidad, impuestos y auditoría<select {...campo("externos")}><option value="si">Fuera del contrato (los hacen asesores externos)</option><option value="no">No decir nada</option></select></label>
          </fieldset>
          <fieldset><legend>Honorarios</legend>
            <div className="fila"><label>Fijo mensual (€, + IVA)<input type="number" min="0" step="0.01" {...campo("fijo")} /></label><label>Se paga en los primeros (días)<input type="number" min="1" {...campo("dia_pago")} /></label></div>
            <label>Actualización con el IPC<select {...campo("ipc")}><option value="si">Sí, cada 1 de enero (nunca baja)</option><option value="no">No</option></select></label>
            <label>Retribución variable<select {...campo("variable")}>
              <option value="no">No hay</option>
              <option value="pct">% del beneficio neto final</option>
              <option value="escenarios">% según escenario del plan de negocio (downside / upside)</option>
            </select></label>
            {d.variable === "pct" && <label>% del beneficio<input type="number" min="0" max="100" step="0.5" {...campo("var_pct")} /></label>}
            {d.variable === "escenarios" && <div className="fila"><label>% en downside case<input type="number" min="0" max="100" step="0.5" {...campo("var_down")} /></label><label>% en upside case<input type="number" min="0" max="100" step="0.5" {...campo("var_up")} /></label></div>}
          </fieldset>
          <fieldset><legend>Resolución y jurisdicción</legend>
            <label>Plazo para subsanar un incumplimiento (días)<input type="number" min="0" {...campo("subsana")} /></label>
            {d.obligatorio === "si" && <label>Si la sociedad lo resuelve antes sin causa<select {...campo("pen_cuotas")}><option value="si">Paga las mensualidades que falten (cláusula penal)</option><option value="no">Solo paga lo devengado</option></select></label>}
            {d.obligatorio === "si" && d.variable === "escenarios" && <div className="fila">
              <label>Indemnización fase inicial (% del upside)<input type="number" min="0" max="100" step="0.5" {...campo("pen_f1")} /></label>
              <label>Indemnización fase de obra o venta (% del upside)<input type="number" min="0" max="100" step="0.5" {...campo("pen_f2")} /></label>
            </div>}
            <label>Tribunales de<input {...campo("trib")} /></label>
          </fieldset>
          </fieldset>
        </form>
        <VistaDocumento bloques={bloques} />
      </div>

      <EditorClausulas base={base} cambios={cambios} setCambios={setCambios} aviso={aviso} clave={CLAVE_CAMBIOS} ejemploTitulo="Decimoquinta. Título de la cláusula." bloqueado={!!exp} />
      <FirmaContrato clave="md-gestion-expediente" titulo="Contrato de gestión" nombreBase={nombreArchivo(d).replace(/\.docx$/, "")} bloques={bloquesVivos} partes={[firmanteDe(d, "a", "a", "Sociedad"), firmanteDe(d, "m", "m", "Gestor")]} expediente={exp} setExpediente={setExp} aviso={aviso} />
      <AvisoSinIA />
      <RevisionIA construirPrompt={prompt} irAAjustes={irAAjustes} />
      <p className="muted pie">Borrador orientativo. Revísalo y adáptalo a cada caso antes de firmar.</p>

      <GuardarEnNube abierto={!!doc} blob={doc?.blob} nombre={doc?.nombre || ""} config={config} onCerrar={() => setDoc(null)} irAAjustes={irAAjustes} />
      {correo && <DialogoCorreo opciones={["contrato_firma", "contrato_firmado"]}
        vars={{ documento: "contrato de gestión", empresa: d.m_nombre, destinatario: (d.a_rep || d.a_nombre || "").split(" ")[0], remitente: config?.nombre || "" }}
        adjuntos={[{ nombre: nombreArchivo(d), blob: () => bloquesADocx(bloques) }]}
        onCerrar={() => setCorreo(false)} />}
      {nodoAviso}
    </div>
  );
}
