// En la dirección nueva: trae una sola vez los datos que el navegador guardaba en la dirección antigua.
import { useEffect, useState } from "react";
const ANTIGUA = "https://mi-despacho-nine.vercel.app";
const HECHO = "migracion-hecha";

export default function TraerDatos() {
  const [ver, setVer] = useState(false);
  const [estado, setEstado] = useState("");
  useEffect(() => {
    if (location.origin === ANTIGUA) return;
    // Datos llegados en la dirección (cuando la ventana no puede enlazarse con la anterior)
    if (location.hash.startsWith("#md-migracion=")) {
      (async () => {
        try {
          const b64 = location.hash.slice(14).replace(/-/g, "+").replace(/_/g, "/");
          const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
          const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
          const txt = await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
          const { ls = {} } = JSON.parse(txt);
          let n = 0; for (const [k, v] of Object.entries(ls)) if (typeof v === "string" && !/md-sesion|^sb-/.test(k)) { try { Storage.prototype.setItem.call(localStorage, k, v); n++; } catch { /* nada */ } }
          localStorage.setItem(HECHO, new Date().toISOString());
          history.replaceState(null, "", location.pathname + "#/inicio");
          setVer(true); setEstado(`Listo: ${n} ajustes recuperados. Si tenías otra pestaña de Mi Despacho abierta, recárgala. La carpeta de la empresa tendrás que elegirla otra vez.`);
          setTimeout(() => location.reload(), 2500);
        } catch { setVer(true); setEstado("No se han podido leer los datos. Vuelve a intentarlo."); }
      })();
      return;
    }
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
      {estado && <p className="ok">{estado}</p>}{!/^Listo/.test(estado) && <div className="acciones">
        <button className="btn" type="button" onClick={() => { window.open(ANTIGUA + "/migrar.html?a=" + encodeURIComponent(location.origin), "md-migrar", "width=480,height=360"); setEstado("Abriendo la dirección antigua…"); }}>Traer mis datos</button>
        <label className="btn ghost">Cargar desde archivo<input type="file" accept=".json" hidden onChange={async (e) => {
          const f = e.target.files[0]; if (!f) return;
          try { const { ls = {} } = JSON.parse(await f.text()); let n = 0;
            for (const [k, v] of Object.entries(ls)) if (typeof v === "string" && !/md-sesion|^sb-/.test(k)) { Storage.prototype.setItem.call(localStorage, k, v); n++; }
            localStorage.setItem(HECHO, new Date().toISOString()); setEstado(`Listo: ${n} ajustes recuperados. Recargando… (la carpeta de la empresa tendrás que elegirla otra vez)`); setTimeout(() => location.reload(), 1500);
          } catch { setEstado("Ese archivo no es de Mi Despacho."); }
        }} /></label>
        <button className="btn ghost" type="button" onClick={() => { try { localStorage.setItem(HECHO, "no"); } catch { /* nada */ } setVer(false); }}>No hace falta</button>
      </div>}
    </div>
  );
}
