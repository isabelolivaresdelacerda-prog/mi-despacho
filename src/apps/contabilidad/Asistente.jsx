// "¿Dónde va esto?": asistente con preguntas sencillas para elegir la cuenta, sin saber contabilidad.
import { useState } from "react";
import { tituloCuenta, grupoDe, a8 } from "./pgc.js";

// Árbol de preguntas. Cada opción lleva a otra pregunta (s) o a una cuenta (c) con una explicación (e).
const ARBOL = {
  inicio: { p: "¿El dinero entra o sale de la empresa?", o: [["Sale: pagamos algo", "sale"], ["Entra: cobramos o recibimos dinero", "entra"]] },
  sale: { p: "¿Qué estamos pagando?", o: [
    ["Un servicio o gasto del día a día", "gasto"],
    ["Algo que vamos a usar varios años (ordenador, muebles, coche, local…)", "inmov"],
    ["Algo que compramos para volver a venderlo (mercancía, un inmueble para vender)", { c: "600", e: "Compras: lo que se compra para vender. Al cierre se ajusta con las existencias (grupo 3)." }],
    ["Sueldos o Seguridad Social de trabajadores", "personal"],
    ["Devolver un préstamo o pagar intereses", "deuda"],
    ["Dinero a un socio o administrador", { c: "551", e: "Cuenta corriente con socios: lo que la empresa le da y luego tendrá que devolver o justificar." }],
    ["Pagar impuestos a Hacienda (IVA, retenciones, sociedades)", "hacienda"],
    ["Una señal o arras por algo que vamos a comprar", { c: "407", e: "Anticipo a proveedores: se paga antes de recibir el bien. Cuando se compra, se descuenta." }],
  ] },
  gasto: { p: "¿De qué tipo de gasto se trata?", o: [
    ["Abogado, notario, asesor, gestoría, arquitecto, registro", { c: "623", e: "Servicios de profesionales independientes. Ojo: suelen llevar retención (cuenta 4751)." }],
    ["Alquiler de un local, oficina o maquinaria", { c: "621", e: "Arrendamientos. Si el local es de un particular o empresa, hay que retener (modelo 115)." }],
    ["Reparación o mantenimiento", { c: "622", e: "Reparaciones y conservación." }],
    ["Transporte o mensajería", { c: "624", e: "Transportes." }],
    ["Seguro", { c: "625", e: "Primas de seguros." }],
    ["Comisión o gasto del banco", { c: "626", e: "Servicios bancarios y similares." }],
    ["Publicidad, marketing, web, eventos", { c: "627", e: "Publicidad, propaganda y relaciones públicas." }],
    ["Luz, agua, gas, teléfono, internet", { c: "628", e: "Suministros." }],
    ["IBI, tasas del ayuntamiento, otros tributos (no IVA)", { c: "631", e: "Otros tributos." }],
    ["Programas, suscripciones, material de oficina, viajes, otros", { c: "629", e: "Otros servicios." }],
  ] },
  inmov: { p: "¿Qué es?", o: [
    ["Un terreno o solar", { c: "210", e: "Terrenos y bienes naturales. No se amortiza." }],
    ["Un edificio o local para usarlo (no para vender)", { c: "211", e: "Construcciones. Se amortiza cada año." }],
    ["Maquinaria o herramientas", { c: "213", e: "Maquinaria." }],
    ["Muebles", { c: "216", e: "Mobiliario." }],
    ["Ordenadores, móviles, equipos informáticos", { c: "217", e: "Equipos para procesos de información." }],
    ["Un vehículo", { c: "218", e: "Elementos de transporte." }],
    ["Un programa informático que se compra (licencia, no suscripción)", { c: "206", e: "Aplicaciones informáticas." }],
  ] },
  personal: { p: "¿Qué parte?", o: [["El sueldo bruto", { c: "640", e: "Sueldos y salarios." }], ["La Seguridad Social que paga la empresa", { c: "642", e: "Seguridad Social a cargo de la empresa." }]] },
  deuda: { p: "¿Qué parte estamos pagando?", o: [
    ["La parte del préstamo (capital)", { c: "520", e: "Deudas a corto plazo con entidades de crédito (si vence a más de un año, 170)." }],
    ["Los intereses", { c: "662", e: "Intereses de deudas." }],
  ] },
  hacienda: { p: "¿Qué impuesto?", o: [
    ["El IVA del trimestre (modelo 303)", { c: "4750", e: "Hacienda Pública, acreedora por IVA." }],
    ["Las retenciones (modelos 111 o 115)", { c: "4751", e: "Hacienda Pública, acreedora por retenciones practicadas." }],
    ["El Impuesto sobre Sociedades (200 o 202)", { c: "4752", e: "Hacienda Pública, acreedora por impuesto sobre sociedades." }],
  ] },
  entra: { p: "¿Por qué entra ese dinero?", o: [
    ["Vendemos un producto o un inmueble", { c: "700", e: "Ventas de mercaderías." }],
    ["Cobramos un servicio que hemos hecho", { c: "705", e: "Prestaciones de servicios." }],
    ["Cobramos un alquiler", { c: "752", e: "Ingresos por arrendamientos." }],
    ["Un socio pone dinero (capital, ampliación o aportación)", "socio"],
    ["Un banco o alguien nos presta dinero", { c: "520", e: "Deudas a corto plazo con entidades de crédito (a más de un año, 170)." }],
    ["Una subvención", { c: "740", e: "Subvenciones a la explotación." }],
    ["Intereses del banco", { c: "769", e: "Otros ingresos financieros." }],
    ["Una señal o arras de alguien que nos va a comprar", { c: "438", e: "Anticipos de clientes." }],
    ["Una cuota de asociado o un donativo (asociaciones)", "asoc"],
  ] },
  socio: { p: "¿Cómo pone el dinero el socio?", o: [
    ["Con escritura ante notario (constitución o ampliación de capital)", { c: "100", e: "Capital social. Necesita escritura e inscripción en el Registro Mercantil." }],
    ["Sin escritura, para cubrir gastos o pérdidas, sin devolución", { c: "118", e: "Aportaciones de socios o propietarios: no es capital ni préstamo." }],
    ["Como préstamo que habrá que devolverle", { c: "551", e: "Cuenta corriente con socios (o 163/171 si es a largo plazo)." }],
  ] },
  asoc: { p: "¿Qué es exactamente?", o: [
    ["Cuota de un socio de la asociación", { c: "720", e: "Cuotas de asociados y afiliados." }],
    ["Pago de un usuario por una actividad", { c: "721", e: "Cuotas de usuarios." }],
    ["Donativo de una persona o empresa", { c: "726", e: "Donaciones para actividades (si es para comprar algo duradero, 131)." }],
    ["Patrocinio a cambio de publicidad", { c: "723", e: "Ingresos de patrocinadores y colaboraciones." }],
    ["Subvención pública para la actividad", { c: "725", e: "Subvenciones oficiales a la actividad propia." }],
  ] },
};

