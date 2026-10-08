import { useMemo, useState } from "react";
import { bloquesADocx, bloquesATexto } from "../docx.js";
import { GuardarEnNube, RevisionIA, useAviso } from "../comunes.jsx";
import NegocioCampos from "./cuentas/NegocioCampos.jsx";
import { NEGOCIO_VACIO, describirNegocio, estimacionesNegocio, perimetroNegocio, anexoNegocio } from "./cuentas/negocio.js";
import { DialogoCorreo } from "../lib/CorreoUI.jsx";
import { EditorClausulas, VistaDocumento, aplicarCambios, leerCambios } from "../lib/contratoUI.jsx";
import { guardar as guardarEnCarpeta, raizGuardada, DESTINO } from "../lib/carpetas.js";

const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const fmtFecha = (v, etq = "fecha") => { if (!v) return `[${etq}]`; const [y, m, d] = v.split("-").map(Number); return d + " de " + MESES[m - 1] + " de " + y; };
const fmtEur = (v) => { const n = parseFloat(v); return isNaN(n) ? "[importe]" : n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " euros"; };
const or = (v, etq = "●") => (v || "").trim() || `[${etq}]`;

const EJEMPLO = {
  ciudad: "", fecha: new Date().toISOString().slice(0, 10),
  g_nombre: "", g_nif: "", g_dom: "", g_rep: "", g_cargo: "",
  p_nombre: "", p_nif: "", p_dom: "", p_rep: "", p_cargo: "",
  neg: { ...NEGOCIO_VACIO },
  importe: "", f_aport: "", iban: "",
  pct: "", perdidas: "limite", info: "trimestral", dias: "60",
  dur: "negocio", f_fin: "", trib: "",
};

function parte(d, pre, rol) {
  let s = or(d[pre + "_nombre"], rol.toUpperCase()) + ", con NIF " + or(d[pre + "_nif"], "NIF del " + rol) + " y domicilio en " + or(d[pre + "_dom"], "domicilio del " + rol);
  if ((d[pre + "_rep"] || "").trim()) s += ", representada por " + d[pre + "_rep"].trim() + (d[pre + "_cargo"] ? ", en su condición de " + d[pre + "_cargo"].trim() : "");
  return s + " (en adelante, el «" + rol + "»).";
}

