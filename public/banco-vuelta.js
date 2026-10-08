// Vuelta de la web del banco (Enable Banking): pasa el código a la pestaña de Mi Despacho y se cierra.
// El código no sirve sin la clave privada que está en la carpeta de la empresa; aun así se borra de la barra de direcciones.
(function () {
  var q = new URLSearchParams(location.search);
  var d = { code: q.get("code") || "", state: q.get("state") || "", error: q.get("error_description") || q.get("error") || "" };
  history.replaceState(null, "", location.pathname);
  try { var c = new BroadcastChannel("midespacho-banco"); c.postMessage(d); c.close(); } catch (e) { /* navegador antiguo */ }
  try { localStorage.setItem("midespacho-banco", JSON.stringify(d)); } catch (e) { /* */ }
  document.getElementById("t").textContent = d.error ? "El banco no dio el permiso" : "¡Banco autorizado!";
  document.getElementById("m").textContent = d.error ? d.error + ". Cierra esta ventana y vuelve a intentarlo desde Mi Despacho." : "Ya puedes cerrar esta ventana; Mi Despacho termina solo.";
  if (!d.error) setTimeout(function () { window.close(); }, 1500);
})();
