// En la dirección nueva: trae una sola vez los datos que el navegador guardaba en la dirección antigua.
import { useEffect, useState } from "react";
const ANTIGUA = "https://mi-despacho-nine.vercel.app";
const HECHO = "migracion-hecha";

export default function TraerDatos() {
  const [ver, setVer] = useState(false);
  const [estado, setEstado] = useState("");
  useEffect(() => {
    if (location.origin === ANTIGUA) return;
    let hecho = false; try { hecho = !!localStorage.getItem(HECHO); } catch { /* nada */ }
    if (!hecho) setVer(true);
    const recibir = async (ev) => {
      if (ev.origin !== ANTIGUA || ev.data?.tipo !== "md-migracion") return;
      const { ls = {}, idb = [] } = ev.data;
      let n = 0;
      for (const [k, v] of Object.entries(ls)) { if (typeof v === "string" && !/md-sesion|^sb-/.test(k)) { try { Storage.prototype.setItem.call(localStorage, k.startsWith("esp:") ? k : k, v); n++; } catch { /* sin espacio */ } } }
      for (const x of idb) {
        try {
          const db = await new Promise((ok, ko) => { const r = indexedDB.open(x.db, 1); r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(x.store)) r.result.createObjectStore(x.store); }; r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
          await new Promise((ok) => { const tx = db.transaction(x.store, "readwrite"); tx.objectStore(x.store).put(x.val, x.key); tx.oncomplete = ok; tx.onerror = ok; });
          db.close();
        } catch { /* esa carpeta se elegirá otra vez */ }
      }
      try { localStorage.setItem(HECHO, new Date().toISOString()); } catch { /* nada */ }
      setEstado(`Listo: ${n} ajustes recuperados. Recargando…`);
      setTimeout(() => location.reload(), 1200);
    };
    window.addEventListener("message", recibir);
    return () => window.removeEventListener("message", recibir);
  }, []);
  if (!ver) return null;
  return (
    <div className="traer-datos" role="dialog" aria-label="Traer datos de la dirección antigua">
      <p><strong>Mi Despacho ha cambiado de dirección.</strong> Tus ajustes (logo, colores, plantillas, calendario, carpeta de la empresa) siguen en la dirección antigua de este navegador. Tráelos con un clic; tus documentos no se mueven.</p>
      {estado ? <p className="ok">{estado}</p> : <div className="acciones">
        <button className="btn" type="button" onClick={() => { window.open(ANTIGUA + "/migrar.html", "md-migrar", "width=480,height=360"); setEstado("Abriendo la dirección antigua…"); }}>Traer mis datos</button>
        <button className="btn ghost" type="button" onClick={() => { try { localStorage.setItem(HECHO, "no"); } catch { /* nada */ } setVer(false); }}>No hace falta</button>
      </div>}
    </div>
  );
}