function construir(d) {
  const B = [];
  const h = (t) => B.push({ t: "h", text: t });
  const p = (t, lead) => B.push({ t: "p", text: t, lead });
  const perd = d.perdidas === "no"
    ? "El Partícipe no participará en las pérdidas del negocio."
    : "El Partícipe participará en las pérdidas del negocio en la misma proporción, hasta el límite del importe de su aportación. En ningún caso estará obligado a realizar aportaciones adicionales.";
  const dur = d.dur === "fecha"
    ? "El presente contrato estará en vigor desde su firma hasta el " + fmtFecha(d.f_fin) + ", salvo que el negocio termine antes."
    : "El presente contrato estará en vigor desde su firma hasta la terminación del negocio descrito en la cláusula primera.";

  B.push({ t: "title", text: "CONTRATO DE CUENTAS EN PARTICIPACIÓN" });
  p("En " + or(d.ciudad, "ciudad") + ", a " + fmtFecha(d.fecha, "fecha") + ".");
  h("REUNIDOS");
  p("De una parte, " + parte(d, "g", "Gestor"));
  p("De otra parte, " + parte(d, "p", "Partícipe"));
  p("Ambas partes se reconocen capacidad legal suficiente para otorgar el presente contrato y, a tal efecto,");
  h("EXPONEN");
  const neg = d.neg || NEGOCIO_VACIO;
  p("I. Que el Gestor desarrolla en nombre propio " + describirNegocio(neg) + " (en adelante, el «Negocio»).");
  const est = estimacionesNegocio(neg);
  if (est) p(est);
  p("II. Que el Partícipe desea participar en los resultados del Negocio mediante la aportación de capital, sin intervenir en su gestión.");
  p("III. Que, a tal fin, las partes acuerdan celebrar un contrato de cuentas en participación conforme a los artículos 239 a 243 del Código de Comercio, que se regirá por las siguientes");
  h("CLÁUSULAS");
  p("Por el presente contrato el Partícipe aporta capital al Negocio del Gestor y adquiere el derecho a participar en sus resultados prósperos o adversos en la proporción pactada. " + perimetroNegocio(neg), "Primera. Objeto.");
  p("El Partícipe aporta la cantidad de " + fmtEur(d.importe) + ", que ingresará mediante transferencia a la cuenta del Gestor " + or(d.iban, "IBAN del Gestor") + " no más tarde del " + fmtFecha(d.f_aport, "fecha de desembolso") + ". El justificante bancario servirá de carta de pago. Desde su entrega, la aportación pasa a ser propiedad del Gestor, que la destinará exclusivamente al Negocio.", "Segunda. Aportación.");
  p("El Gestor dirigirá y administrará el Negocio en su propio nombre y bajo su exclusiva responsabilidad, con plena autonomía. El Partícipe no intervendrá en la gestión. Entre las partes no existe sociedad ni razón comercial común (art. 241 del Código de Comercio).", "Tercera. Gestión.");
  p("Los terceros que contraten con el Gestor solo tendrán acción contra este, y no contra el Partícipe (art. 242 del Código de Comercio).", "Cuarta. Responsabilidad frente a terceros.");
  p("El Partícipe tendrá derecho al " + or(d.pct, "porcentaje") + " % de los beneficios netos del Negocio. " + perd, "Quinta. Participación en resultados.");
  p("El Gestor informará al Partícipe con periodicidad " + or(d.info) + " sobre la marcha del Negocio y pondrá a su disposición la documentación que lo justifique. Al terminar el Negocio, rendirá una cuenta final justificada de su resultado (art. 243 del Código de Comercio).", "Sexta. Información y rendición de cuentas.");
  p(dur + " Cualquiera de las partes podrá resolverlo si la otra incumple gravemente sus obligaciones y no lo subsana en los treinta días siguientes a ser requerida por escrito.", "Séptima. Duración.");
  p("Terminado el contrato, el Gestor practicará la liquidación y, en el plazo de " + or(d.dias, "número de") + " días desde la rendición de la cuenta final, abonará al Partícipe su aportación incrementada con la parte de beneficios o, en su caso, minorada con la parte de pérdidas que le corresponda.", "Octava. Liquidación.");
  p("Cada parte cumplirá las obligaciones fiscales que le correspondan. El Gestor practicará las retenciones o ingresos a cuenta que procedan sobre las cantidades que abone al Partícipe.", "Novena. Fiscalidad.");
  p("El Partícipe declara que los fondos aportados tienen origen lícito y se compromete a facilitar al Gestor la documentación que este le solicite para cumplir la normativa de prevención del blanqueo de capitales.", "Décima. Prevención del blanqueo de capitales.");
  p("Ninguna de las partes podrá ceder su posición en este contrato sin el consentimiento previo y por escrito de la otra.", "Undécima. Cesión.");
  p("Las partes guardarán confidencialidad sobre el contenido de este contrato y sobre la información del Negocio, salvo obligación legal o requerimiento de autoridad.", "Duodécima. Confidencialidad.");
  p("Este contrato se rige por la ley española. Para cualquier controversia, las partes se someten a los juzgados y tribunales de " + or(d.trib, "ciudad") + ".", "Decimotercera. Ley aplicable y jurisdicción.");
  p("Y en prueba de conformidad, las partes firman el presente contrato por duplicado y a un solo efecto en el lugar y fecha indicados en el encabezamiento.");
  B.push({ t: "sig", a: "El Gestor\n" + or(d.g_nombre, "GESTOR") + (d.g_rep ? "\np.p. " + d.g_rep : ""), b: "El Partícipe\n" + or(d.p_nombre, "PARTÍCIPE") + (d.p_rep ? "\np.p. " + d.p_rep : "") });
  const anexo = anexoNegocio(neg);
  if (anexo) { h(anexo.titulo); anexo.filas.forEach(([k, v]) => p(v, k + ":")); }
  return B;
}

const CLAVE_CAMBIOS = "md-cep-clausulas";

