# Mi Despacho — resumen de lo decidido

_Actualizado: 8 de octubre de 2026_

## Qué es

Mi Despacho es una app de bitini labs para **gestorías y empresas**. Cada cuenta pone su nombre, su logo y sus colores, y ve en un menú lateral las apps que tiene contratadas (de momento, todas).

- Dirección: https://mi-despacho-nine.vercel.app (proyecto `mi-despacho` en Vercel).
- Ahora mismo Vercel la protege: solo la ve quien entra con la cuenta de Vercel de BITI.
- Código: React + Vite. Repositorio de GitHub `mi-despacho` pendiente de crear; cuando exista, cada cambio se publicará solo en Vercel.

## Apps que incluye

### Contabilidad
- **Mi contabilidad:** abre dentro de Mi Despacho la app de contabilidad de la usuaria (por ejemplo, la app Flask que funciona en su ordenador, normalmente `http://127.0.0.1:5000`). Tiene que estar abierta en ese ordenador.
- **Mi carpeta:** su carpeta de contabilidad de OneDrive o Google Drive.

### Contratos
- **Crear → Contrato de cuentas en participación** (arts. 239 a 243 del Código de Comercio).
  - **No lo escribe la IA.** Es una plantilla jurídica fija que se rellena con los datos del formulario. La app lo dice expresamente.
  - **Modificar cláusulas:** cambiar, quitar o añadir cláusulas. Los cambios se guardan y se usan en los contratos siguientes. Una cláusula cambiada queda fija (ya no se rellena sola); el botón «Original» la recupera.
  - **Crear contrato** genera un Word y pregunta automáticamente: **«¿Quieres guardar el contrato en tu Drive / OneDrive?»**.
  - **Revisar con IA:** la IA solo revisa y señala riesgos; no cambia nada.
- **Mi carpeta de contratos:** su carpeta de la nube, vista dentro de la app.

## Documentos: Google Drive y OneDrive

- Cada cuenta elige **Google Drive u OneDrive** y pega el enlace de **Compartir** de cada carpeta (contratos y contabilidad).
- **Al compartir, siempre «Solo las personas añadidas» / «Restringido»**, nunca «Cualquiera con el enlace».
- Google Drive se ve dentro de la app. OneDrive personal también, con el código de **Insertar**. OneDrive de empresa se abre en otra pestaña.
- **Guardar contratos:** ahora descarga el Word y abre la carpeta para arrastrarlo. Para que lo suba la app sola, hay que registrar Mi Despacho una vez en Google Cloud y en Microsoft (Azure) y poner los dos identificadores en `src/config.js`.

## Inteligencia artificial

### Decisión principal: la IA trabaja en el ordenador
- Por **protección de datos**, la IA trabaja **solo en el ordenador** de quien la usa. Los contratos no salen de él.
- **Sin Ollama.** Se instala con PowerShell **llama.cpp** (programa pequeño, sin servicios de fondo y sin nada que arranque con Windows) y el modelo **Gemma 4** (pequeño o mediano según la memoria del ordenador).
- La app ofrece el instalador: **`instalar-ia-local.bat`** (doble clic). Deja en el escritorio **«IA local de Mi Despacho»**:
  - Se abre la ventana → la IA está encendida.
  - Se cierra la ventana → la IA se apaga y libera toda la memoria.
- **No hace falta ninguna clave** con la IA local: ni la del cliente ni la de la gestoría.
- Si el navegador pregunta por la red local, hay que pulsar «Permitir».

### Opción de nube (desactivada por defecto)
- En Ajustes se puede permitir la nube **solo si la IA local no está**. La app avisa de que no se use con datos reales: en los planes gratuitos el proveedor puede usar el texto.
- Orden en la nube: Gemma 4 → Gemini Flash → gpt-oss → Llama → OpenRouter (gratis) y, solo al final y **siempre preguntando antes**, Claude (de pago).
- Las claves serían **las del cliente**, no las de la gestoría ni las de BITI. Hoy se guardan en el navegador; cuando haya cuentas de usuario, se guardarán en la cuenta del cliente.

### Para uso personal de BITI (fuera de la app)
- `ia.ps1`: comando `ia "pregunta"` en PowerShell con la misma pirámide en la nube y Claude preguntando antes.
- `ia.py`: la misma pirámide para apps en Python.

### Descartado
- **Ollama:** consume demasiada memoria a juicio de BITI.
- **Un motor de IA central con las claves de BITI:** cada cliente usa lo suyo.
- **Copilot de Microsoft 365:** no tiene una clave de API que se pueda usar desde las apps.

## Gestoría y cliente

- La gestoría trabaja **directamente en el OneDrive del cliente** (carpeta compartida con permisos).
- La IA no puede trabajar con todos los ordenadores apagados. Solución: **la hace el ordenador de la gestoría.**
  1. El cliente comparte la carpeta de OneDrive con la gestoría.
  2. La gestoría pulsa «Agregar acceso directo a Mis archivos» para tenerla sincronizada en su ordenador.
  3. La gestoría instala la IA local con el mismo instalador.
  4. La IA trabaja en el ordenador de la gestoría sobre los archivos del cliente; los cambios le llegan al cliente solos.
- **Solo un ordenador procesa cada cosa a la vez**, para que OneDrive no cree copias en conflicto.
- Sin ningún ordenador encendido haría falta un servidor de pago en la nube europea, con contrato de tratamiento de datos. Queda para más adelante.

## Instalar Mi Despacho como programa

Se puede instalar en el ordenador o el móvil desde Chrome o Edge (botón **Instalar** de la barra de direcciones). Queda con su icono, como un programa. No hace falta ningún .exe.

## Dónde se guarda cada cosa

Todo se guarda **en el navegador** de cada usuaria: imagen del despacho, enlaces de carpetas, cláusulas modificadas, modo de IA y claves (si las hubiera). Los documentos, en su Drive u OneDrive. Mi Despacho no tiene servidor ni copia de nada.

## Pendiente

1. Crear el repositorio `mi-despacho` en GitHub y conectarlo a Vercel.
2. Registrar la app en Google y Microsoft para guardar contratos en la nube con un clic.
3. Cuentas de usuario para que BITI decida qué apps tiene contratadas cada cliente, y para guardar en ellas las claves del cliente.
4. Decidir si se quita la protección de Vercel para que entren los clientes.
5. Más modelos de contrato en Contratos → Crear.

## Mapa de archivos

| Archivo | Qué hace |
|---|---|
| `src/App.jsx` | Menú lateral y pantallas |
| `src/Bienvenida.jsx` | Primera vez: gestoría o empresa, nombre, logo, colores y nube |
| `src/Ajustes.jsx` | Ajustes: imagen, carpetas, contabilidad, apps contratadas e IA |
| `src/apps/ContratoCEP.jsx` | Contrato de cuentas en participación y editor de cláusulas |
| `src/apps/Carpeta.jsx` | Ver la carpeta de Drive u OneDrive |
| `src/apps/Contabilidad.jsx` | Abrir la app de contabilidad |
| `src/comunes.jsx` | «¿Guardar en tu Drive?», estado de la IA local y Revisar con IA |
| `src/ia-navegador.js` | IA: primero en el ordenador; nube solo si se permite |
| `src/nube.js` | Ver y guardar en Google Drive y OneDrive |
| `src/config.js` | Identificadores de Google y Microsoft (vacíos por ahora) |
| `public/instalar-ia-local.bat` | Instalador de la IA local con PowerShell |
