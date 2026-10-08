# Mi Despacho — Contabilidad (estado a 8 de octubre de 2026)

Código en GitHub `isabelolivaresdelacerda-prog/mi-despacho` (rama main). Vercel publica solo cada cambio en https://mi-despacho-nine.vercel.app y la app se actualiza sola en el navegador cuando hay versión nueva.

## Cómo funciona
- La app vive en Mi Despacho; los documentos siguen en la carpeta de la empresa (OneDrive/Drive sincronizado) y se leen desde Chrome o Edge. La contabilidad está en `004 ADMINISTRACIÓN › contabilidad - …`.
- **Periodo:** año + 1T/2T/3T/4T/Año. Por defecto el trimestre actual; histórico por años y trimestres.
- **Resumen:** cifras del trimestre con el año al lado (facturas recibidas, pendientes de pago, gasto, retenciones, resultado, IVA, emitidas, por gestionar). Cada cifra y cada celda de la tabla por trimestres se pulsa y enseña de dónde sale, con el documento y lo pendiente.
- **Por gestionar:** pagos sin factura, cobros sin factura emitida, cargos sin justificante del banco, facturas sin pago/cobro (por saldo), sin leer, sin fecha, IA sin revisar, terceros pagados de más (falta factura o provisión sin gastar), cuotas de contratos no encontradas, apuntes fuera del extracto, descuadres, escrituras/contratos vinculados por la IA sin revisar.

## Reglas contables decididas
- **Subcuenta por tercero** (410xxxxx proveedores/profesionales, 430xxxxx clientes), reconocido por NIF o nombre normalizado (sin tildes, formas jurídicas ni «.com»): Wix en una sola subcuenta.
- **Pagos por entidad:** un movimiento de una entidad con facturas (Solve, Wix…) va a su subcuenta y se cuadra **por saldo** (una transferencia puede pagar varias facturas o ser provisión de fondos).
- **Provisión de fondos:** lo que paga Solve por nosotros (notaría, registro) se descuenta de la subcuenta de Solve.
- **Banco por aplicar agrupado por entidad:** se pregunta una vez «¿Dónde va?» y la regla vale para los movimientos futuros. Si tiene factura, va a la subcuenta del tercero y queda pendiente la factura.
- Abogados y profesionales: 623, con retención (modelo 111). Alquileres: 621 (modelo 115).
- Facturas con la propia empresa como emisora: se intercambian los papeles automáticamente y se marcan para revisar.

## Banco
- Cierre del extracto por trimestre y año (saldo inicial/final, cuadrados, huella digital; avisa si cambia después).
- Justificante individual de cada cargo (carpeta `documentos_banco`), asociado solo o a mano.

## Impuestos
- Pestaña Impuestos por año: 303, 111, 115, 202, 390, 190, 180, 347, 200 (y 182 en asociaciones con Ley 49/2002).
- Se registra cada modelo presentado (fecha, resultado, importe, justificante PDF en `impuestos`); desaparece el aviso del calendario; el pago se busca en el banco; el 303 genera la liquidación (472/477 → 4750/4700).
- Detecta pagos a Hacienda en el extracto y PDF de la carpeta `impuestos`.
- **Otros impuestos y tasas:** ITP/AJD (modelo 600), IBI, plusvalía, IAE, ICIO, vehículos y tasas. ITP/AJD/ICIO de una compra u obra se suman a su coste; el resto a 631. Pagados por banco, por un tercero (provisión) o pendientes.

## Documentos de la empresa
- La app recorre toda la carpeta de la empresa, guarda un inventario (`programa/inventario_documentos.json`) y solo lee con la IA lo nuevo o cambiado. Vincula sola escrituras, préstamos, compraventas, arras y contratos con pagos, marcados «IA · revisar».
- **Renombrar con el formato de BITI:** `[PREFIJO]AAMMDD - TÍTULO`; escrituras `… TÍTULO PROTOCOLO-INICIALES NOTARIO` (BI260423 - AMPLIACIÓN DE CAPITAL 1648-EDF); contratos `… CONTRATO DE … - CON QUIÉN`. Uno a uno o «Ordenar nombres» por carpeta; el inventario reconoce los renombrados.

## Exportar
- ZIP para A3 o Sage por periodo: diario (subcuentas a 8 dígitos), plan de subcuentas con NIF, libros de facturas recibidas y emitidas, impuestos, extracto conciliado, pendientes y léeme. «Enviar a la gestoría» deja el mismo paquete en `para la gestoria › periodo` y avisa si no hay contrato de encargo firmado.

## Asociaciones y fundaciones
- En Ajustes → Datos de la entidad → forma jurídica. Con «Asociación»: plan ESFL, cuenta de resultados con excedente, fondo social, asistente con cuotas/donativos/subvenciones/ayudas, impuestos (182, IVA exento opcional, sin 202), calendario con asamblea y rendición de cuentas (utilidad pública).

## Calendario
- Cuadro mensual con los avisos al lado, el día de hoy y cuántos días faltan para el siguiente aviso. Los impuestos vencidos enlazan con «Registrar como presentado».

## Pendiente
- Papelería corporativa (facturas, carta, informes).
- Base de datos de prompts y skills (servicio adicional).
- Leer extractos en Excel y justificantes nuevos desde la web.
- Acciones de BITI en los paneles: desactivar altas libres en Supabase, clave mínima 12, doble factor en Supabase/Vercel/GitHub, firmar los DPA.
