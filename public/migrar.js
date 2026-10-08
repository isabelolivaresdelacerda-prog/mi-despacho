// Se abre en la dirección antigua (mi-despacho-nine.vercel.app) y envía los datos guardados en este navegador
// a la dirección nueva (midespacho.vercel.app), que es quien la ha abierto. No envía la sesión ni claves de acceso.
(async function () {
  const DESTINO = "https://midespacho.vercel.app";
  const msg = (t) => { document.getElementById("estado").textContent = t; };
  if (!window.opener) { msg("Abre esta página desde Mi Despacho (midespacho.vercel.app)."); return; }
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
  const enviar = (conCarpetas) => window.opener.postMessage({ tipo: "md-migracion", ls, idb: conCarpetas ? idb : [] }, DESTINO);
  try { enviar(true); msg("Datos enviados a la dirección nueva. Ya puedes cerrar esta ventana."); }
  catch (e) { enviar(false); msg("Datos enviados (la carpeta de la empresa tendrás que elegirla otra vez). Ya puedes cerrar esta ventana."); }
  setTimeout(() => window.close(), 2500);
})();
