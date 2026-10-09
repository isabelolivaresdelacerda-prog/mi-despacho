// Generador del contrato de mandato de venta (Villanueva de la Torre). Todo se hace en el navegador: no se envía nada.

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function numeroEnLetras(n){
  n = Math.round(n);
  if (n === 0) return 'CERO';
  const UNI = ['','UNO','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE','DIEZ','ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECISÉIS','DIECISIETE','DIECIOCHO','DIECINUEVE','VEINTE'];
  const DEC = ['','','VEINTE','TREINTA','CUARENTA','CINCUENTA','SESENTA','SETENTA','OCHENTA','NOVENTA'];
  const CEN = ['','CIENTO','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS','QUINIENTOS','SEISCIENTOS','SETECIENTOS','OCHOCIENTOS','NOVECIENTOS'];
  function bloque999(n, apocope){
    if (n === 0) return '';
    if (n === 100) return 'CIEN';
    let s = '';
    const c = Math.floor(n/100), r = n%100;
    if (c>0) s += CEN[c] + ' ';
    if (r>0){
      if (r<=20) s += (apocope && r===1 ? 'UN' : UNI[r]);
      else {
        const d = Math.floor(r/10), u = r%10;
        const VEINTI_ACENTOS = {2:'DÓS',3:'TRÉS',6:'SÉIS'};
        if (d===2) s += 'VEINTI' + (apocope && u===1 ? 'ÚN' : (VEINTI_ACENTOS[u] || UNI[u]));
        else { s += DEC[d]; if (u>0) s += ' Y ' + (apocope && u===1 ? 'UN' : UNI[u]); }
      }
    }
    return s.trim();
  }
  const millones = Math.floor(n / 1000000);
  const miles = Math.floor((n % 1000000) / 1000);
  const resto = n % 1000;
  let partes = [];
  if (millones>0){
    partes.push(millones===1 ? 'UN MILLÓN' : bloque999(millones,true) + ' MILLONES');
  }
  if (miles>0){
    partes.push((miles===1 ? 'MIL' : bloque999(miles,true) + ' MIL'));
  }
  if (resto>0 || partes.length===0){
    partes.push(bloque999(resto, true));
  }
  let out = partes.filter(Boolean).join(' ');
  if (miles===0 && resto===0 && millones>0) out += ' DE'; // "UN MILLÓN DE EUROS"
  return out.trim();
}

function fmtEUR(n){
  if (isNaN(n) || n===null || n==='') return '';
  return new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);
}

function val(id){ const el = document.getElementById(id); return el ? el.value.trim() : ''; }
function numv(id){ const v = val(id); return v==='' ? null : Number(v); }

function getData(){
  const exclusividad = document.querySelector('input[name=exclusividad]:checked').value;
  let fecha = val('fechaFirma');
  let dia='[·]', mes='[·]', anio='[·]';
  if (fecha){ const d = new Date(fecha+'T00:00:00'); dia = d.getDate(); mes = MESES[d.getMonth()]; anio = d.getFullYear(); }
  return {
    mandanteNombre: val('mandanteNombre') || 'APICE CONSTRUCCIONES Y CONTRATAS, S.L.',
    mandanteNif: val('mandanteNif'),
    mandanteRM: val('mandanteRM'),
    mandanteDomicilio: val('mandanteDomicilio'),
    mandanteRepNombre: val('mandanteRepNombre'),
    mandanteRepDni: val('mandanteRepDni'),
    mandanteRepCargo: val('mandanteRepCargo'),
    mandatarioNombre: val('mandatarioNombre'),
    mandatarioNif: val('mandatarioNif'),
    mandatarioDomicilio: val('mandatarioDomicilio'),
    refCatastral: val('refCatastral'),
    exclusividad,
    precioMinimo: numv('precioMinimo'),
    margenNegociacion: numv('margenNegociacion'),
    honorariosPct: numv('honorariosPct'),
    plazoFacturaDias: numv('plazoFacturaDias'),
    gastosMateriales: val('gastosMateriales'),
    duracionMeses: numv('duracionMeses'),
    prorrogaMeses: numv('prorrogaMeses'),
    preavisoDias: numv('preavisoDias'),
    proteccionMeses: numv('proteccionMeses'),
    confidencialidadAnios: numv('confidencialidadAnios'),
    subsanacionDias: numv('subsanacionDias'),
    jurisdiccion: val('jurisdiccion'),
    lugarFirma: val('lugarFirma'),
    dia, mes, anio
  };
}

