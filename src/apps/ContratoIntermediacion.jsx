// Contrato de intermediación inmobiliaria puntual y reconocimiento de honorarios. Plantilla jurídica fija y anónima:
// formulario + borrador en vivo + Word + cláusulas editables, igual que el resto de contratos.
import { useMemo, useState } from "react";
import { bloquesADocx, bloquesATexto } from "../docx.js";
import { GuardarEnNube, RevisionIA, useAviso } from "../comunes.jsx";
import { DialogoCorreo } from "../lib/CorreoUI.jsx";
import { EditorClausulas, VistaDocumento, aplicarCambios, leerCambios, AvisoSinIA } from "../lib/contratoUI.jsx";
import { guardar as guardarEnCarpeta, raizGuardada, DESTINO } from "../lib/carpetas.js";
import { cifraYLetras } from "../lib/numeroLetras.js";
import { parte, firma, ParteForm, parteVacia, fmtFecha, or, num, eurosTxt, hoy, ACTIVO_VACIO, bloquesActivos, ActivosForm } from "../lib/contratoInmo.jsx";

const VACIO = {
  ciudad: "", fecha: hoy(),
  rol: "Comprador", ...parteVacia("a"), ...parteVacia("m"),
  contraparte: "", activos: [{ ...ACTIVO_VACIO }], operacion: "compraventa",
  hon_tipo: "fijo", hon_fijo: "", hon_pct: "",
  devengo: "partido", pct_arras: "20", reembolso: "si",
  validez: "12", excl: "no", trib: "",
};

