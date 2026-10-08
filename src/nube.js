// ============================================================
//  nube.js — Google Drive y OneDrive de cada usuaria
//  - Ver carpetas: con el enlace que pega la usuaria (sin claves).
//  - Guardar directamente: con su cuenta de Google o Microsoft
//    (inicio de sesión oficial; el permiso vive solo en memoria).
// ============================================================
import { PublicClientApplication } from "@azure/msal-browser";
import { GOOGLE_CLIENT_ID, MICROSOFT_CLIENT_ID } from "./config.js";
import { local } from "./almacen.js";

export const NUBES = {
  google: { nombre: "Google Drive", corto: "Drive" },
  onedrive: { nombre: "OneDrive", corto: "OneDrive" },
};

export function puedeGuardarDirecto(nube) {
  return nube === "google" ? !!GOOGLE_CLIENT_ID : !!MICROSOFT_CLIENT_ID;
}

// --- Ver la carpeta dentro de la app ---------------------------
// Devuelve la dirección para mostrar la carpeta incrustada, o null.
export function enlaceIncrustable(enlace) {
  if (!enlace) return null;
  const txt = enlace.trim();
  // Código <iframe ...> pegado desde OneDrive → "Insertar"
  const src = txt.match(/src=["']([^"']+)["']/i);
  if (src) return src[1];
  // Google Drive: carpeta → vista incrustada
  const g = txt.match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([\w-]+)/);
  if (g) return `https://drive.google.com/embeddedfolderview?id=${g[1]}#list`;
  // OneDrive personal: enlace de inserción
  if (/onedrive\.live\.com\/embed/i.test(txt)) return txt;
  return null;
}

export function enlaceAbrir(enlace) {
  if (!enlace) return null;
  const src = enlace.match(/src=["']([^"']+)["']/i);
  return (src ? src[1] : enlace).trim();
}

// --- Google Drive -----------------------------------------------
let tokenGoogle = null;     // solo en memoria
let clienteGoogle = null;

function pedirTokenGoogle() {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) return reject(new Error("No se ha podido cargar el acceso de Google. Recarga la página."));
    if (!clienteGoogle) {
      clienteGoogle = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: "https://www.googleapis.com/auth/drive.file",
        callback: () => {},
      });
    }
    clienteGoogle.callback = (r) => {
      if (r.error) return reject(new Error("No has dado permiso a Google Drive."));
      tokenGoogle = r.access_token;
      resolve(tokenGoogle);
    };
    clienteGoogle.requestAccessToken({ prompt: tokenGoogle ? "" : "consent" });
  });
}

async function carpetaGoogle(token, nombreCarpeta) {
  const guardada = local.get("md-gdrive-carpeta");
  if (guardada) {
    const r = await fetch(`https://www.googleapis.com/drive/v3/files/${guardada}?fields=id,trashed`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok && !(await r.json()).trashed) return guardada;
  }
  const r = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: nombreCarpeta, mimeType: "application/vnd.google-apps.folder" }),
  });
  if (!r.ok) throw new Error("No se pudo crear la carpeta en Drive.");
  const id = (await r.json()).id;
  local.set("md-gdrive-carpeta", id);
  return id;
}

async function guardarEnGoogle(blob, nombre, nombreCarpeta) {
  const token = await pedirTokenGoogle();
  const carpeta = await carpetaGoogle(token, nombreCarpeta);
  const meta = { name: nombre, parents: [carpeta] };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" }));
  form.append("file", blob);
  const r = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!r.ok) throw new Error("Google Drive no ha aceptado el archivo.");
  return (await r.json()).webViewLink;
}

// --- OneDrive (Microsoft) ---------------------------------------
let msal = null;
let msalListo = null;
if (MICROSOFT_CLIENT_ID) {
  msal = new PublicClientApplication({
    auth: { clientId: MICROSOFT_CLIENT_ID, authority: "https://login.microsoftonline.com/common", redirectUri: window.location.origin },
    cache: { cacheLocation: "sessionStorage" },
  });
  msalListo = msal.initialize();
}
const ALCANCE_MS = ["Files.ReadWrite"];

async function tokenMicrosoft() {
  await msalListo;
  let cuenta = msal.getAllAccounts()[0];
  if (!cuenta) {
    const r = await msal.loginPopup({ scopes: ALCANCE_MS });
    cuenta = r.account;
  }
  try {
    return (await msal.acquireTokenSilent({ scopes: ALCANCE_MS, account: cuenta })).accessToken;
  } catch {
    return (await msal.acquireTokenPopup({ scopes: ALCANCE_MS, account: cuenta })).accessToken;
  }
}

async function guardarEnOneDrive(blob, nombre, nombreCarpeta) {
  const token = await tokenMicrosoft();
  const ruta = `${encodeURIComponent(nombreCarpeta)}/${encodeURIComponent(nombre)}`;
  const r = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${ruta}:/content?@microsoft.graph.conflictBehavior=rename`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": blob.type || "application/octet-stream" },
    body: blob,
  });
  if (!r.ok) throw new Error("OneDrive no ha aceptado el archivo.");
  return (await r.json()).webUrl;
}

// --- Función común ----------------------------------------------
export async function guardarEnNube(nube, blob, nombre, nombreCarpeta = "Mi Despacho - Contratos") {
  if (!puedeGuardarDirecto(nube)) throw { code: "sin_configurar" };
  return nube === "google"
    ? guardarEnGoogle(blob, nombre, nombreCarpeta)
    : guardarEnOneDrive(blob, nombre, nombreCarpeta);
}

export function descargar(blob, nombre) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
