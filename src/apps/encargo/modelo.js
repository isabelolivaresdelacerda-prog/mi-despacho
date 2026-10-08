// Modelo de contrato de encargo del tratamiento (art. 28 RGPD) — gestoría / cliente.
// Basado en el modelo facilitado por BITI y completado con los elementos del art. 28.3 RGPD
// y una cláusula sobre uso de sistemas de IA (Reglamento (UE) 2024/1689).
// Variables entre {{ }}; bloques condicionales con "si" (clave booleana).

export const VERSION_CONTRATO = "1.1";

// Tipos de prestador (Encargado) y sus valores por defecto
export const TIPOS = {
  gestoria: { nombre: "Gestoría / asesoría", servicios: "asesoramiento contable y fiscal" },
  it: { nombre: "Empresa de informática (IT)", servicios: "soporte, mantenimiento y desarrollo de los sistemas informáticos" },
  abogados: { nombre: "Despacho de abogados", servicios: "secretaría societaria y llevanza de libros registros",
    aviso: "Cuando el despacho asesora o defiende al cliente, normalmente es responsable del tratamiento, no encargado. Usa este contrato solo para servicios en los que el despacho trata datos por cuenta del cliente (secretaría societaria, llevanza de libros, gestión documental…)." },
  otro: { nombre: "Otro prestador", servicios: "" },
};

// Condiciones que activan bloques del modelo
export function banderas(d) {
  const t = d.tipo || "gestoria";
  const plataforma = d.intercambio === "plataforma";
  return {
    t_gestoria: t === "gestoria", t_it: t === "it", t_abogados: t === "abogados", t_otro: t === "otro",
    laboral: t === "gestoria" && !!d.laboral,
    plataforma, noplataforma: !plataforma, carpeta: d.intercambio === "carpeta",
  };
}

export const CAMPOS = {
  resp: "Responsable (cliente de la gestoría)",
  enc: "Encargado (gestoría)",
};

// Etiquetas legibles de cada variable (se usan en el formulario y en la versión Word)
export const ETIQUETAS = {
  "resp.razon_social": "Razón social del Responsable",
  "resp.nif": "NIF del Responsable",
  "resp.domicilio": "Domicilio del Responsable",
  "resp.email_rgpd": "Email del Responsable para comunicaciones RGPD",
  "resp.firmante_nombre": "Nombre del firmante del Responsable",
  "resp.firmante_dni": "DNI del firmante del Responsable",
  "resp.firmante_cargo": "Cargo / título de representación del firmante del Responsable",
  "enc.razon_social": "Razón social del prestador",
  "enc.nif": "NIF del prestador",
  "enc.domicilio": "Domicilio del prestador",
  "enc.email_rgpd": "Email del prestador para comunicaciones RGPD",
  "enc.dpd": "Delegado de Protección de Datos del prestador (si lo tiene)",
  "enc.firmante_nombre": "Nombre del firmante del prestador",
  "enc.firmante_dni": "DNI del firmante del prestador",
  "enc.firmante_cargo": "Cargo / título de representación del firmante del prestador",
  "servicios": "Servicios que presta el Encargado",
  "plataforma.nombre": "Nombre de la plataforma",
  "plataforma.titular": "Titular de la plataforma",
  "jurisdiccion": "Tribunales competentes",
  "almacenamiento": "Servicio de almacenamiento (OneDrive, Google Drive…)",
  "tratamientos_otro": "Tratamientos que realiza el prestador",
  "interesados_otro": "Personas cuyos datos se tratan",
  "datos_otro": "Tipos de datos que se tratan",
  "subencargados": "Subencargados del prestador",
  "lugar": "Lugar de firma",
};