export default function ContratoCEP({ config, irAAjustes }) {
  const [d, setD] = useState(EJEMPLO);
  const [doc, setDoc] = useState(null); // { blob, nombre } cuando se crea
  const [aviso, nodoAviso] = useAviso();
  const [correo, setCorreo] = useState(false);
  const [cambios, setCambios] = useState(() => leerCambios(CLAVE_CAMBIOS));
  const base = useMemo(() => construir(d), [d]);
  const bloques = useMemo(() => aplicarCambios(base, cambios), [base, cambios]);

  const campo = (k) => ({ value: d[k], onChange: (e) => setD({ ...d, [k]: e.target.value }) });

  async function crear() {
    const nombre = "Contrato cuentas en participacion - " + ((d.p_nombre || "participe").trim()) + ".docx";
    try {
      const blob = await bloquesADocx(bloques);
      if (await raizGuardada()) {
        const r = await guardarEnCarpeta(blob, nombre, DESTINO.cuentas_participacion);
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
    const v = {};
    Object.keys(EJEMPLO).forEach((k) => (v[k] = ""));
    v.neg = { ...NEGOCIO_VACIO };
    setD({ ...v, ciudad: d.ciudad, trib: d.trib, perdidas: "limite", info: "trimestral", dur: "negocio", fecha: new Date().toISOString().slice(0, 10) });
  }

  const prompt = (ctx) => [
    "Actúa como especialista en derecho mercantil español. Revisa este borrador de contrato de cuentas en participación (arts. 239 a 243 del Código de Comercio).",
    "Señala, en español y sin tecnicismos innecesarios, un máximo de 8 puntos ordenados de más a menos importante. Para cada uno: el riesgo o hueco en una frase y una propuesta concreta de redacción o de cambio.",
    "Fíjate en: coherencia de datos e importes, reparto de pérdidas y riesgo de que se califique como préstamo, retribución y gastos del gestor, derecho de información, qué pasa si el negocio no termina o se retrasa, fiscalidad y retenciones, prevención del blanqueo, y datos marcados [●] pendientes.",
    "No inventes artículos, sentencias ni cifras. Si citas una norma y no estás seguro, dilo. Termina con una línea recordando que es una revisión orientativa.",
    "Formato: texto plano con números (1., 2., …), sin tablas.",
    ctx ? "\nCONTEXTO DEL CASO:\n" + ctx : "",
    "\nBORRADOR:\n" + bloquesATexto(bloques),
  ].join("\n");

  return (
    <div className="app">
      <header className="app-cab">
        <div>
          <div className="eyebrow">Contratos · Crear</div>
          <h1>Contrato de cuentas en participación</h1>
          <p className="muted">Rellena los datos y el borrador se escribe solo (arts. 239 a 243 del Código de Comercio). Los huecos entre corchetes se rellenan con tus datos.</p>
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
            <div className="fila">
              <label>Ciudad<input {...campo("ciudad")} /></label>
              <label>Fecha<input type="date" {...campo("fecha")} /></label>
            </div>
          </fieldset>
          {[["g", "Gestor"], ["p", "Partícipe"]].map(([k, t]) => (
            <fieldset key={k}><legend>{t}</legend>
              <label>Nombre o razón social<input {...campo(k + "_nombre")} /></label>
              <div className="fila">
                <label>NIF<input {...campo(k + "_nif")} /></label>
                <label>Domicilio<input {...campo(k + "_dom")} /></label>
              </div>
              <div className="fila">
                <label>Representante (si es sociedad)<input {...campo(k + "_rep")} /></label>
                <label>Cargo o poder<input {...campo(k + "_cargo")} /></label>
              </div>
            </fieldset>
          ))}
          <NegocioCampos valor={d.neg || NEGOCIO_VACIO} onChange={(neg) => setD({ ...d, neg })} />
          <fieldset><legend>Aportación</legend>
            <div className="fila">
              <label>Aportación (€)<input type="number" min="0" step="0.01" {...campo("importe")} /></label>
              <label>Fecha de desembolso<input type="date" {...campo("f_aport")} /></label>
            </div>
            <label>Cuenta del gestor (IBAN)<input {...campo("iban")} /></label>
          </fieldset>
          <fieldset><legend>Resultados</legend>
            <div className="fila">
              <label>% de beneficios del partícipe<input type="number" min="0" max="100" step="0.01" {...campo("pct")} /></label>
              <label>Pérdidas<select {...campo("perdidas")}>
                <option value="limite">Hasta el límite de su aportación</option>
                <option value="no">No participa en pérdidas</option>
              </select></label>
            </div>
            {d.perdidas === "no" && <p className="nota">Si el partícipe no asume pérdidas, el contrato se parece a un préstamo y puede discutirse su calificación como cuentas en participación. Revísalo con cuidado.</p>}
            <div className="fila">
              <label>Información al partícipe<select {...campo("info")}>
                <option>trimestral</option><option>semestral</option><option>anual</option>
              </select></label>
              <label>Plazo de liquidación (días)<input type="number" min="1" {...campo("dias")} /></label>
            </div>
          </fieldset>
          <fieldset><legend>Duración y jurisdicción</legend>
            <label>Duración<select {...campo("dur")}>
              <option value="negocio">Hasta que termine el negocio</option>
              <option value="fecha">Hasta una fecha concreta</option>
            </select></label>
            {d.dur === "fecha" && <label>Fecha de terminación<input type="date" {...campo("f_fin")} /></label>}
            <label>Tribunales de<input {...campo("trib")} /></label>
          </fieldset>
        </form>

        <VistaDocumento bloques={bloques} />
      </div>

      <EditorClausulas base={base} cambios={cambios} setCambios={setCambios} aviso={aviso} clave={CLAVE_CAMBIOS} ejemploTitulo="Decimocuarta. Título de la cláusula." />

      <div className="sin-ia">
        <strong>Este contrato no lo escribe la IA.</strong> El texto es una plantilla jurídica fija que se completa con tus datos y con las cláusulas que tú modifiques. La IA solo lo revisa si tú se lo pides aquí abajo, y no cambia nada por su cuenta.
      </div>

      <RevisionIA construirPrompt={prompt} irAAjustes={irAAjustes} />
      <p className="muted pie">Borrador orientativo. Revísalo y adáptalo a cada operación antes de firmar.</p>

      <GuardarEnNube abierto={!!doc} blob={doc?.blob} nombre={doc?.nombre || ""} config={config} onCerrar={() => setDoc(null)} irAAjustes={irAAjustes} />
      {correo && <DialogoCorreo opciones={["contrato_firma", "contrato_firmado"]}
        vars={{ documento: "contrato de cuentas en participación", empresa: d.g_nombre, destinatario: (d.p_rep || d.p_nombre || "").split(" ")[0], remitente: config?.nombre || "" }}
        adjuntos={[{ nombre: "Contrato cuentas en participacion - " + ((d.p_nombre || "participe").trim()) + ".docx", blob: () => bloquesADocx(bloques) }]}
        onCerrar={() => setCorreo(false)} />}
      {nodoAviso}
    </div>
  );
}
