// Guía práctica: cómo llevar la contabilidad de una asociación (entidad sin fines lucrativos).
import "../../documento.css";

const A = ({ filas }) => (
  <table className="asiento"><thead><tr><th>Cuenta</th><th className="num">Debe</th><th className="num">Haber</th></tr></thead>
    <tbody>{filas.map(([c, d, h], i) => <tr key={i}><td>{c}</td><td className="num">{d}</td><td className="num">{h}</td></tr>)}</tbody></table>
);

export default function GuiaAsociaciones() {
  return (
    <div className="app pagina-doc">
      <header className="app-cab no-imprimir">
        <div><div className="eyebrow">Guías</div><h1>Contabilidad de una asociación</h1>
          <p className="muted">Explicado para quien no sabe contabilidad. En Mi Despacho elige «Asociación» en Ajustes → Datos de la entidad: la contabilidad, los impuestos y el calendario se adaptan solos.</p></div>
        <div className="acciones"><button className="btn" type="button" onClick={() => window.print()}>Imprimir / PDF</button></div>
      </header>
      <article className="doc">
        <h1 className="solo-imprimir">Guía: contabilidad de una asociación</h1>

        <h2>1. Qué hay que llevar</h2>
        <ul>
          <li><strong>Contabilidad</strong> que refleje la imagen fiel del patrimonio, del resultado y de las actividades (Ley Orgánica 1/2002, art. 14).</li>
          <li><strong>Inventario</strong> de bienes, <strong>relación actualizada de asociados</strong> y <strong>libro de actas</strong> de la asamblea y la junta directiva.</li>
          <li><strong>Cuentas anuales</strong> (balance, cuenta de resultados y memoria) aprobadas cada año por la asamblea general.</li>
          <li>Si es de <strong>utilidad pública</strong>: rendir cuentas al Ministerio del Interior en los 6 meses siguientes al cierre, y memoria de actividades.</li>
        </ul>

        <h2>2. Qué plan contable se usa</h2>
        <p>Las asociaciones usan la adaptación del Plan General Contable a entidades sin fines lucrativos (Real Decreto 1491/2011) y, si son pequeñas, el plan de PYMES para entidades sin fines lucrativos (Resolución del ICAC de 26 de marzo de 2013). Es el mismo plan de las empresas con algunas cuentas propias.</p>
        <table>
          <thead><tr><th>Cuenta</th><th>Qué es</th><th>Ejemplo</th></tr></thead>
          <tbody>
            <tr><td>101</td><td>Fondo social</td><td>El patrimonio con el que se crea la asociación (en lugar de «capital»).</td></tr>
            <tr><td>720</td><td>Cuotas de asociados y afiliados</td><td>La cuota anual de cada socio.</td></tr>
            <tr><td>721</td><td>Cuotas de usuarios</td><td>Lo que paga alguien por participar en una actividad.</td></tr>
            <tr><td>722</td><td>Promociones para captación de recursos</td><td>Rifas, cenas benéficas, venta de lotería.</td></tr>
            <tr><td>723</td><td>Ingresos de patrocinadores y colaboraciones</td><td>Una empresa paga a cambio de que aparezca su logo.</td></tr>
            <tr><td>725</td><td>Subvenciones oficiales a la actividad propia</td><td>Subvención del ayuntamiento para un programa.</td></tr>
            <tr><td>726</td><td>Donaciones y otros ingresos para actividades</td><td>Donativo de una persona.</td></tr>
            <tr><td>130 / 131</td><td>Subvenciones y donaciones de capital</td><td>Dinero recibido para comprar algo duradero (una furgoneta, equipos).</td></tr>
            <tr><td>650 / 651</td><td>Ayudas monetarias / no monetarias</td><td>Becas o ayudas que la asociación da a beneficiarios.</td></tr>
            <tr><td>653</td><td>Compensación de gastos de colaboración</td><td>Gastos de voluntarios que se les reembolsan.</td></tr>
            <tr><td>654</td><td>Reembolsos de gastos al órgano de gobierno</td><td>Gastos de la junta directiva que se les devuelven.</td></tr>
            <tr><td>412 · 447 · 448</td><td>Beneficiarios acreedores · usuarios deudores · patrocinadores y afiliados deudores</td><td>Lo que se debe a un beneficiario o lo que deben socios y patrocinadores.</td></tr>
          </tbody>
        </table>

        <h2>3. Los apuntes más habituales</h2>
        <p><strong>Un socio paga su cuota anual de 60 € por transferencia</strong></p>
        <A filas={[["572 Bancos", "60,00", ""], ["720 Cuotas de asociados", "", "60,00"]]} />
        <p><strong>Se emiten las cuotas del año y aún no se han cobrado</strong> (si se lleva al día quién debe)</p>
        <A filas={[["448 Patrocinadores, afiliados y otros deudores", "60,00", ""], ["720 Cuotas de asociados", "", "60,00"]]} />
        <p><strong>Una persona hace un donativo de 200 € para las actividades</strong></p>
        <A filas={[["572 Bancos", "200,00", ""], ["726 Donaciones para actividades", "", "200,00"]]} />
        <p><strong>El ayuntamiento concede y paga una subvención de 3.000 € para un programa del año</strong></p>
        <A filas={[["572 Bancos", "3.000,00", ""], ["725 Subvenciones oficiales a la actividad propia", "", "3.000,00"]]} />
        <p className="muted pequeño">Si la subvención es para varios años o para comprar algo duradero, va a 130 y se pasa a resultados poco a poco. Guarda la justificación: puede pedirse durante 4 años.</p>
        <p><strong>Se compra un ordenador de 800 € (IVA incluido, la asociación no puede deducirlo)</strong></p>
        <A filas={[["217 Equipos para procesos de información", "800,00", ""], ["572 Bancos", "", "800,00"]]} />
        <p className="muted pequeño">Cada año se amortiza una parte (681 / 2817), por ejemplo en 4 años: 200 € al año.</p>
        <p><strong>Se reembolsan 45 € de gasolina a un voluntario</strong></p>
        <A filas={[["653 Compensación de gastos por prestaciones de colaboración", "45,00", ""], ["572 Bancos", "", "45,00"]]} />
        <p><strong>Una empresa patrocina un evento con 1.000 € + IVA a cambio de publicidad</strong> (se emite factura con IVA)</p>
        <A filas={[["430 Clientes (o 448)", "1.210,00", ""], ["723 Ingresos de patrocinadores", "", "1.000,00"], ["477 IVA repercutido", "", "210,00"]]} />

        <h2>4. Impuestos</h2>
        <ul>
          <li><strong>Impuesto sobre Sociedades:</strong> las asociaciones están «parcialmente exentas»: no tributan por cuotas, donativos y subvenciones, pero sí por actividades económicas. Pueden no presentar el modelo 200 si sus ingresos totales no superan 75.000 € al año, los no exentos no superan 2.000 € y todos estos tienen retención. Si son de utilidad pública y aplican la Ley 49/2002, tienen su régimen especial y presentan el modelo 182 de donativos.</li>
          <li><strong>IVA:</strong> las cuotas de los socios están exentas en muchas asociaciones (art. 20.Uno.12.º de la Ley del IVA) y también ciertas actividades culturales, deportivas o sociales. El patrocinio con publicidad, en cambio, lleva IVA. Si la asociación no deduce IVA, el IVA de sus compras es más gasto.</li>
          <li><strong>Retenciones:</strong> si se paga a profesionales o se tiene personal, hay que retener y presentar el modelo 111.</li>
        </ul>

        <h2>5. Al final del año</h2>
        <ol>
          <li>Comprobar que el banco cuadra con la contabilidad (Contabilidad → Banco por aplicar a cero).</li>
          <li>Amortizar los bienes duraderos y pasar a resultados la parte que toque de las subvenciones de capital.</li>
          <li>Sacar el balance y la cuenta de resultados (Contabilidad → Pérdidas y ganancias / Balance). El resultado se llama <strong>excedente del ejercicio</strong>.</li>
          <li>Preparar la memoria (actividades realizadas, número de socios y beneficiarios, uso de las subvenciones).</li>
          <li>Convocar la asamblea para aprobar las cuentas y dejarlo en el libro de actas.</li>
        </ol>
        <p className="doc-pie">Guía orientativa. Comprueba los requisitos fiscales concretos de tu asociación con tu gestoría o asesor.</p>
      </article>
    </div>
  );
}
