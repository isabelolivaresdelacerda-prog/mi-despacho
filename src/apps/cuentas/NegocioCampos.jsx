// Campos guiados para describir el negocio en el contrato de cuentas en participación.
// Usa las mismas etiquetas <fieldset>/<label>/.row que el resto del formulario del contrato.
import { TIPOS_NEGOCIO, avisosNegocio } from "./negocio.js";

export default function NegocioCampos({ valor: n, onChange }) {
  const set = (k, v) => onChange({ ...n, [k]: v });
  const campo = (k, etiqueta, props = {}) => (
    <label>{etiqueta}<input value={n[k]} onChange={e => set(k, e.target.value)} {...props} /></label>
  );
  const inmueble = n.tipo === "promocion" || n.tipo === "inmueble";
  const avisos = avisosNegocio(n);

  return (
    <fieldset>
      <legend>Negocio en el que se participa</legend>
      <label>Tipo de negocio
        <select value={n.tipo} onChange={e => set("tipo", e.target.value)}>
          {Object.entries(TIPOS_NEGOCIO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      {n.tipo !== "otro" && campo("denominacion", "Nombre del proyecto (opcional)", { placeholder: "Residencial Alameda" })}

      {inmueble && <>
        {campo("finca_dir", "Ubicación de la finca", { placeholder: "calle Ejemplo 10, 28001 Madrid" })}
        <div className="row">
          {campo("ref_catastral", "Referencia catastral")}
          {campo("registro", "Registro de la Propiedad", { placeholder: "n.º 5 de Madrid" })}
        </div>
        {campo("finca_registral", "Finca registral n.º")}
      </>}
      {n.tipo === "promocion" && <>
        {campo("actuacion", "Qué se va a construir", { placeholder: "la construcción de 24 viviendas con garajes y trasteros" })}
        {campo("licencia", "Situación urbanística o licencia (opcional)", { placeholder: "cuenta con licencia de obra concedida el 3 de marzo de 2026" })}
      </>}
      {n.tipo === "inmueble" && <div className="row">
        <label>Qué se hará con el inmueble
          <select value={n.estrategia} onChange={e => set("estrategia", e.target.value)}>
            <option value="reforma_venta">Comprar, reformar y vender</option>
            <option value="venta">Comprar y vender</option>
            <option value="arrendamiento">Comprar y alquilar</option>
          </select>
        </label>
        {campo("precio_adquisicion", "Precio de compra previsto (€)", { type: "number", min: 0, step: "0.01" })}
      </div>}

      {n.tipo === "espectaculo" && <>
        <div className="row">
          <label>Formato
            <select value={n.formato} onChange={e => set("formato", e.target.value)}>
              <option value="concierto">Concierto</option><option value="gira">Gira</option>
              <option value="festival">Festival</option><option value="musical">Musical</option>
            </select>
          </label>
          {campo("titulo", "Título")}
        </div>
        {campo("artistas", "Artistas o compañía (opcional)")}
        {campo("calendario", "Fechas y recintos", { placeholder: "en el WiZink Center de Madrid los días 12 y 13 de junio de 2027" })}
      </>}

      {n.tipo === "fabricacion" && <>
        {campo("producto", "Producto", { placeholder: "mobiliario de exterior en aluminio" })}
        <div className="row">
          {campo("instalaciones", "Dónde se fabrica (opcional)", { placeholder: "la nave del Gestor en Getafe" })}
          {campo("mercados", "A quién se vende (opcional)", { placeholder: "distribuidores en España y Portugal" })}
        </div>
      </>}

      <label>{n.tipo === "otro" ? "Describe el negocio" : "Detalle adicional (opcional)"}
        <textarea value={n.descripcion_libre} onChange={e => set("descripcion_libre", e.target.value)}
          placeholder={n.tipo === "otro" ? "Qué actividad es, dónde se desarrolla y cómo genera ingresos" : "Cualquier precisión que ayude a delimitar el negocio"} />
      </label>
      {campo("ingresos", "De dónde vienen los ingresos", { placeholder: inmueble ? "la venta de las viviendas" : n.tipo === "espectaculo" ? "la taquilla, los patrocinios y la venta de merchandising" : "la venta del producto" })}
      <div className="row">
        {campo("presupuesto", "Presupuesto estimado (€, opcional)", { type: "number", min: 0, step: "0.01" })}
        {campo("plazo_meses", "Plazo estimado (meses, opcional)", { type: "number", min: 1 })}
      </div>
      <label className="chk"><input type="checkbox" checked={n.anexo} onChange={e => set("anexo", e.target.checked)} /> Añadir una ficha del negocio como Anexo I</label>
      {avisos.length > 0 && <p className="note">{avisos.join(" ")}</p>}
    </fieldset>
  );
}
