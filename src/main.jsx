import "./lib/espacio.js"; // primero: aísla los datos de cada usuario y empresa
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./estilos.css";

createRoot(document.getElementById("root")).render(<App />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then((r) => r.update()).catch(() => {}));
}

// Si el navegador tiene guardada una versión antigua, se borra y se carga la última publicada
async function comprobarVersion() {
  try {
    const r = await fetch("/version.json", { cache: "no-store" });
    if (!r.ok) return;
    const { version } = await r.json();
    if (!version || version === __VERSION__) return;
    if (sessionStorage.getItem("md-recarga") === version) return; // evita bucles
    sessionStorage.setItem("md-recarga", version);
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) || [];
    await Promise.all(regs.map((x) => x.unregister()));
    if (window.caches) await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
    location.reload();
  } catch { /* sin conexión: se sigue con la versión que hay */ }
}
comprobarVersion();
setInterval(comprobarVersion, 10 * 60 * 1000);