export function construir(d) {
  const B = [];
  const h = (t) => B.push({ t: "h", text: t });
  const p = (t, lead) => B.push({ t: "p", text: t, lead });
  const C = d.rol === "Vendedor" ? "Vendedor" : "Comprador";            // cliente que paga los honorarios
  const O = C === "Comprador" ? "Vendedor" : "Comprador";               // la otra parte de la operación
  const CC = C.toUpperCase(), OO = O.toUpperCase();
  const activos = d.activos && d.activos.length ? d.activos : [ACTIVO_VACIO];
  const varios = activos.length > 1;
  const op = { compraventa: C === "Comprador" ? "la adquisición" : "la venta", inversion: "la entrada de un inversor en", sociedad: C === "Comprador" ? "la adquisición de las participaciones de la sociedad titular de" : "la venta de las participaciones de la sociedad titular de" }[d.operacion] || "la adquisición";
  const pa = parseFloat(d.pct_arras);
  const resto = isNaN(pa) ? "[porcentaje]" : cifraYLetras(100 - pa).replace(/ \(/, " por ciento (") .replace(/\)$/, " %)");
  const enArras = isNaN(pa) ? "[porcentaje]" : cifraYLetras(pa).replace(/ \(/, " por ciento (").replace(/\)$/, " %)");
  const valN = parseInt(d.validez, 10);
  const contraparte = (d.contraparte || "").trim();

  B.push({ t: "title", text: "CONTRATO DE INTERMEDIACIÓN INMOBILIARIA Y RECONOCIMIENTO DE HONORARIOS" });
  p("En " + or(d.ciudad, "ciudad") + ", a " + fmtFecha(d.fecha) + ".");
  h("REUNIDOS");
  p("De una parte, " + parte(d, "a", CC));
  p("De otra parte, " + parte(d, "m", "INTERMEDIARIO"));
  p("Ambas Partes se reconocen mutuamente la capacidad legal necesaria para obligarse y, a tal efecto,");
  h("EXPONEN");
  p("I. Que EL " + CC + " está interesado en " + op + " " + (varios ? "de los activos inmobiliarios" : "del activo inmobiliario") + " que se describe" + (varios ? "n" : "") + " en el Anexo (en adelante, la «Operación»).");
  p("II. Que EL INTERMEDIARIO ha intervenido de forma puntual y ocasional, sin relación estable ni continuada entre las Partes, limitándose a poner en contacto a EL " + CC + " con " + (contraparte ? contraparte + " (en adelante, el «" + O + "»)" : "el " + (C === "Comprador" ? "titular" : "adquirente") + " de dichos activos (en adelante, el «" + O + "»)") + " y a crear el marco negocial necesario para la conclusión de la Operación.");
  p("III. Que las Partes reconocen que la presente relación tiene la naturaleza de un contrato de mediación inmobiliaria puntual y finalista, y no de un contrato de agencia, por lo que queda expresamente excluida la aplicación de la Ley 12/1992, de 27 de mayo, sobre Contrato de Agencia.");
  p("IV. Que EL " + CC + " reconoce que la intervención de EL INTERMEDIARIO ha sido causa directa, eficiente y determinante para la conclusión del acuerdo relativo a la Operación.");
  p("V. Que las Partes desean formalizar por escrito el reconocimiento, devengo y pago de los honorarios de EL INTERMEDIARIO, con arreglo a las siguientes");
  h("CLÁUSULAS");
  p("El presente contrato tiene por objeto documentar la labor de mediación inmobiliaria desarrollada por EL INTERMEDIARIO y el reconocimiento por EL " + CC + " de la obligación de pagar los honorarios pactados. La intervención de EL INTERMEDIARIO se ha limitado a poner en relación a EL " + CC + " y al " + O + ", sin asumir funciones de representación, mandato ni promoción continuada, ni obligación de resultado distinta de la propia mediación. El presente contrato tendrá una validez de " + (isNaN(valN) ? "[duración]" : cifraYLetras(valN) + (valN === 1 ? " mes" : " meses")) + " desde su firma.", "Primera. Objeto, duración y naturaleza de la mediación.");
  p(d.hon_tipo === "pct"
    ? "EL " + CC + " abonará a EL INTERMEDIARIO, como única remuneración por su intervención, el " + num(d.hon_pct, "porcentaje") + " % del precio final de la Operación, más el Impuesto sobre el Valor Añadido u otros tributos indirectos que resulten aplicables."
    : "EL " + CC + " abonará a EL INTERMEDIARIO, como remuneración fija, única y cerrada por su intervención, la cantidad de " + eurosTxt(d.hon_fijo) + ". Este importe es alzado, no porcentual, y se ha pactado libremente con independencia del precio final de la Operación. Al importe anterior se añadirá el Impuesto sobre el Valor Añadido u otros tributos indirectos que resulten aplicables.", "Segunda. Honorarios.");
  const firmaArras = "la firma del contrato de arras, promesa de compraventa o acuerdo vinculante equivalente entre EL " + CC + " y el " + O;
  p(d.devengo === "arras"
    ? "Los honorarios se devengarán y serán exigibles en su totalidad con " + firmaArras + ", y no serán reembolsables aunque la Operación no llegue a formalizarse en escritura pública por causa imputable a EL " + CC + "."
    : d.devengo === "escritura"
      ? "Los honorarios se devengarán y serán exigibles únicamente en el momento del otorgamiento de la escritura pública de la Operación. Si la Operación no llega a formalizarse en escritura pública, por cualquier causa, no se devengará cantidad alguna."
      : "Los honorarios se devengarán por partes: el " + enArras + " del importe total se devengará y será exigible con " + firmaArras + "; y el " + resto + " restante se devengará y será exigible únicamente en el momento del otorgamiento de la escritura pública de la Operación.\nSi la Operación no llega a formalizarse en escritura pública, por cualquier causa, no será exigible el importe pendiente." + (d.reembolso === "si" ? " Si no se formaliza por causa imputable a EL " + CC + ", tampoco procederá el reembolso de la parte ya devengada a la firma de las arras." : ""),
    "Tercera. Devengo y exigibilidad.");
  p("Las Partes reconocen que la intervención de EL INTERMEDIARIO ha sido causa directa y eficiente de la puesta en contacto entre EL " + CC + " y el " + O + " y de la creación del marco negocial que ha permitido el acuerdo entre ambos y, en su caso, la posterior formalización de la Operación. En consecuencia, EL " + CC + " reconoce que la Operación tiene su origen en la mediación de EL INTERMEDIARIO, sin perjuicio de las negociaciones y acuerdos posteriores entre las partes de la Operación.", "Cuarta. Negocio de resultado y causalidad.");
  p(d.excl === "si"
    ? "El presente encargo se confiere con carácter de exclusividad: durante su vigencia, EL " + CC + " no encargará a otro intermediario la misma Operación."
    : "El presente encargo no se confiere con carácter de exclusividad. No obstante, si la Operación se formaliza con el " + O + " presentado por EL INTERMEDIARIO, subsistirá íntegramente la obligación de pagar los honorarios pactados, aunque hayan intervenido terceros con posterioridad.", "Quinta. Exclusividad.");
  p("EL INTERMEDIARIO no asume responsabilidad alguna por la viabilidad jurídica, económica, financiera o técnica de la Operación ni por el resultado final de la negociación, y su actuación se limita a la mediación descrita en el presente contrato.", "Sexta. Alcance de la intervención.");
  p("Las Partes cumplirán la normativa de prevención del blanqueo de capitales y de la financiación del terrorismo, y se facilitarán la documentación que razonablemente se soliciten para identificar a los intervinientes en la Operación y a sus titulares reales.", "Séptima. Prevención del blanqueo de capitales.");
  p("El presente contrato constituye un reconocimiento de la obligación de pago de los honorarios de la cláusula segunda, cuya exigibilidad queda condicionada exclusivamente a que se produzcan los supuestos de devengo de la cláusula tercera. Ninguna cantidad será exigible mientras no se haya producido el hecho de devengo correspondiente. En caso de impago de cantidades ya devengadas, EL INTERMEDIARIO podrá ejercitar las acciones legales que le correspondan para reclamarlas.", "Octava. Reconocimiento de deuda.");
  p("El presente contrato se rige por el Derecho español. Las Partes se someten a los Juzgados y Tribunales de " + or(d.trib, "ciudad") + ", con renuncia a cualquier otro fuero que pudiera corresponderles.", "Novena. Ley aplicable y jurisdicción.");
  p("Y en prueba de conformidad, las Partes firman el presente contrato por duplicado y a un solo efecto, en el lugar y fecha indicados en el encabezamiento.");
  B.push({ t: "sig", a: firma(d, "a", "EL " + CC), b: firma(d, "m", "EL INTERMEDIARIO") });
  h("ANEXO · ACTIVOS DE LA OPERACIÓN");
  bloquesActivos(B, activos, { sinCargasPorDefecto: false });
  return B;
}

