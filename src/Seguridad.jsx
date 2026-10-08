// Seguridad, protección de datos e IA: documento para la usuaria y para el departamento de cumplimiento.
import "./documento.css";

const FECHA = "8 de octubre de 2026";

export default function Seguridad({ config }) {
  const empresa = config?.empresa?.razon_social || config?.nombre || "la empresa";
  return (
    <div className="app pagina-doc">
      <header className="app-cab no-imprimir">
        <div><div className="eyebrow">Ajustes</div><h1>Seguridad, datos e IA</h1>
          <p className="muted">Cómo protege Mi Despacho la información, qué normas cumple y qué tiene que hacer cada parte. Puedes imprimirlo o guardarlo en PDF para tu departamento de cumplimiento.</p></div>
        <div className="acciones"><button className="btn" type="button" onClick={() => window.print()}>Imprimir / guardar en PDF</button></div>
      </header>

      <article className="doc">
        <h1 className="solo-imprimir">Mi Despacho — Seguridad, protección de datos e inteligencia artificial</h1>
        <p className="doc-meta">Versión 1.0 · {FECHA} · Ficha informativa para {empresa}</p>

        <h2>1. Resumen</h2>
        <ul>
          <li><strong>Los documentos no salen del ordenador de la empresa.</strong> Facturas, escrituras y contratos se leen y se guardan directamente en la carpeta de OneDrive / Google Drive de la empresa, desde el navegador. Mi Despacho no tiene copia.</li>
          <li><strong>En la nube solo están las cuentas de usuario</strong> (nombre, correo, rol, empresas a las que accede) y el registro de actividad, en servidores de la Unión Europea (París).</li>
          <li><strong>Doble factor obligatorio</strong> para todos los usuarios y aislamiento por empresa aplicado en la propia base de datos.</li>
          <li><strong>La IA trabaja en el ordenador de la usuaria</strong> (modelo local); la nube solo se usa si se activa expresamente. Todo lo que propone la IA se marca y lo revisa una persona.</li>
        </ul>

        <h2>2. Dónde está cada dato</h2>
        <table>
          <thead><tr><th>Dato</th><th>Dónde se guarda</th><th>Quién puede verlo</th></tr></thead>
          <tbody>
            <tr><td>Documentos (facturas, escrituras, contratos, extractos)</td><td>Carpeta de la empresa en su OneDrive / Google Drive, sincronizada en su ordenador</td><td>Las personas con quien la empresa comparta la carpeta (p. ej., su gestoría)</td></tr>
            <tr><td>Datos contables (lecturas de facturas, correcciones, asientos)</td><td>Archivos dentro de la misma carpeta (subcarpeta «programa»)</td><td>Igual que los documentos</td></tr>
            <tr><td>Configuración (logo, colores, plantillas, calendario)</td><td>Navegador de cada usuario, separada por usuario y por empresa</td><td>Solo ese usuario en ese navegador</td></tr>
            <tr><td>Cuentas de usuario y accesos a empresas</td><td>Supabase (base de datos exclusiva de Mi Despacho), región UE – París</td><td>Cada usuario, sus propios datos; la administradora, todos</td></tr>
            <tr><td>Claves de acceso</td><td>Supabase Auth, cifradas con bcrypt</td><td>Nadie (ni la administradora)</td></tr>
            <tr><td>Registro de actividad (entradas, altas, autorizaciones)</td><td>Supabase, UE</td><td>La administradora. No se puede modificar ni borrar</td></tr>
          </tbody>
        </table>

        <h2>3. Medidas de seguridad aplicadas</h2>
        <h3>3.1 Identificación y acceso</h3>
        <ul>
          <li>Nadie puede darse de alta por su cuenta: la administradora autoriza cada solicitud y entrega un código de un solo uso (guardado solo como hash, caduca en 7 días, se bloquea tras 5 intentos). La base de datos rechaza cualquier alta que no venga de ese proceso.</li>
          <li>Clave de al menos 12 caracteres con letras y números.</li>
          <li>Doble factor obligatorio (código TOTP de una app de autenticación). Sin él, la base de datos no devuelve ningún dato (nivel de garantía AAL2 exigido en las reglas de acceso).</li>
          <li>La administradora puede bloquear a un usuario o quitarle el acceso a una empresa al instante.</li>
        </ul>
        <h3>3.2 Aislamiento entre empresas (multiempresa)</h3>
        <ul>
          <li>Cada usuario solo ve las empresas que tiene asignadas; la regla se aplica en la base de datos (Row Level Security), no solo en la pantalla.</li>
          <li>En el navegador, todo lo guardado se separa por usuario y empresa: si en el mismo ordenador entra otra persona u otra empresa, no ve nada de la anterior.</li>
          <li>Cada empresa trabaja sobre su propia carpeta.</li>
        </ul>
        <h3>3.3 Infraestructura</h3>
        <ul>
          <li><strong>Supabase</strong> (base de datos y autenticación): proyecto exclusivo, región UE (París); cifrado en tránsito (TLS) y en reposo; acceso anónimo revocado en todas las tablas; funciones de administración que comprueban el rol y el doble factor; revisión periódica con el asesor de seguridad de Supabase.</li>
          <li><strong>Vercel</strong> (servicio de la web): solo sirve la aplicación; no almacena datos de usuarios ni documentos. Cabeceras de seguridad: HTTPS obligatorio (HSTS), política de seguridad de contenidos (CSP) que limita a qué servidores puede conectarse la app, prohibición de incrustar la app en otras webs, sin rastreadores ni cookies de terceros.</li>
          <li><strong>Código</strong> en GitHub; cada cambio queda registrado y se publica automáticamente.</li>
        </ul>
        <h3>3.4 Registro y trazabilidad</h3>
        <ul>
          <li>Se registran entradas, solicitudes, autorizaciones, cambios de estado y de empresas. El registro no se puede modificar ni borrar.</li>
          <li>Los envíos a la gestoría quedan anotados en la carpeta de la empresa, indicando si había contrato de encargo firmado.</li>
          <li>Los contratos firmados en la app llevan huella SHA-256 y hoja de evidencias.</li>
        </ul>

        <h2>4. Protección de datos (RGPD y LOPDGDD)</h2>
        <ul>
          <li><strong>Roles:</strong> cada empresa es responsable de los datos de sus clientes, proveedores y empleados. La gestoría que trabaja sus documentos es encargada del tratamiento (art. 28 RGPD): Mi Despacho avisa antes de enviarle nada si no consta firmado el contrato de encargo, y permite firmarlo dentro de la app.</li>
          <li><strong>Titular de la plataforma:</strong> respecto de los datos de las cuentas de usuario, el titular de Mi Despacho actúa como responsable; respecto de los datos de las empresas que pasan por la app, como encargado.</li>
          <li><strong>Subencargados:</strong> Supabase (UE), Vercel (servicio de la web, sin datos personales de clientes), GitHub (código, sin datos personales) y Microsoft / Google, que son los proveedores de almacenamiento de la propia empresa.</li>
          <li><strong>Minimización:</strong> en la nube solo se guarda lo imprescindible para identificar a los usuarios.</li>
          <li><strong>Conservación:</strong> documentos contables, 6 años (art. 30 Código de Comercio); datos de usuarios, mientras tengan acceso y el plazo de responsabilidades; registro de actividad, mínimo 2 años.</li>
          <li><strong>Derechos:</strong> acceso, rectificación, supresión, oposición, limitación y portabilidad, ante la administradora de Mi Despacho o ante cada empresa respecto de sus datos.</li>
          <li><strong>Brechas:</strong> notificación al responsable sin dilación y, en su caso, a la AEPD en 72 horas.</li>
          <li><strong>Navegador:</strong> solo se usa almacenamiento técnico necesario para que funcione la app (sin cookies de publicidad ni analítica).</li>
        </ul>

        <h2>5. Inteligencia artificial (Reglamento (UE) 2024/1689)</h2>
        <ul>
          <li><strong>Uso:</strong> leer facturas y proponer sus datos y su cuenta contable, revisar borradores de contratos y resumir cambios del Plan General Contable. No toma decisiones sobre personas.</li>
          <li><strong>Clasificación:</strong> no es un sistema de alto riesgo (no está en los supuestos del anexo III). La IA no se usa con fines prohibidos (art. 5).</li>
          <li><strong>Dónde trabaja:</strong> por defecto, un modelo abierto que se ejecuta en el ordenador de la usuaria; los datos no salen de él. Los servicios de IA en la nube solo se usan si la usuaria lo activa en Ajustes, con sus propias claves, y la app avisa de que no se usen con datos reales en planes gratuitos.</li>
          <li><strong>Supervisión humana:</strong> todo lo propuesto por la IA se marca como tal y una persona lo revisa antes de enviarlo o contabilizarlo; los contratos no los redacta la IA.</li>
          <li><strong>Transparencia:</strong> la app indica siempre qué IA ha respondido.</li>
          <li><strong>Alfabetización (art. 4):</strong> cada empresa debe asegurarse de que las personas que usan la app saben qué hace la IA y sus límites. Esta ficha sirve como material básico.</li>
          <li><strong>No entrenamiento:</strong> los datos de las empresas no se usan para entrenar modelos.</li>
        </ul>

        <h2>6. Qué tiene que hacer cada parte</h2>
        <h3>La administradora de Mi Despacho</h3>
        <ul className="checklist">
          <li>Supabase → Authentication → Sign In / Providers: desactivar «Allow new users to sign up» (las altas ya se hacen solo con código).</li>
          <li>Supabase → Authentication: longitud mínima de clave 12 y, si el plan lo permite, protección contra claves filtradas.</li>
          <li>Activar el doble factor en las cuentas de Supabase, Vercel y GitHub.</li>
          <li>Firmar los acuerdos de tratamiento (DPA) de Supabase y Vercel desde sus paneles.</li>
          <li>Revisar cada mes el registro de actividad y las solicitudes de acceso.</li>
          <li>Valorar el plan de pago de Supabase para tener copias de seguridad diarias con recuperación.</li>
        </ul>
        <h3>Cada empresa</h3>
        <ul className="checklist">
          <li>Firmar el contrato de encargo del tratamiento con su gestoría.</li>
          <li>Compartir con la gestoría solo la carpeta de contabilidad, con «Personas específicas» (nunca «Cualquier persona con el vínculo»).</li>
          <li>Usar una cuenta de OneDrive / Google de la empresa, con doble factor.</li>
          <li>Revisar lo que propone la IA antes de enviarlo a la gestoría.</li>
        </ul>

        <p className="doc-pie">Documento informativo. No sustituye al análisis de riesgos ni al registro de actividades de tratamiento de cada empresa.</p>
      </article>
    </div>
  );
}
