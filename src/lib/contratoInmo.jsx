// Piezas comunes de los contratos inmobiliarios (mandato de venta, gestión, intermediación):
// formato de fechas e importes, comparecencia de las partes y ficha de activos (texto y formulario).
import { eurosEnLetras } from "./numeroLetras.js";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const fmtFecha = (v, etq = "fecha") => { if (!v) return `[${etq}]`; const [y, m, d] = v.split("-").map(Number); return d + " de " + MESES[m - 1] + " de " + y; };
export const fmtEur = (v) => { const n = parseFloat(v); return isNaN(n) ? "[importe]" : n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " euros"; };
export const or = (v, etq = "●") => (String(v ?? "")).trim() || `[${etq}]`;
export const num = (v, etq) => (String(v ?? "").trim() === "" ? `[${etq}]` : String(v).trim().replace(".", ","));
export const eurosTxt = (v, etq = "importe") => { const n = parseFloat(v); return isNaN(n) ? `[${etq}]` : fmtEur(n) + " (" + eurosEnLetras(n).toUpperCase() + ")"; };
export const hoy = () => new Date().toISOString().slice(0, 10);

// ---------- Partes ----------
export const parteVacia = (pre) => ({ [pre + "_tipo"]: "juridica", [pre + "_nombre"]: "", [pre + "_nif"]: "", [pre + "_dom"]: "", [pre + "_rm"]: "", [pre + "_rep"]: "", [pre + "_rep_dni"]: "", [pre + "_cargo"]: "administrador único", [pre + "_const"]: "" });

// Comparecencia: «X, con NIF…, domicilio…, representada por… (en adelante, el «Rol»)»
export function parte(d, pre, rol) {
  const juridica = d[pre + "_tipo"] === "juridica";
  let s = or(d[pre + "_nombre"], rol.toUpperCase());
  if (juridica && d[pre + "_const"] === "si") s += ", sociedad en constitución, pendiente de inscripción en el Registro Mercantil";
  s += ", con " + (juridica ? "NIF " : "DNI/NIF ") + or(d[pre + "_nif"], "NIF") + " y domicilio" + (juridica ? " social" : "") + " en " + or(d[pre + "_dom"], "domicilio");
  if (juridica) {
    if ((d[pre + "_rm"] || "").trim() && d[pre + "_const"] !== "si") s += ", inscrita en el Registro Mercantil de " + d[pre + "_rm"].trim();
    s += ", representada en este acto por D./D.ª " + or(d[pre + "_rep"], "representante") + ", con DNI " + or(d[pre + "_rep_dni"], "DNI del representante") + ", en su condición de " + or(d[pre + "_cargo"], "cargo");
  } else s += ", que actúa en su propio nombre y derecho";
  return s + " (en adelante, el «" + rol + "»).";
}
export const firma = (d, pre, rol) => rol + "\n" + or(d[pre + "_nombre"], rol.toUpperCase()) + (d[pre + "_tipo"] === "juridica" && d[pre + "_rep"] ? "\np.p. " + d[pre + "_rep"] : "");

// Formulario de una parte. campo(k) devuelve {value, onChange}.
export function ParteForm(d, campo, pre, titulo, { enConstitucion } = {}) {
  const jur = d[pre + "_tipo"] === "juridica";
  return (
    <fieldset key={pre}><legend>{titulo}</legend>
      <label>Es<select {...campo(pre + "_tipo")}><option value="juridica">Una sociedad</option><option value="fisica">Una persona física</option></select></label>
      <label>{jur ? "Razón social" : "Nombre y apellidos"}<input {...campo(pre + "_nombre")} /></label>
      <div className="fila">
        <label>{jur ? "NIF" : "DNI / NIF"}<input {...campo(pre + "_nif")} /></label>
        <label>Domicilio<input {...campo(pre + "_dom")} /></label>
      </div>
      {jur && <>
        {enConstitucion && <label>¿Está en constitución?<select {...campo(pre + "_const")}><option value="">No, ya está inscrita</option><option value="si">Sí, pendiente de inscripción</option></select></label>}
        {d[pre + "_const"] !== "si" && <label>Registro Mercantil de<input {...campo(pre + "_rm")} /></label>}
        <div className="fila">
          <label>Representante<input {...campo(pre + "_rep")} /></label>
          <label>DNI del representante<input {...campo(pre + "_rep_dni")} /></label>
        </div>
        <label>Cargo<select {...campo(pre + "_cargo")}><option>administrador único</option><option>administrador solidario</option><option>administrador mancomunado</option><option>consejero delegado</option><option>apoderado</option></select></label>
      </>}
    </fieldset>
  );
}