const REQUIRED = ['mandanteNif','mandanteRM','mandanteDomicilio','mandanteRepNombre','mandanteRepDni',
  'mandatarioNombre','mandatarioNif','precioMinimo'];

function b(v, fallback){
  if (v===null || v===undefined || v==='') return '<span class="blank">' + (fallback||'[·]') + '</span>';
  return v;
}
function bPlain(v, fallback){
  if (v===null || v===undefined || v==='') return fallback || '[·]';
  return v;
}

function buildBody(d, forWord){
  const B = forWord ? bPlain : b;
  const precioTxt = d.precioMinimo!==null ? fmtEUR(d.precioMinimo) : null;
  const precioLetras = d.precioMinimo!==null ? numeroEnLetras(d.precioMinimo) + ' EUROS' : null;
  const exclusivaTxt = d.exclusividad === 'exclusiva'
    ? 'con carácter exclusivo'
    : 'sin carácter exclusivo, pudiendo el Mandante encomendar la venta del Activo simultáneamente a otros intermediarios';
  const clausula44 = d.exclusividad === 'exclusiva'
    ? 'Durante la vigencia del Contrato, el Mandante se obliga a no encomendar la venta del Activo a ningún otro intermediario ni a negociarla directamente por sí mismo, salvo con compradores que acrediten haber contactado con el Mandante de forma espontánea y sin intervención del Mandatario, en cuyo caso no se devengarán honorarios. El incumplimiento de esta cláusula de exclusiva dará derecho al Mandatario a percibir, en concepto de indemnización, un importe equivalente a los honorarios que le hubieran correspondido conforme a la Cláusula Tercera.'
    : 'No aplica, al no haberse otorgado el presente mandato con carácter exclusivo.';

  return `
<h2 style="text-align:center">CONTRATO DE MANDATO DE VENTA</h2>
<p style="text-align:center">Promoción Villanueva de la Torre (Guadalajara)</p>
<p>En ${B(d.lugarFirma)}, a ${B(d.dia)} de ${B(d.mes)} de ${B(d.anio)}</p>

<h3>REUNIDOS</h3>
<p>DE UNA PARTE, <b>${B(d.mandanteNombre)}</b>, con NIF ${B(d.mandanteNif)}, domicilio social en ${B(d.mandanteDomicilio)}, inscrita en el Registro Mercantil de ${B(d.mandanteRM)}, representada en este acto por D./Dña. ${B(d.mandanteRepNombre)}, con DNI ${B(d.mandanteRepDni)}, en calidad de ${B(d.mandanteRepCargo)} (en adelante, "el Mandante").</p>
<p>DE OTRA PARTE, <b>${B(d.mandatarioNombre)}</b>, con NIF/CIF ${B(d.mandatarioNif)}, con domicilio en ${B(d.mandatarioDomicilio)} (en adelante, "el Mandatario").</p>
<p>Ambas partes se reconocen mutuamente la capacidad legal necesaria para la celebración del presente contrato de mandato de venta (en adelante, el "Contrato"), y a tal efecto</p>

<h3>EXPONEN</h3>
<p>I. Que el Mandante es propietario del activo inmobiliario descrito en la Cláusula Primera (el "Activo"), libre de cargas sobre el suelo, con licencia de obra y parte de la construcción ya ejecutada.</p>
<p>II. Que el Mandante está interesado en vender el Activo, o en dar entrada a un inversor en el mismo, y para ello desea encomendar la búsqueda de comprador o inversor al Mandatario.</p>
<p>III. Que el Mandatario cuenta con los medios y la red de contactos necesarios para desarrollar esa labor de intermediación.</p>
<p>En su virtud, las partes acuerdan suscribir el presente Contrato con arreglo a las siguientes</p>

<h3>CLÁUSULAS</h3>

<h3>CLÁUSULA PRIMERA.- Objeto del contrato</h3>
<p>1.1. El Mandante encomienda al Mandatario, que lo acepta, la gestión de venta del siguiente activo (el "Activo"):</p>
<table>
<tr><td><b>Ubicación</b></td><td>Calle Brasil, 91 — Villanueva de la Torre (Guadalajara), Corredor del Henares</td></tr>
<tr><td><b>Referencia catastral</b></td><td>${B(d.refCatastral,'Pendiente de facilitar por el Mandante')}</td></tr>
<tr><td><b>Descripción</b></td><td>Parcela edificable con licencia de obra y ejecución avanzada, para 82 viviendas (ampliables hasta 85 post-licencia) en 4 edificios, garaje y trasteros, locales, pista de pádel y piscina</td></tr>
<tr><td><b>Superficie sobre rasante</b></td><td>6.545,10 m² (4 edificios)</td></tr>
<tr><td><b>Superficie bajo rasante</b></td><td>3.476,90 m² (garaje y trasteros)</td></tr>
<tr><td><b>Estado de ejecución</b></td><td>Bajo rasante al 94%; Bloque 1 al 65-70%; Bloque 2 al 10%; Bloques 3 y 4 con licencia, sin ejecutar</td></tr>
<tr><td><b>Cargas</b></td><td>Suelo pagado al 100%, sin créditos ni hipotecas (según manifestación del Mandante)</td></tr>
<tr><td><b>Licencias</b></td><td>Pagadas para el proyecto actual; modificado en trámite para adecuación a Código Técnico</td></tr>
</table>
<p>1.2. El mandato comprende, salvo pacto distinto por escrito entre las partes: (a) la búsqueda activa de comprador o inversor para el Activo, ya sea mediante compraventa directa, entrada en el capital de la sociedad titular, o cualquier otra estructura que acuerden las partes; (b) la elaboración y presentación de documentación comercial y financiera del Activo a los potenciales interesados; (c) la negociación de las condiciones económicas con los interesados, dentro de los límites fijados en la Cláusula Segunda; (d) el acompañamiento hasta la firma del contrato de arras o de compraventa, sin perjuicio de que la firma de la operación corresponda siempre al Mandante.</p>
<p>1.3. El presente mandato se otorga ${exclusivaTxt}.</p>

<h3>CLÁUSULA SEGUNDA.- Precio y condiciones de venta</h3>
<p>2.1. El Mandante fija como precio mínimo autorizado de venta del Activo la cantidad de ${precioTxt ? B(precioTxt) : B(null)} (${precioLetras ? B(precioLetras) : B(null)}), más los impuestos que en su caso correspondan.</p>
<p>2.2. El Mandatario queda facultado para negociar con los interesados dentro de un margen de hasta el ${B(d.margenNegociacion!==null?d.margenNegociacion+'%':null)} por debajo del precio mínimo autorizado, debiendo en todo caso trasladar al Mandante cualquier oferta recibida, al margen de su cuantía, para que este decida si la acepta. Ninguna oferta vincula al Mandante hasta su aceptación expresa y por escrito.</p>
<p>2.3. La forma de pago (al contado, aplazado, con subrogación de financiación u otra) se determinará en cada oferta concreta y, en todo caso, requerirá la aprobación expresa del Mandante.</p>
<p>2.4. Queda expresamente excluida de este mandato cualquier estructura que suponga la cesión de la gestión o del control de la promoción sin la previa conformidad por escrito del Mandante.</p>

<h3>CLÁUSULA TERCERA.- Honorarios del Mandatario</h3>
<p>3.1. En concepto de honorarios por la gestión de intermediación objeto de este Contrato, el Mandatario percibirá una comisión equivalente al ${B(d.honorariosPct!==null?d.honorariosPct+'%':null)} sobre el precio final de venta efectivamente cobrado por el Mandante, más el IVA legalmente aplicable.</p>
<p>3.2. Los honorarios se devengarán y serán exigibles en el momento de la firma del contrato de arras, señal o documento equivalente por el que el Mandante y el comprador/inversor queden vinculados, con independencia de que la escritura pública se otorgue en un momento posterior. Si la operación se articula en varias fases o tramos, los honorarios se devengarán proporcionalmente sobre el importe de cada tramo a medida que se formalice.</p>
<p>3.3. El Mandatario emitirá la correspondiente factura, que el Mandante abonará en el plazo de ${B(d.plazoFacturaDias!==null?d.plazoFacturaDias+' días':null)} naturales desde su recepción.</p>
<p>3.4. Los honorarios solo serán debidos si la operación se formaliza durante la vigencia del Contrato o dentro del plazo de protección señalado en la Cláusula Cuarta, apartado 4.3, y siempre que el comprador o inversor haya sido efectivamente presentado o gestionado por el Mandatario.</p>
<p>3.5. Los gastos de elaboración de materiales comerciales (dosier, modelo financiero, presentaciones) correrán por cuenta del ${B(d.gastosMateriales)}; cualquier gasto extraordinario requerirá autorización previa y expresa del Mandante.</p>

<h3>CLÁUSULA CUARTA.- Duración y exclusividad</h3>
<p>4.1. El presente Contrato entrará en vigor en la fecha de su firma y tendrá una duración de ${B(d.duracionMeses!==null?d.duracionMeses+' meses':null)}.</p>
<p>4.2. Transcurrido dicho plazo, el Contrato se prorrogará tácitamente por periodos sucesivos de ${B(d.prorrogaMeses!==null?d.prorrogaMeses+' meses':null)}, salvo que cualquiera de las partes comunique a la otra su voluntad de no prorrogarlo con una antelación mínima de ${B(d.preavisoDias!==null?d.preavisoDias+' días':null)} a la fecha de vencimiento.</p>
<p>4.3. Cláusula de protección. Si dentro de los ${B(d.proteccionMeses!==null?d.proteccionMeses+' meses':null)} siguientes a la finalización o resolución del Contrato el Mandante formaliza la venta del Activo con un comprador o inversor que le haya sido presentado por el Mandatario durante su vigencia, este conservará su derecho a los honorarios pactados en la Cláusula Tercera, siempre que el Mandatario haya comunicado por escrito al Mandante, antes de la finalización del Contrato, la identidad de dicho interesado.</p>
<p>4.4. ${clausula44}</p>

<h3>CLÁUSULA QUINTA.- Obligaciones de las partes</h3>
<p><b>5.1. Obligaciones del Mandante:</b> facilitar al Mandatario la documentación necesaria para la venta (nota simple registral, licencia de obra, proyecto técnico, certificado de eficiencia energética cuando proceda); comunicar cualquier dato relevante que afecte al Activo; facilitar el acceso a la obra para visitas de interesados; abonar los honorarios pactados en los plazos establecidos; responder con diligencia a las ofertas trasladadas por el Mandatario.</p>
<p><b>5.2. Obligaciones del Mandatario:</b> desarrollar con diligencia profesional la búsqueda de comprador o inversor; trasladar al Mandante todas las ofertas recibidas, con independencia de su cuantía; no comprometer al Mandante frente a terceros sin su autorización expresa y por escrito; guardar confidencialidad sobre la información recibida conforme a la Cláusula Sexta; llevar un registro de los interesados contactados a disposición del Mandante.</p>

<h3>CLÁUSULA SEXTA.- Confidencialidad y protección de datos</h3>
<p>6.1. El Mandatario se compromete a tratar como confidencial toda la documentación e información que reciba del Mandante (dosier, estudio de mercado, modelo financiero, planos, licencias), y a no divulgarla a terceros salvo a los potenciales compradores o inversores, y únicamente en la medida necesaria para el desarrollo del encargo. Esta obligación se mantendrá durante la vigencia del Contrato y los ${B(d.confidencialidadAnios!==null?d.confidencialidadAnios+' años':null)} siguientes a su finalización.</p>
<p>6.2. El Mandatario podrá exigir a los interesados la firma de un acuerdo de confidencialidad (NDA) con carácter previo a la entrega de información sensible del Activo.</p>
<p>6.3. Ambas partes se comprometen a tratar los datos personales que se intercambien conforme al Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018, de Protección de Datos Personales y garantía de los derechos digitales, utilizándolos exclusivamente para los fines propios de este Contrato.</p>

<h3>CLÁUSULA SÉPTIMA.- Resolución</h3>
<p>7.1. El Contrato podrá resolverse anticipadamente por mutuo acuerdo, o por incumplimiento grave de cualquiera de las partes de sus obligaciones, previo requerimiento fehaciente concediendo un plazo de ${B(d.subsanacionDias!==null?d.subsanacionDias+' días':null)} para subsanarlo. La resolución no afectará al derecho de honorarios ya devengado conforme a la Cláusula Tercera, ni a la cláusula de protección de la Cláusula Cuarta, apartado 4.3.</p>
<p>7.2. Este Contrato tiene naturaleza mercantil de mediación o corretaje, y no genera relación laboral, societaria ni de representación orgánica entre las partes. El Mandatario actúa en todo momento como profesional independiente.</p>

<h3>CLÁUSULA OCTAVA.- Ley aplicable y jurisdicción</h3>
<p>8.1. El presente Contrato se rige por la legislación española. Para cuantas cuestiones litigiosas pudieran derivarse de su interpretación o cumplimiento, las partes se someten, con renuncia expresa a cualquier otro fuero que pudiera corresponderles, a los Juzgados y Tribunales de ${B(d.jurisdiccion)}.</p>
<p>8.2. Las partes declaran haber leído y entendido el contenido íntegro de este Contrato, y en prueba de conformidad lo firman por duplicado y a un solo efecto, en el lugar y fecha indicados.</p>

<table style="border:none;margin-top:28pt">
<tr>
<td style="border:none;width:50%;vertical-align:top;padding-left:0"><b>EL MANDANTE</b><br>${B(d.mandanteNombre)}<br><br>Fdo.: ${B(d.mandanteRepNombre)}</td>
<td style="border:none;width:50%;vertical-align:top"><b>EL MANDATARIO</b><br>${B(d.mandatarioNombre)}<br><br>Fdo.: _______________</td>
</tr>
</table>
`;
}

