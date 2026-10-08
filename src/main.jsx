import "./lib/espacio.js"; // primero: aísla los datos de cada usuario y empresa
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./estilos.css";

createRoot(document.getElementById("root")).render(<App />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then((r) => r.update()).catch(() => {}));
}