// En asociaciones y fundaciones se pregunta primero por lo propio de una entidad sin fines lucrativos
const ESFL = {
  entra: { p: "¿Por qué entra ese dinero?", o: [
    ["Cuota de un asociado", { c: "720", e: "Cuotas de asociados y afiliados." }],
    ["Donativo de una persona o empresa", { c: "726", e: "Donaciones para actividades. Si es para comprar algo duradero, 131. Con la Ley 49/2002, va al modelo 182." }],
    ["Subvención pública para la actividad del año", { c: "725", e: "Subvenciones oficiales a la actividad propia. Si es para comprar algo duradero o para varios años, 130." }],
    ["Patrocinio a cambio de publicidad (lleva factura con IVA)", { c: "723", e: "Ingresos de patrocinadores y colaboraciones." }],
    ["Pago de un usuario por participar en una actividad", { c: "721", e: "Cuotas de usuarios." }],
    ["Rifa, lotería, cena benéfica, mercadillo", { c: "722", e: "Promociones para captación de recursos." }],
    ["Venta de un producto o servicio con precio (actividad económica)", { c: "705", e: "Prestaciones de servicios / ventas: pueden llevar IVA y tributar en Sociedades." }],
    ["Aportación al fondo social", { c: "101", e: "Fondo social: patrimonio de la asociación." }],
    ["Un préstamo o un banco nos presta dinero", { c: "520", e: "Deudas a corto plazo con entidades de crédito (a más de un año, 170)." }],
    ["Intereses del banco", { c: "769", e: "Otros ingresos financieros." }],
  ] },
  saleExtra: [
    ["Una ayuda o beca a un beneficiario", { c: "650", e: "Ayudas monetarias de la actividad propia." }],
    ["Gastos de un voluntario que se le reembolsan", { c: "653", e: "Compensación de gastos por prestaciones de colaboración." }],
    ["Gastos de la junta directiva que se le devuelven", { c: "654", e: "Reembolsos de gastos al órgano de gobierno." }],
  ],
};

export default function Asistente({ plan = "pymes", onElegir, onCerrar, contexto }) {
  const [camino, setCamino] = useState(["inicio"]);
  const [fin, setFin] = useState(null);
  const clave = camino[camino.length - 1];
  const nodo = plan === "esfl" && clave === "entra" ? ESFL.entra : plan === "esfl" && clave === "sale" ? { ...ARBOL.sale, o: [...ESFL.saleExtra, ...ARBOL.sale.o.filter(([t]) => !/socio o administrador/.test(t))] } : ARBOL[clave];
  const elegir = (dest) => (typeof dest === "string" ? setCamino([...camino, dest]) : setFin(dest));
  const atras = () => (fin ? setFin(null) : camino.length > 1 && setCamino(camino.slice(0, -1)));

  return (
    <div className="mc-fondo" role="dialog" aria-modal="true" aria-labelledby="as-t">
      <div className="mc-dialogo">
        <header><h2 id="as-t">¿Dónde va esto?</h2><button className="mc-x" onClick={onCerrar} aria-label="Cerrar">×</button></header>
        <div className="mc-cuerpo">
          {contexto && <p className="mc-nota">{contexto}</p>}
          {!fin ? (
            <>
              <p className="as-pregunta">{nodo.p}</p>
              <div className="as-opciones">{nodo.o.map(([t, d]) => <button key={t} type="button" onClick={() => elegir(d)}>{t}</button>)}</div>
            </>
          ) : (
            <div className="as-resultado">
              <p className="mc-nota">Grupo {String(fin.c)[0]} · {grupoDe(fin.c, plan)}</p>
              <p className="as-cuenta"><strong>{a8(fin.c)}</strong> · {tituloCuenta(fin.c, plan) || fin.e}</p>
              <p>{fin.e}</p>
              <p className="mc-nota">Si no estás segura, guárdalo así y pregúntaselo a tu gestoría: puedes cambiarlo después.</p>
            </div>
          )}
        </div>
        <footer>
          {(camino.length > 1 || fin) && <button className="mc-btn sec" onClick={atras}>‹ Atrás</button>}
          <button className="mc-btn sec" onClick={onCerrar}>Cancelar</button>
          {fin && <button className="mc-btn" onClick={() => onElegir(fin.c, fin.e)}>Usar esta cuenta</button>}
        </footer>
      </div>
    </div>
  );
}
