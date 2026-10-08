// Mapa documental por tipo de empresa: qué documentos tiene, dónde viven y si importan a la contabilidad / gestoría.
// "carpeta" es la ruta dentro de la carpeta de la empresa. "conta" indica para qué lo necesita la contabilidad (vacío = no contable).
// "conservar": plazo orientativo de conservación.

const C6 = "6 años (art. 30 Código de Comercio)";
const SIEMPRE = "Mientras exista la sociedad";
const CONTA = "004 ADMINISTRACIÓN/contabilidad";

// Comunes a cualquier sociedad
export const COMUNES = [
  { grupo: "Sociedad", nombre: "Escrituras (constitución, ampliaciones, modificaciones, poderes)", carpeta: "001 corporate", conta: "Capital social (cta. 100), gastos de constitución y ampliación, quién puede firmar", conservar: SIEMPRE },
  { grupo: "Sociedad", nombre: "Estatutos, CIF, alta en Hacienda (036) y titularidad real", carpeta: "001 corporate", conta: "Datos fiscales de la sociedad", conservar: SIEMPRE },
  { grupo: "Sociedad", nombre: "Actas de junta y consejo, certificaciones", carpeta: "001 corporate/ACTAS Y CERTIFICACIONES", conta: "Aprobación de cuentas, aplicación del resultado, dividendos, ampliaciones", conservar: SIEMPRE },
  { grupo: "Sociedad", nombre: "Libro de socios, aportaciones y préstamos de socios", carpeta: "001 corporate/doc socios", conta: "Cuentas 100, 118, 551 (socios)", conservar: SIEMPRE },
  { grupo: "Sociedad", nombre: "Cuentas anuales depositadas y libros legalizados", carpeta: "001 corporate", conta: "Cierre de ejercicio", conservar: C6 },
  { grupo: "Financiación", nombre: "Préstamos, pólizas de crédito, avales y leasing", carpeta: "003 FINANCING", conta: "Deudas (170, 520), cuadro de amortización, intereses (662)", conservar: C6 + " desde su cancelación" },
  { grupo: "Contabilidad", nombre: "Facturas recibidas", carpeta: CONTA + "/facturas", conta: "Gastos, IVA soportado, retenciones", conservar: C6 },
  { grupo: "Contabilidad", nombre: "Facturas emitidas", carpeta: CONTA + "/facturas_emitidas", conta: "Ingresos, IVA repercutido", conservar: C6 },
  { grupo: "Contabilidad", nombre: "Extractos y justificantes bancarios", carpeta: CONTA + "/extractos · documentos_banco", conta: "Tesorería (572), conciliación de pagos y cobros", conservar: C6 },
  { grupo: "Contabilidad", nombre: "Impuestos presentados (303, 111, 115, 200, 390, 347…) y pagos", carpeta: CONTA + "/impuestos", conta: "Hacienda pública (47x), cierre fiscal", conservar: "4 años desde el fin del plazo (prescripción) — mejor 6" },
  { grupo: "Contabilidad", nombre: "Tributos locales (IBI, tasas, IAE)", carpeta: CONTA + "/ibi_tasas", conta: "Otros tributos (631)", conservar: C6 },
  { grupo: "Contabilidad", nombre: "Pólizas de seguro y recibos", carpeta: CONTA + "/seguros", conta: "Primas de seguros (625), periodificación", conservar: C6 },
  { grupo: "Contratos", nombre: "Contratos de servicios: gestoría, asesores, intermediación, suministros", carpeta: "004 ADMINISTRACIÓN/contratos gestion e intermediacion", conta: "Gastos recurrentes y retenciones a profesionales", conservar: C6 + " desde su fin" },
  { grupo: "Cumplimiento", nombre: "Protección de datos: contratos de encargo, registro de actividades", carpeta: "004 ADMINISTRACIÓN/contratos gestion e intermediacion", conta: "", conservar: "Mientras dure el tratamiento y responsabilidades" },
];