// ---------- Activos ----------
// Tipos del mundo inmobiliario (con «Otro» se escribe a mano)
export const TIPOS_ACTIVO = [
  ["Suelo", ["Solar urbano", "Parcela urbanizable", "Suelo en desarrollo (sector o unidad de ejecución)", "Suelo rústico o finca"]],
  ["Promoción y obra", ["Promoción en proyecto (con o sin licencia)", "Promoción en curso", "Obra parada", "Promoción terminada (stock de unidades)"]],
  ["Residencial", ["Edificio residencial", "Vivienda", "Conjunto de viviendas", "Residencia de estudiantes o senior", "Coliving o build to rent"]],
  ["Terciario", ["Local comercial", "Oficina", "Edificio de oficinas", "Hotel o apartamentos turísticos", "Centro o parque comercial"]],
  ["Industrial y otros", ["Nave industrial", "Plataforma logística", "Garajes y trasteros", "Activo sanitario o educativo", "Activo agrícola o rural"]],
  ["Carteras", ["Cartera de activos inmobiliarios", "Cartera de créditos con garantía inmobiliaria"]],
];
export const ACTIVO_VACIO = { tipo: "Solar urbano", tipo_otro: "", nombre: "", dir: "", mun: "", cat: "", reg: "", sup: "", desc: "", estado: "", urb: "", arr: "", cargas: "", precio: "", extra: [] };
export const tipoDe = (a) => (a.tipo === "Otro" ? (a.tipo_otro || "").trim() || "[tipo de activo]" : a.tipo);

// Ficha de un activo para el contrato: filas [concepto, valor] solo con dato
export function fichaActivo(a, { conPrecio, sinCargasPorDefecto = true } = {}) {
  const t = (v) => (v || "").trim();
  return [
    ["Tipo de activo", tipoDe(a)],
    ["Denominación", t(a.nombre)],
    ["Ubicación", [a.dir, a.mun].map(t).filter(Boolean).join(", ") || "[ubicación]"],
    ["Referencia catastral", t(a.cat) || "Pendiente de facilitar"],
    ["Datos registrales", t(a.reg)],
    ["Superficie", t(a.sup)],
    ["Descripción", t(a.desc)],
    ["Estado actual", t(a.estado)],
    ["Situación urbanística y licencias", t(a.urb)],
    ["Arrendamientos u ocupación", t(a.arr)],
    ["Cargas", t(a.cargas) || (sinCargasPorDefecto ? "Libre de cargas, según manifestación de su titular" : "")],
    ...(a.extra || []).filter((x) => t(x.k) && t(x.v)).map((x) => [x.k.trim(), x.v.trim()]),
    ...(conPrecio ? [["Precio mínimo", eurosTxt(a.precio, "precio mínimo")]] : []),
  ].filter(([, v]) => v);
}

// Añade a los bloques las fichas de los activos (con subtítulo si hay más de uno)
export function bloquesActivos(B, activos, opciones) {
  const varios = activos.length > 1;
  activos.forEach((a, i) => {
    if (varios) B.push({ t: "sub", text: "Activo " + (i + 1) + (a.nombre && a.nombre.trim() ? " · " + a.nombre.trim() : "") });
    B.push({ t: "tabla", filas: fichaActivo(a, opciones) });
  });
}