function markMissing(){
  let missing = [];
  REQUIRED.forEach(id=>{
    const el = document.getElementById(id);
    const empty = !el.value || !el.value.trim();
    el.classList.toggle('err', empty);
    if (empty) missing.push(id);
  });
  return missing;
}

function render(){
  const d = getData();
  document.getElementById('preview').innerHTML = buildBody(d, false);
  const missing = REQUIRED.filter(id=>{const el=document.getElementById(id); return !el.value || !el.value.trim();});
  const msg = document.getElementById('missingMsg');
  if (missing.length>0){
    msg.textContent = missing.length + ' campo(s) obligatorio(s) por rellenar.';
    msg.classList.add('missing');
  } else {
    msg.textContent = 'Todos los campos obligatorios están completos.';
    msg.classList.remove('missing');
  }
}

document.getElementById('form').addEventListener('input', render);
document.getElementById('form').addEventListener('change', render);

document.getElementById('downloadBtn').addEventListener('click', function(){
  const missing = markMissing();
  if (missing.length>0){
    document.getElementById('formScroll').scrollTo({top:0, behavior:'smooth'});
    const first = document.getElementById(missing[0]);
    first.scrollIntoView({behavior:'smooth', block:'center'});
    first.focus();
    return;
  }
  const d = getData();
  const bodyHtml = buildBody(d, true);
  const doc = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->
<style>
@page{size:21cm 29.7cm;margin:2.5cm}
body{font-family:'Times New Roman',serif;font-size:12pt;line-height:1.5;color:#000}
h2{font-size:14pt;font-weight:bold;text-align:center;margin:0 0 4pt}
h3{font-size:12pt;font-weight:bold;margin:14pt 0 6pt}
p{margin:0 0 8pt;text-align:justify}
p.center,.center{text-align:center}
table{border-collapse:collapse;width:100%;margin:8pt 0}
td{border:1px solid #999;padding:5pt 8pt;vertical-align:top;font-size:10.5pt}
</style></head>
<body>${bodyHtml}
</body></html>`;
  const blob = new Blob(['\ufeff', doc], {type:'application/msword'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Mandato_Venta_Villanueva_de_la_Torre.doc';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
});

render();