// Si la empresa tiene trabajadores
export const LABORAL = [
  { grupo: "Laboral", nombre: "Contratos de trabajo, nóminas, seguros sociales (RLC/RNT)", carpeta: "004 ADMINISTRACIÓN/laboral", conta: "Sueldos (640), Seguridad Social (642), retenciones (4751)", conservar: "4 años (LISOS) — nóminas, 6 años por contabilidad" },
  { grupo: "Laboral", nombre: "Prevención de riesgos laborales", carpeta: "005 TECHNICAL", conta: "", conservar: "Mientras dure la actividad" },
];

export const POR_SECTOR = {
  inmobiliaria: [
    { grupo: "Adquisición", nombre: "Contratos de arras", carpeta: "002 ACQUISITION/arras", conta: "Anticipos a proveedores de inmovilizado o existencias (407/239)", conservar: C6 },
    { grupo: "Adquisición", nombre: "Escrituras de compraventa del activo", carpeta: "002 ACQUISITION/compraventa", conta: "Coste del suelo o inmueble, ITP/AJD, notaría y registro", conservar: SIEMPRE + " (mientras se tenga el activo + 6 años)" },
    { grupo: "Adquisición", nombre: "Notas simples, due diligence, memorandos, sources & uses", carpeta: "002 ACQUISITION", conta: "", conservar: "Mientras se tenga el activo" },
    { grupo: "Socios del proyecto", nombre: "Contratos de cuentas en participación con partícipes", carpeta: "001 corporate/participes", conta: "Deudas con partícipes y reparto de resultados", conservar: C6 + " desde su liquidación" },
    { grupo: "Técnico", nombre: "Licencias urbanísticas, proyectos, certificados de obra", carpeta: "005 TECHNICAL", conta: "Soporte de facturas de obra (existencias en curso / inmovilizado)", conservar: "Mientras exista el edificio" },
    { grupo: "Explotación", nombre: "Contratos de arrendamiento y depósitos de fianza", carpeta: CONTA + "/contratos_alquiler", conta: "Ingresos por arrendamiento (752), fianzas (180/560)", conservar: C6 + " desde su fin" },
    { grupo: "Comercialización", nombre: "Mandatos de venta, hojas de visita, reservas de compradores", carpeta: "006 MANAGEMENT", conta: "Comisiones de intermediación (623)", conservar: C6 },
    { grupo: "Cumplimiento", nombre: "Prevención del blanqueo: KYC de compradores y vendedores", carpeta: "001 corporate", conta: "", conservar: "10 años (Ley 10/2010)" },
  ],
  musica: [
    { grupo: "Producción", nombre: "Dossier, presupuesto y cierre económico de cada producción", carpeta: "002 PRODUCCIONES/<producción>", conta: "Ingresos y gastos por proyecto (centros de coste)", conservar: C6 },
    { grupo: "Artistas", nombre: "Contratos con artistas y compañías (relación laboral especial o mercantil)", carpeta: "002 PRODUCCIONES/<producción>/contratos artistas", conta: "Cachés: nómina de artistas o factura con retención", conservar: C6 },
    { grupo: "Salas y promotores", nombre: "Contratos con salas, promotores y coproductores", carpeta: "002 PRODUCCIONES/<producción>/contratos salas y promotores", conta: "Reparto de taquilla, garantías, coproducción", conservar: C6 },
    { grupo: "Taquilla", nombre: "Liquidaciones de ticketing y aforos", carpeta: "006 MANAGEMENT/ticketing", conta: "Ingresos por entradas e IVA aplicable a las entradas", conservar: C6 },
    { grupo: "Derechos", nombre: "Licencias y liquidaciones de derechos de autor (SGAE) y afines (AIE, AGEDI)", carpeta: "007 DERECHOS", conta: "Gasto por derechos y su liquidación", conservar: C6 },
    { grupo: "Derechos", nombre: "Contratos de cesión de derechos, grabaciones y masters, marcas", carpeta: "007 DERECHOS", conta: "Propiedad intelectual (inmovilizado intangible) si se adquiere", conservar: "Mientras duren los derechos" },
    { grupo: "Financiación", nombre: "Patrocinios y subvenciones (INAEM, comunidades) con su justificación", carpeta: "003 FINANCING/subvenciones · patrocinios", conta: "Subvenciones (740/130) e ingresos por patrocinio", conservar: "4 años desde la justificación (Ley General de Subvenciones) — mejor 6" },
    { grupo: "Técnico", nombre: "Riders, escenografía, permisos de espectáculo y seguros del evento", carpeta: "005 TECHNICAL · 002 PRODUCCIONES/<producción>/seguros y permisos", conta: "Soporte de gastos técnicos y primas", conservar: C6 },
  ],
  industrial: [
    { grupo: "Producción", nombre: "Fichas técnicas, órdenes de fabricación y escandallos", carpeta: "002 PRODUCCION", conta: "Coste de producción", conservar: C6 },
    { grupo: "Existencias", nombre: "Inventarios y recuentos de existencias", carpeta: "002 PRODUCCION", conta: "Existencias (30x) y variación de existencias al cierre", conservar: C6 },
    { grupo: "Activos", nombre: "Facturas y contratos de maquinaria e instalaciones, cuadro de amortización", carpeta: "005 TECHNICAL", conta: "Inmovilizado material (21x) y amortización (681)", conservar: "Vida útil del activo + 6 años" },
    { grupo: "Calidad", nombre: "Marcado CE y declaraciones de conformidad, certificaciones ISO, homologaciones", carpeta: "005 TECHNICAL/certificaciones y homologaciones", conta: "", conservar: "10 años desde la última unidad comercializada (marcado CE)" },
    { grupo: "Propiedad industrial", nombre: "Patentes, modelos de utilidad, marcas", carpeta: "005 TECHNICAL/patentes", conta: "Inmovilizado intangible (20x)", conservar: "Mientras estén en vigor" },
    { grupo: "I+D", nombre: "Proyectos de I+D+i e informes motivados", carpeta: "005 TECHNICAL/I+D", conta: "Gastos de desarrollo y deducciones fiscales", conservar: "Hasta 10 años si se aplican deducciones" },
    { grupo: "Comercial", nombre: "Contratos con clientes y distribuidores, pedidos y albaranes", carpeta: "006 COMERCIAL", conta: "Ventas (700) y cuentas de clientes", conservar: C6 },
    { grupo: "Compras", nombre: "Contratos de suministro, pedidos y albaranes de proveedores", carpeta: "007 COMPRAS", conta: "Compras (600) y proveedores (400)", conservar: C6 },
    { grupo: "Medio ambiente", nombre: "Autorizaciones ambientales y gestión de residuos", carpeta: "005 TECHNICAL/medio ambiente", conta: "", conservar: "Según autorización (mínimo 5 años los registros de residuos)" },
  ],
  servicios: [
    { grupo: "Clientes", nombre: "Propuestas y presupuestos aceptados", carpeta: "002 CLIENTES/propuestas", conta: "", conservar: C6 },
    { grupo: "Clientes", nombre: "Contratos con clientes y entregables", carpeta: "002 CLIENTES/contratos · entregables", conta: "Ingresos por servicios (705) y su devengo", conservar: C6 + " desde su fin" },
    { grupo: "Colaboradores", nombre: "Contratos con colaboradores y freelances", carpeta: "004 ADMINISTRACIÓN/contratos gestion e intermediacion", conta: "Servicios profesionales (623) con retención", conservar: C6 },
    { grupo: "Propiedad intelectual", nombre: "Cesión de derechos sobre lo que se entrega al cliente", carpeta: "002 CLIENTES/contratos", conta: "", conservar: "Mientras duren los derechos" },
  ],
};

export function mapaDocumental(sector, conEmpleados = true) {
  return [...COMUNES, ...(conEmpleados ? LABORAL : []), ...(POR_SECTOR[sector] || [])];
}
