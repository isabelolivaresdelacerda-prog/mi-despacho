// ============================================================
//  Configuración de Mi Despacho (la rellena BITI una sola vez)
//  Para guardar contratos DIRECTAMENTE en la nube de cada usuaria,
//  la app necesita estar registrada en Google y en Microsoft.
//  Mientras estén vacíos, la app sigue funcionando: descarga el Word
//  y abre la carpeta de la usuaria para que lo arrastre ella.
// ============================================================

// Google Cloud Console → Credenciales → ID de cliente OAuth (Aplicación web)
// Orígenes autorizados: https://mi-despacho-nine.vercel.app (y http://localhost:5173 para pruebas)
export const GOOGLE_CLIENT_ID = "";

// Azure Portal → Registros de aplicaciones → Id. de aplicación (cliente)
// Plataforma "Aplicación de página única (SPA)" con URI de redirección = https://mi-despacho-nine.vercel.app
export const MICROSOFT_CLIENT_ID = "";