export const MODELO = [
  { tipo: "titulo", texto: "CONTRATO DE ENCARGO DEL TRATAMIENTO DE DATOS PERSONALES" },
  { tipo: "subtitulo", texto: "(artículo 28 del Reglamento (UE) 2016/679 y artículo 33 de la Ley Orgánica 3/2018)" },

  { tipo: "seccion", texto: "REUNIDOS" },
  { tipo: "p", texto: "De una parte, {{resp.razon_social}}, con NIF {{resp.nif}} y domicilio en {{resp.domicilio}}, representada por D./Dña. {{resp.firmante_nombre}}, con DNI {{resp.firmante_dni}}, en su condición de {{resp.firmante_cargo}} (en adelante, el «Responsable del Tratamiento» o el «Responsable»)." },
  { tipo: "p", texto: "De otra parte, {{enc.razon_social}}, con NIF {{enc.nif}} y domicilio en {{enc.domicilio}}, representada por D./Dña. {{enc.firmante_nombre}}, con DNI {{enc.firmante_dni}}, en su condición de {{enc.firmante_cargo}} (en adelante, el «Encargado del Tratamiento» o el «Encargado»)." },
  { tipo: "p", texto: "Cada firmante declara que la representación con la que actúa está vigente y le faculta para suscribir el presente contrato. Ambas partes se reconocen capacidad suficiente y" },

  { tipo: "seccion", texto: "EXPONEN" },
  { tipo: "p", texto: "I. Que el Encargado presta al Responsable servicios de {{servicios}} (en adelante, los «Servicios»)." },
  { tipo: "p", texto: "II. Que para la prestación de los Servicios el Encargado necesita acceder a datos personales respecto de los cuales el Responsable tiene la condición de responsable del tratamiento, por lo que ambas partes desean regular dicho acceso conforme al artículo 28 del Reglamento (UE) 2016/679 (en adelante, «RGPD») y al artículo 33 de la Ley Orgánica 3/2018, de Protección de Datos Personales y garantía de los derechos digitales (en adelante, «LOPDGDD»)." },
  { tipo: "p", si: "carpeta", texto: "III. Que la documentación se pone a disposición del Encargado en una carpeta compartida de {{almacenamiento}} de titularidad del Responsable, con acceso restringido a las personas autorizadas del Encargado, de forma que los datos permanecen en el entorno del Responsable." },
  { tipo: "p", si: "plataforma", texto: "III. Que el intercambio de la documentación entre las partes se realiza a través de la plataforma {{plataforma.nombre}}, de la que es titular {{plataforma.titular}}, cuyas características de seguridad se describen en el Anexo I." },
  { tipo: "p", texto: "En virtud de lo anterior, las partes acuerdan las siguientes" },

  { tipo: "seccion", texto: "CLÁUSULAS" },

  { tipo: "clausula", texto: "1. Objeto del encargo" },
  { tipo: "p", texto: "Mediante las presentes cláusulas se habilita al Encargado para tratar, por cuenta del Responsable, los datos personales necesarios para la prestación de los Servicios." },
  { tipo: "p", si: "t_gestoria", texto: "Los tratamientos autorizados son: recogida, registro, organización, estructuración, conservación, consulta, extracción, cotejo, comunicación por transmisión a las Administraciones y organismos públicos cuando sea necesaria para los Servicios y conforme a las instrucciones del Responsable (entre otros, Agencia Estatal de Administración Tributaria, Tesorería General de la Seguridad Social y Registro Mercantil), así como la supresión y destrucción de los datos." },
  { tipo: "p", si: "t_it", texto: "Los tratamientos autorizados son: acceso, consulta, conservación, alojamiento, copia de seguridad, restauración, migración, estructuración, modificación técnica necesaria para el mantenimiento y la supresión de los datos contenidos en los sistemas de información del Responsable, en la medida estrictamente necesaria para prestar los Servicios." },
  { tipo: "p", si: "t_abogados", texto: "Los tratamientos autorizados son: recogida, registro, organización, conservación, consulta, elaboración de documentos, comunicación a notarías, registros y Administraciones públicas cuando sea necesaria para los Servicios y conforme a las instrucciones del Responsable, así como la supresión de los datos." },
  { tipo: "p", si: "t_otro", texto: "Los tratamientos autorizados son los estrictamente necesarios para prestar los Servicios: {{tratamientos_otro}}." },

  { tipo: "clausula", texto: "2. Identificación de la información afectada" },
  { tipo: "p", texto: "Para la ejecución de los Servicios, el Responsable pone a disposición del Encargado la información que se describe a continuación." },
  { tipo: "lista", si: "t_gestoria", items: [
    "Categorías de interesados: proveedores, acreedores, clientes, arrendatarios, socios, partícipes, así como sus representantes y personas de contacto.",
    "Categorías de datos: datos identificativos (nombre y apellidos o razón social, NIF/DNI, domicilio), datos de contacto, datos económicos y financieros (facturas, importes, cuentas bancarias, movimientos y justificantes bancarios) y datos de transacciones de bienes y servicios.",
  ] },
  { tipo: "lista", si: "t_it", items: [
    "Categorías de interesados: empleados, clientes, proveedores, usuarios de los sistemas y personas de contacto del Responsable.",
    "Categorías de datos: datos identificativos y de contacto, credenciales y registros de acceso, datos profesionales y, en general, los datos contenidos en los sistemas, equipos y aplicaciones del Responsable a los que el Encargado deba acceder para prestar los Servicios.",
  ] },
  { tipo: "lista", si: "t_abogados", items: [
    "Categorías de interesados: socios, administradores, apoderados, empleados, clientes, proveedores y contrapartes del Responsable, así como sus representantes.",
    "Categorías de datos: datos identificativos y de contacto, datos profesionales y de cargos, participaciones y datos económicos y financieros vinculados a los Servicios.",
  ] },
  { tipo: "lista", si: "t_otro", items: [
    "Categorías de interesados: {{interesados_otro}}.",
    "Categorías de datos: {{datos_otro}}.",
  ] },
  { tipo: "p", si: "laboral", texto: "Dado que los Servicios incluyen la gestión laboral, se incluyen además como interesados los empleados del Responsable, y como categorías de datos los datos de empleo, nómina, afiliación a la Seguridad Social y retenciones." },
  { tipo: "p", texto: "No se prevé el tratamiento de categorías especiales de datos (art. 9 RGPD). Si de forma accidental figurasen en la documentación, el Encargado se abstendrá de tratarlos más allá de lo estrictamente imprescindible para los Servicios y lo comunicará al Responsable." },

  { tipo: "clausula", texto: "3. Duración" },
  { tipo: "p", texto: "El presente contrato entra en vigor en la fecha de la última firma y se mantendrá vigente mientras se presten los Servicios." },
  { tipo: "p", texto: "Una vez finalice el presente contrato, el Encargado deberá devolver al Responsable, o transmitir a otro encargado que designe el Responsable, los datos personales tratados, y suprimir cualquier copia que esté en su poder. No obstante, podrá mantener los datos debidamente bloqueados durante el tiempo necesario para atender las responsabilidades que pudieran derivarse de su relación con el Responsable, y como máximo durante los plazos de prescripción legalmente aplicables, destruyéndolos de forma segura y definitiva al finalizar dicho plazo." },

  { tipo: "clausula", texto: "4. Obligaciones del Encargado del Tratamiento" },
  { tipo: "p", texto: "El Encargado y todo su personal se obligan a:" },
  { tipo: "lista", items: [
    "Utilizar los datos personales objeto de tratamiento, o los que recoja para su inclusión, solo para la finalidad objeto de este encargo. En ningún caso podrá utilizar los datos para fines propios.",
    "Tratar los datos de acuerdo con las instrucciones documentadas del Responsable. Si el Encargado considera que alguna de las instrucciones infringe el RGPD o cualquier otra disposición en materia de protección de datos, informará inmediatamente al Responsable.",
    "Llevar, por escrito, un registro de todas las categorías de actividades de tratamiento efectuadas por cuenta del Responsable, con el contenido exigido por el artículo 30.2 RGPD: (i) el nombre y los datos de contacto del Encargado, de cada responsable por cuenta del cual actúe y, en su caso, de sus representantes y delegados de protección de datos; (ii) las categorías de tratamientos efectuados por cuenta de cada responsable; (iii) en su caso, las transferencias internacionales de datos; y (iv) una descripción general de las medidas técnicas y organizativas de seguridad que esté aplicando.",
    "No comunicar ni difundir los datos a terceros, salvo que cuente con la autorización expresa del Responsable o en los supuestos legalmente admisibles.",
    "No realizar transferencias internacionales de datos fuera del Espacio Económico Europeo sin la autorización previa y por escrito del Responsable y sin las garantías previstas en el Capítulo V del RGPD.",
    "Mantener el deber de secreto respecto de los datos personales a los que haya tenido acceso en virtud del presente encargo, incluso después de que finalice el contrato.",
    "Garantizar que las personas autorizadas para tratar datos personales (i) se comprometan, de forma expresa y por escrito, a respetar la confidencialidad; o (ii) estén sujetas a una obligación de confidencialidad de naturaleza estatutaria. El Encargado garantiza igualmente que dichas personas se comprometan a cumplir las medidas de seguridad correspondientes, de las que deberá informarles convenientemente. Cuando el intercambio se realice a través de una plataforma, cada persona autorizada del Encargado aceptará dicho compromiso de forma individual en su primer acceso, quedando constancia de ello.",
    "Mantener a disposición del Responsable la documentación acreditativa del cumplimiento de la obligación establecida en el apartado anterior.",
    "Garantizar la formación necesaria en materia de protección de datos personales de las personas autorizadas para tratar datos personales.",
    "Limitar el acceso a los datos del Responsable a las personas de su organización que lo necesiten para prestar los Servicios, y retirar dicho acceso de forma inmediata cuando dejen de necesitarlo.",
    "Cuando los interesados ejerzan ante el Encargado los derechos de acceso, rectificación, supresión, portabilidad, oposición o limitación del tratamiento, comunicarlo por correo electrónico a la dirección {{resp.email_rgpd}} de forma inmediata y, en ningún caso, más allá del día laborable siguiente al de la recepción de la solicitud, junto, en su caso, con otras informaciones que puedan ser relevantes para resolverla. Asistirá al Responsable, siempre que sea posible, para que este pueda cumplir y dar respuesta al ejercicio de derechos.",
    "Ayudar al Responsable a garantizar el cumplimiento de las obligaciones establecidas en los artículos 32 a 36 RGPD, incluidas, cuando procedan, la realización de evaluaciones de impacto relativas a la protección de datos y la consulta previa a la autoridad de control.",
    "Poner a disposición del Responsable toda la información necesaria para demostrar el cumplimiento de sus obligaciones, así como para permitir y contribuir a la realización de auditorías o inspecciones por parte del Responsable o de otro auditor autorizado por él.",
    "Implantar las medidas de seguridad técnicas y organizativas necesarias para garantizar la confidencialidad, integridad, disponibilidad y resiliencia permanentes de los sistemas y servicios de tratamiento, de conformidad con el artículo 32 RGPD y, como mínimo, las descritas en el Anexo I.",
    "Designar un Delegado de Protección de Datos cuando se den las condiciones establecidas en la normativa y comunicar su identidad y datos de contacto al Responsable. Datos del Delegado de Protección de Datos del Encargado, en su caso: {{enc.dpd}}.",
    "Poner inmediatamente en conocimiento del Responsable cualquier requerimiento que la Agencia Española de Protección de Datos o cualquier otra autoridad le dirija en relación con este contrato.",
  ] },

  { tipo: "clausula", texto: "5. Notificación de violaciones de la seguridad de los datos" },
  { tipo: "p", texto: "El Encargado notificará al Responsable, sin dilación indebida y, en cualquier caso, en un plazo máximo de veinticuatro (24) horas, a través de la dirección {{resp.email_rgpd}}, las violaciones de la seguridad de los datos personales a su cargo de las que tenga conocimiento, junto con toda la información relevante para la documentación y comunicación de la incidencia. Asimismo, notificará cualquier fallo de sus sistemas de tratamiento y gestión de la información que pueda poner en peligro la seguridad, integridad o disponibilidad de los datos personales tratados, así como cualquier posible vulneración de la confidencialidad derivada de la puesta en conocimiento de terceros de los datos e informaciones a los que haya accedido durante la ejecución del contrato." },
  { tipo: "p", texto: "Se facilitará, como mínimo, la información siguiente:" },
  { tipo: "lista", items: [
    "Descripción de la naturaleza de la violación de la seguridad de los datos personales, incluyendo, cuando sea posible, las categorías y el número aproximado de interesados afectados, y las categorías y el número aproximado de registros de datos personales afectados.",
    "Datos de la persona de contacto para obtener más información.",
    "Descripción de las posibles consecuencias de la violación de la seguridad de los datos personales.",
    "Descripción de las medidas adoptadas o propuestas para poner remedio a la violación de la seguridad de los datos personales, incluyendo, si procede, las medidas adoptadas para mitigar sus posibles efectos negativos.",
  ] },
  { tipo: "p", texto: "Si no es posible facilitar la información simultáneamente, y en la medida en que no lo sea, la información se facilitará de manera gradual sin dilación indebida." },
  { tipo: "p", texto: "Corresponde al Responsable comunicar las violaciones de seguridad a la autoridad de control y, en su caso, a los interesados. El Encargado, a petición del Responsable, colaborará en dichas comunicaciones, que deberán realizarse en un lenguaje claro y sencillo." },

  { tipo: "clausula", texto: "6. Uso de sistemas de inteligencia artificial" },
  { tipo: "p", texto: "Cualquiera de las partes podrá utilizar sistemas de inteligencia artificial como herramienta de apoyo en la prestación de los Servicios (por ejemplo, para la lectura de documentos o la propuesta de asientos o borradores) siempre que se ejecuten en equipos bajo su control y sin transmitir los datos personales a terceros. La utilización de sistemas de inteligencia artificial prestados por terceros en la nube requerirá la autorización previa y por escrito del Responsable y tendrá la consideración de subencargo conforme a la cláusula 8." },
  { tipo: "p", texto: "Los resultados generados por dichos sistemas tienen la consideración de propuestas y serán revisados por una persona antes de su uso. En ningún caso podrán utilizarse los datos del Responsable para entrenar, ajustar o mejorar modelos de inteligencia artificial, propios o de terceros." },
  { tipo: "p", texto: "Ambas partes se comprometen a cumplir, en lo que les resulte aplicable, el Reglamento (UE) 2024/1689 de Inteligencia Artificial, y en particular a adoptar medidas para garantizar un nivel suficiente de alfabetización en materia de inteligencia artificial de su personal (art. 4) y a mantener la supervisión humana de los resultados." },

  { tipo: "clausula", texto: "7. Obligaciones del Responsable del Tratamiento" },
  { tipo: "p", texto: "Corresponde al Responsable:" },
  { tipo: "lista", items: [
    "Entregar al Encargado los datos necesarios para que pueda prestar los Servicios.",
    "Garantizar que los datos se han obtenido lícitamente y que se ha informado a los interesados conforme a los artículos 13 y 14 RGPD.",
    "Revisar los resultados generados por sistemas de inteligencia artificial antes de ponerlos a disposición del Encargado.",
    "Velar, de forma previa y durante todo el tratamiento, por el cumplimiento de las disposiciones vigentes en materia de protección de datos por parte del Encargado.",
    "Supervisar el tratamiento, incluida la posibilidad de solicitar información para verificar el cumplimiento de las obligaciones establecidas en el presente contrato.",
  ] },

  { tipo: "clausula", texto: "8. Subcontratación" },
  { tipo: "p", texto: "El Responsable autoriza al Encargado a recurrir a los subencargados que figuran en el Anexo II, que prestan servicios auxiliares necesarios para el funcionamiento de la plataforma." },
  { tipo: "p", texto: "Fuera de lo anterior, el Encargado no podrá subcontratar ninguna de las prestaciones que formen parte del objeto de este contrato que comporten el tratamiento de datos personales, salvo los servicios auxiliares necesarios para el normal funcionamiento de los servicios del Encargado. Si fuera necesario subcontratar algún tratamiento, este hecho se deberá comunicar previamente por escrito al Responsable con una antelación de quince (15) días, indicando los tratamientos que se pretenden subcontratar e identificando de forma clara e inequívoca la empresa subcontratista (subencargado) y sus datos de contacto. La subcontratación podrá llevarse a cabo si el Responsable no manifiesta su oposición en el plazo de diez (10) días hábiles a partir del día siguiente a la recepción de la comunicación." },
  { tipo: "p", texto: "El subencargado, que también tendrá la condición de encargado del tratamiento, está obligado igualmente a cumplir las obligaciones establecidas en este documento para el Encargado y a seguir las instrucciones que dicte el Responsable. Corresponde al Encargado inicial regular la nueva relación de forma que el subencargado quede sujeto a las mismas condiciones (instrucciones, obligaciones, medidas de seguridad, etc.) y con los mismos requisitos formales que él en lo referente al adecuado tratamiento de los datos personales y a la garantía de los derechos de las personas afectadas. En caso de incumplimiento por parte del subencargado, el Encargado inicial seguirá siendo plenamente responsable ante el Responsable en lo referente al cumplimiento de las obligaciones." },

  { tipo: "clausula", texto: "9. Destino de los datos al finalizar el encargo" },
  { tipo: "lista", items: [
    "Una vez finalizada la prestación de los Servicios, el Encargado suprimirá, devolverá al Responsable o entregará, en su caso, a un nuevo encargado que designe el Responsable, todos los datos personales objeto del encargo.",
    "No procederá la destrucción de los datos cuando exista una previsión legal que obligue a su conservación, en cuyo caso deberán devolverse al Responsable, que garantizará su conservación, debidamente bloqueados, mientras tal obligación persista.",
    "La devolución debe comportar el borrado total de los datos existentes en los equipos informáticos utilizados por el Encargado. No obstante, el Encargado puede conservar una copia de los datos, debidamente bloqueados, mientras puedan derivarse responsabilidades de la ejecución de los Servicios.",
  ] },

  { tipo: "clausula", texto: "10. Responsabilidad" },
  { tipo: "p", texto: "Cada parte responderá de los daños y perjuicios que se deriven del incumplimiento de las obligaciones que le corresponden conforme a este contrato y a la normativa de protección de datos. Si el Encargado destinase los datos a otra finalidad, los comunicase o los utilizase incumpliendo las estipulaciones del presente contrato, será considerado también responsable del tratamiento, respondiendo de las infracciones en que hubiera incurrido personalmente (art. 28.10 RGPD)." },

  { tipo: "clausula", texto: "11. Firma electrónica y conservación de las evidencias" },
  { tipo: "p", texto: "Las partes acuerdan suscribir el presente contrato mediante firma electrónica en la plataforma {{plataforma.nombre}}, reconociéndole plena validez y eficacia conforme al artículo 25 del Reglamento (UE) 910/2014 (eIDAS). La firma se realiza por cada firmante tras su identificación con usuario, contraseña y segundo factor de autenticación bajo su control exclusivo. La plataforma conserva, para cada firma, la fecha y hora, la identidad del firmante, la dirección IP, la verificación del segundo factor y la huella digital (SHA-256) del documento firmado, de forma que cualquier modificación posterior sea detectable." },
  { tipo: "p", texto: "Cualquiera de las partes podrá, adicionalmente, firmar el contrato con un certificado electrónico cualificado. Cada parte podrá descargar en cualquier momento un ejemplar del contrato firmado junto con su hoja de evidencias." },

  { tipo: "clausula", texto: "12. Legislación aplicable y jurisdicción" },
  { tipo: "p", texto: "El presente contrato se rige por la legislación española. Para cualquier controversia derivada de su interpretación o ejecución, las partes se someten a los Juzgados y Tribunales de {{jurisdiccion}}." },

  { tipo: "p", texto: "Y en prueba de conformidad, las partes firman el presente contrato electrónicamente en {{lugar}}, en las fechas que constan en la hoja de evidencias." },
  { tipo: "firmas" },

  { tipo: "salto" },
  { tipo: "seccion", si: "plataforma", texto: "ANEXO I. MEDIDAS DE SEGURIDAD DE LA PLATAFORMA" },
  { tipo: "lista", si: "plataforma", items: [
    "Autenticación de todos los usuarios con contraseña y segundo factor obligatorio (código temporal en aplicación de autenticación).",
    "Aislamiento de la información de cada cliente mediante políticas de seguridad aplicadas en la propia base de datos: ningún usuario puede acceder a datos de un cliente para el que no esté autorizado.",
    "Gestión de accesos por roles: administrador de la gestoría, trabajador de la gestoría con acceso solo a los clientes asignados, y usuario del cliente con acceso solo a sus propios datos. Acceso de la gestoría en modo de consulta y descarga.",
    "Cifrado de las comunicaciones (HTTPS/TLS) y cifrado de los datos almacenados.",
    "Almacenamiento de los datos en centros de datos situados en la Unión Europea.",
    "Descargas mediante enlaces firmados de validez limitada (minutos).",
    "Registro de actividad: publicaciones, accesos, descargas y firmas, sin posibilidad de modificación ni borrado por los usuarios.",
    "Compromiso de confidencialidad individual de cada usuario de la gestoría, aceptado en su primer acceso.",
    "Bloqueo del acceso a los datos de un cliente hasta que el presente contrato esté firmado por ambas partes.",
    "Copias de seguridad gestionadas por el proveedor de alojamiento.",
  ] },

  { tipo: "seccion", si: "noplataforma", texto: "ANEXO I. MEDIDAS DE SEGURIDAD" },
  { tipo: "lista", si: "noplataforma", items: [
    "Acceso a los datos limitado a las personas autorizadas del Encargado, con usuario personal, contraseña robusta y verificación en dos pasos.",
    "Retirada inmediata del acceso de las personas que dejen de prestar los Servicios.",
    "Equipos con cifrado de disco, sistema operativo y antivirus actualizados y bloqueo automático de pantalla.",
    "Prohibición de descargar o copiar los datos fuera del entorno del Responsable, salvo lo estrictamente necesario para los Servicios, y supresión de dichas copias al terminar.",
    "Uso de conexiones cifradas para cualquier transmisión de datos.",
    "Compromiso de confidencialidad firmado por cada persona autorizada.",
    "Procedimiento interno para detectar, documentar y notificar violaciones de seguridad en el plazo de la cláusula 5.",
    "Cuando se usen herramientas de inteligencia artificial, ejecución en equipos bajo control del Encargado, conforme a la cláusula 6.",
  ] },
  { tipo: "seccion", texto: "ANEXO II. SUBENCARGADOS AUTORIZADOS" },
  { tipo: "lista", si: "plataforma", items: [
    "{{plataforma.titular}} — titular y gestor de la plataforma {{plataforma.nombre}}.",
    "Supabase Inc. — alojamiento de la base de datos, autenticación y almacenamiento de documentos. Ubicación de los datos: Unión Europea (París, Francia).",
    "Vercel Inc. — servicio de la aplicación web. No almacena los datos de los clientes; los documentos se transmiten directamente entre el navegador del usuario y el almacenamiento en la Unión Europea.",
  ] },
  { tipo: "p", si: "noplataforma", texto: "{{subencargados}}" },
];

// Rellena las variables. Si falta un dato, deja la etiqueta entre corchetes.
export function rellenar(texto, datos) {
  return texto.replace(/\{\{([\w.]+)\}\}/g, (_, k) => {
    const v = k.split(".").reduce((o, p) => (o ? o[p] : undefined), datos);
    return v && String(v).trim() ? String(v).trim() : `[${ETIQUETAS[k] || k}]`;
  });
}