// Formulario de la lista de activos. d.activos y setActivos(lista).
export function ActivosForm({ activos, setActivos, conPrecio, titulo = "El activo", textoAnadir = "+ Añadir otro activo" }) {
  const setA = (i, c) => setActivos(activos.map((a, j) => (j === i ? { ...a, ...c } : a)));
  const ca = (i, k) => ({ value: activos[i][k], onChange: (e) => setA(i, { [k]: e.target.value }) });
  const varios = activos.length > 1;
  return (
    <>
      {activos.map((a, i) => (
        <fieldset key={i}><legend>{varios ? "Activo " + (i + 1) : titulo}</legend>
          <label>Tipo<select {...ca(i, "tipo")}>
            {TIPOS_ACTIVO.map(([g, ts]) => <optgroup key={g} label={g}>{ts.map((t) => <option key={t}>{t}</option>)}</optgroup>)}
            <option>Otro</option>
          </select></label>
          {a.tipo === "Otro" && <label>¿Qué tipo de activo?<input {...ca(i, "tipo_otro")} /></label>}
          <label>Nombre o denominación (opcional)<input {...ca(i, "nombre")} placeholder="p. ej. Edificio A, Sector 4, Lote 2" /></label>
          <div className="fila"><label>Dirección<input {...ca(i, "dir")} /></label><label>Municipio y provincia<input {...ca(i, "mun")} /></label></div>
          <div className="fila"><label>Referencia catastral<input {...ca(i, "cat")} placeholder="Si no la tienes, se pone «pendiente»" /></label><label>Finca registral / Registro<input {...ca(i, "reg")} placeholder="Finca n.º, tomo, libro, folio, CRU…" /></label></div>
          <label>Superficie<input {...ca(i, "sup")} placeholder="Parcela, edificabilidad, m² construidos, n.º de unidades…" /></label>
          <label>Descripción<textarea rows={3} {...ca(i, "desc")} placeholder="Qué es y qué permite: viviendas, usos, plantas, garaje…" /></label>
          <label>Estado actual<input {...ca(i, "estado")} placeholder="p. ej. obra al 60 %, terminado, en rentabilidad, vacío…" /></label>
          <label>Situación urbanística y licencias<input {...ca(i, "urb")} placeholder="Clasificación, planeamiento, licencias concedidas o en trámite" /></label>
          <div className="fila"><label>Arrendamientos u ocupación<input {...ca(i, "arr")} placeholder="Inquilinos, rentas, libre…" /></label><label>Cargas<input {...ca(i, "cargas")} placeholder="Vacío = libre de cargas" /></label></div>
          {conPrecio && <label>Precio mínimo de este activo (€)<input type="number" min="0" step="1" {...ca(i, "precio")} /></label>}
          {a.extra.map((x, j) => (
            <div className="fila" key={j}>
              <label>Otro dato<input value={x.k} onChange={(e) => setA(i, { extra: a.extra.map((y, n) => (n === j ? { ...y, k: e.target.value } : y)) })} placeholder="p. ej. Rentabilidad" /></label>
              <label>Valor<span style={{ display: "flex", gap: 8 }}><input value={x.v} onChange={(e) => setA(i, { extra: a.extra.map((y, n) => (n === j ? { ...y, v: e.target.value } : y)) })} />
                <button className="enlace" type="button" onClick={() => setA(i, { extra: a.extra.filter((_, n) => n !== j) })}>Quitar</button></span></label>
            </div>
          ))}
          <div className="acciones">
            <button className="enlace" type="button" onClick={() => setA(i, { extra: [...a.extra, { k: "", v: "" }] })}>+ Añadir otro dato</button>
            {varios && <button className="enlace" type="button" onClick={() => setActivos(activos.filter((_, j) => j !== i))}>Quitar este activo</button>}
          </div>
        </fieldset>
      ))}
      <button className="btn ghost" type="button" onClick={() => setActivos([...activos, { ...ACTIVO_VACIO, extra: [] }])}>{textoAnadir}</button>
    </>
  );
}