const CLAVE_CAMBIOS = "md-intermediacion-clausulas";
const nombreArchivo = (d) => ("Contrato de intermediación - " + ((d.a_nombre || "cliente").trim()) + " - " + ((d.m_nombre || "intermediario").trim())).replace(/[\\/:*?"<>|]/g, "") + ".docx";

export default function ContratoIntermediacion({ config, irAAjustes }) {
  const [d, setD] = useState(VACIO);
  const [doc, setDoc] = useState(null);
  const [aviso, nodoAviso] = useAviso();
  const [correo, setCorreo] = useState(false);
  const [cambios, setCambios] = useState(() => leerCambios(CLAVE_CAMBIOS));
  const base = useMemo(() => construir(d), [d]);
  const bloques = useMemo(() => aplicarCambios(base, cambios), [base, cambios]);
  const campo = (k) => ({ value: d[k], onChange: (e) => setD({ ...d, [k]: e.target.value }) });
  // Tu empresa puede ser el cliente o el intermediario: botón para rellenar una u otra con tus datos
  const misDatos = (pre) => setD({ ...d, [pre + "_nombre"]: config?.empresa?.razon_social || d[pre + "_nombre"], [pre + "_nif"]: config?.empresa?.cif || d[pre + "_nif"], [pre + "_dom"]: config?.empresa?.domicilio || d[pre + "_dom"] });

  async function crear() {
    const nombre = nombreArchivo(d);
    try {
      const blob = await bloquesADocx(bloques);
      if (await raizGuardada()) {
        const r = await guardarEnCarpeta(blob, nombre, DESTINO.intermediacion);
        if (r.modo === "carpeta") { aviso("Guardado en " + r.ruta); return; }
      }
      setDoc({ blob, nombre });
    } catch { aviso("No se pudo crear el Word. Prueba con «Copiar texto»."); }
  }
  function copiar() {
    try { navigator.clipboard.writeText(bloquesATexto(bloques)).then(() => aviso("Texto copiado"), () => aviso("No se pudo copiar")); } catch { aviso("No se pudo copiar"); }
  }

  const prompt = (ctx) => [
    "Actúa como especialista en derecho mercantil e inmobiliario español. Revisa este borrador de contrato de intermediación inmobiliaria puntual con reconocimiento de honorarios.",
    "Señala, en español y sin tecnicismos innecesarios, un máximo de 8 puntos ordenados de más a menos importante. Para cada uno: el riesgo o hueco en una frase y una propuesta concreta de redacción.",
    "Fíjate en: prueba de la causalidad de la mediación, devengo de honorarios y qué pasa si la operación no llega a escritura, exclusión de la Ley de Agencia, reconocimiento de deuda y su eficacia, prevención del blanqueo (la intermediación inmobiliaria es sujeto obligado), coherencia de importes y huecos marcados [●].",
    "No inventes artículos, sentencias ni cifras. Si citas una norma y no estás seguro, dilo. Termina con una línea recordando que es una revisión orientativa. Formato: texto plano numerado, sin tablas.",
    ctx ? "\nCONTEXTO DEL CASO:\n" + ctx : "",
    "\nBORRADOR:\n" + bloquesATexto(bloques),
  ].join("\n");

  return (
    <div className="app">
      <header className="app-cab">
        <div>
          <div className="eyebrow">Contratos · Crear</div>
          <h1>Contrato de intermediación</h1>
          <p className="muted">Reconocimiento de los honorarios de un intermediario que ha puesto en contacto a comprador y vendedor en una operación inmobiliaria puntual. Rellena los datos y el borrador se escribe solo.</p>
        </div>
        <div className="acciones">
          <button className="btn" type="button" onClick={crear}>Crear contrato</button>
          <button className="btn ghost" type="button" onClick={copiar}>Copiar texto</button>
          <button className="btn ghost" type="button" onClick={() => setCorreo(true)}>Enviar por correo</button>
          <button className="btn ghost" type="button" onClick={() => setD({ ...VACIO, ciudad: d.ciudad, trib: d.trib })}>Vaciar</button>
        </div>
      </header>

      <div className="dos-col">
        <form className="formulario" onSubmit={(e) => e.preventDefault()} autoComplete="off">
          <fieldset><legend>Lugar y fecha</legend>
            <div className="fila"><label>Ciudad<input {...campo("ciudad")} /></label><label>Fecha<input type="date" {...campo("fecha")} /></label></div>
            <label>Quién paga los honorarios<select {...campo("rol")}><option>Comprador</option><option>Vendedor</option></select></label>
          </fieldset>
          {ParteForm(d, campo, "a", (d.rol === "Vendedor" ? "Vendedor" : "Comprador") + " (cliente que paga)")}
          {config?.empresa?.razon_social && <button className="enlace" type="button" onClick={() => misDatos("a")}>Poner mis datos como {d.rol === "Vendedor" ? "vendedor" : "comprador"}</button>}
          {ParteForm(d, campo, "m", "Intermediario")}
          {config?.empresa?.razon_social && <button className="enlace" type="button" onClick={() => misDatos("m")}>Poner mis datos como intermediario</button>}
          <fieldset><legend>La operación</legend>
            <label>Tipo de operación<select {...campo("operacion")}>
              <option value="compraventa">Compraventa de los activos</option>
              <option value="sociedad">Compraventa de la sociedad que los tiene</option>
              <option value="inversion">Entrada de un inversor</option>
            </select></label>
            <label>Nombre del {d.rol === "Vendedor" ? "comprador" : "vendedor"} (opcional)<input {...campo("contraparte")} placeholder="Si lo dejas vacío, no se nombra" /></label>
          </fieldset>
          <ActivosForm activos={d.activos} setActivos={(activos) => setD({ ...d, activos })} />
          <fieldset><legend>Honorarios</legend>
            <label>Tipo<select {...campo("hon_tipo")}><option value="fijo">Importe fijo y cerrado</option><option value="pct">% sobre el precio</option></select></label>
            {d.hon_tipo === "fijo" ? <label>Importe (€, + IVA)<input type="number" min="0" step="0.01" {...campo("hon_fijo")} /></label> : <label>Porcentaje (+ IVA)<input type="number" min="0" max="100" step="0.1" {...campo("hon_pct")} /></label>}
            <label>Cuándo se cobran<select {...campo("devengo")}>
              <option value="partido">Una parte en las arras y el resto en la escritura</option>
              <option value="arras">Todo en las arras</option>
              <option value="escritura">Todo en la escritura</option>
            </select></label>
            {d.devengo === "partido" && <>
              <label>% que se cobra en las arras<input type="number" min="0" max="100" step="1" {...campo("pct_arras")} /></label>
              <label>Si no se firma la escritura por culpa del cliente<select {...campo("reembolso")}><option value="si">No devuelve lo cobrado en las arras</option><option value="no">No decir nada</option></select></label>
            </>}
          </fieldset>
          <fieldset><legend>Otras condiciones</legend>
            <div className="fila"><label>Validez del contrato (meses)<input type="number" min="1" {...campo("validez")} /></label><label>Exclusiva<select {...campo("excl")}><option value="no">Sin exclusiva</option><option value="si">En exclusiva</option></select></label></div>
            <label>Tribunales de<input {...campo("trib")} /></label>
          </fieldset>
        </form>
        <VistaDocumento bloques={bloques} />
      </div>

      <EditorClausulas base={base} cambios={cambios} setCambios={setCambios} aviso={aviso} clave={CLAVE_CAMBIOS} ejemploTitulo="Décima. Título de la cláusula." />
      <AvisoSinIA />
      <RevisionIA construirPrompt={prompt} irAAjustes={irAAjustes} />
      <p className="muted pie">Borrador orientativo. Revísalo y adáptalo a cada operación antes de firmar.</p>

      <GuardarEnNube abierto={!!doc} blob={doc?.blob} nombre={doc?.nombre || ""} config={config} onCerrar={() => setDoc(null)} irAAjustes={irAAjustes} />
      {correo && <DialogoCorreo opciones={["contrato_firma", "contrato_firmado"]}
        vars={{ documento: "contrato de intermediación", empresa: d.m_nombre, destinatario: (d.a_rep || d.a_nombre || "").split(" ")[0], remitente: config?.nombre || "" }}
        adjuntos={[{ nombre: nombreArchivo(d), blob: () => bloquesADocx(bloques) }]}
        onCerrar={() => setCorreo(false)} />}
      {nodoAviso}
    </div>
  );
}
