// Se abre en la dirección antigua (mi-despacho-nine.vercel.app) y envía los datos guardados en este navegador
// a la dirección nueva (midespacho.vercel.app), que es quien la ha abierto. No envía la sesión ni claves de acceso.
(async function () {
  const PERMITIDOS = ["https://midespacho.vercel.app", "https://midespacho.beatrizinversiones.com"];
  const pedido = new URLSearchParams(location.search).get("a");
  const DESTINO = PERMITIDOS.includes(pedido) ? pedido : PERMITIDOS[0];
  const msg = (t) => { document.getElementById("estado").textContent = t; };
  const ls = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (/md-sesion|^sb-|supabase/i.test(k)) continue;
    ls[k] = localStorage.getItem(k);
  }
  const idb = [];
  try {
    const dbs = indexedDB.databases ? await indexedDB.databases() : [];
    for (const d of dbs) {
      if (!d.name || !/^md-/.test(d.name)) continue;
      const db = await new Promise((ok, ko) => { const r = indexedDB.open(d.name); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
      for (const st of db.objectStoreNames) {
        const tx = db.transaction(st, "readonly").objectStore(st);
        const [keys, vals] = await Promise.all([new Promise((ok) => { const q = tx.getAllKeys(); q.onsuccess = () => ok(q.result); }), new Promise((ok) => { const q = tx.getAll(); q.onsuccess = () => ok(q.result); })]);
        keys.forEach((k, i) => idb.push({ db: d.name, store: st, key: k, val: vals[i] }));
      }
      db.close();
    }
  } catch (e) { /* sin carpetas guardadas */ }
  // 1) Si la ventana de Mi Despacho sigue enlazada, se le mandan los datos directamente
  if (window.opener) {
    const enviar = (conCarpetas) => window.opener.postMessage({ tipo: "md-migracion", ls, idb: conCarpetas ? idb : [] }, DESTINO);
    try { enviar(true); msg("Datos enviados a la dirección nueva. Ya puedes cerrar esta ventana."); }
    catch (e) { enviar(false); msg("Datos enviados (la carpeta de la empresa tendrás que elegirla otra vez). Ya puedes cerrar esta ventana."); }
    setTimeout(() => window.close(), 2500);
    return;
  }
  // 2) Si no, se llevan en la propia dirección (comprimidos) a la página nueva, que los guarda
  msg("Llevando tus datos a la dirección nueva…");
  const texto = JSON.stringify({ ls });
  const gz = await new Response(new Blob([texto]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
  let bin = ""; const b = new Uint8Array(gz); for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  location.replace(DESTINO + "/#md-migracion=" + btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
})();
