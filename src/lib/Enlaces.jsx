// Gestoría y accesos: la empresa da un código a su gestoría o acepta su solicitud; ve quién entra y puede quitarlo.
// La gestoría vincula una empresa con el código o solicita acceso con el CIF.
import { useEffect, useState } from "react";
import { enlace } from "./cuentas.js";

const ROL = { titular: "Titular", gestoria: "Gestoría", colaborador: "Colaborador" };

export function AccesosEmpresa({ empresa, yo, esTitular }) {
  const [accesos, setAccesos] = useState([]);
  const [sol, setSol] = useState([]);
  const [codigo, setCodigo] = useState("");
  const [msg, setMsg] = useState("");
  const [dominios, setDominios] = useState([]);
  const cargar = async () => {
    try { setAccesos(await enlace.accesos(empresa.id)); } catch { setAccesos([]); }
    try { setSol(await enlace.solicitudes(empresa.id)); } catch { setSol([]); }
    try { setDominios(await enlace.dominios(empresa.id)); } catch { setDominios([]); }
  };
  useEffect(() => { if (esTitular || yo.rol === "admin") cargar(); }, [empresa.id]);
  if (!esTitular && yo.rol !== "admin") return null;
  const correo = () => {
    const asunto = encodeURIComponent(`Acceso a ${empresa.nombre} en Mi Despacho`);
    const cuerpo = encodeURIComponent(`Hola:\n\nPara acceder a la documentación y la contabilidad de ${empresa.nombre} en Mi Despacho:\n\n1. Entra en ${location.origin} con tu usuario.\n2. En el menú Administración › Vincular una empresa, escribe este código: ${codigo}\n\nEl código sirve una sola vez y caduca en 14 días.\n\nUn saludo.`);
    location.href = `mailto:?subject=${asunto}&body=${cuerpo}`;
  };
  return (
    <section className="tarjeta">
      <h2>Gestoría y accesos</h2>
      <p className="muted">Quién puede entrar en {empresa.nombre} y cómo dar acceso a tu gestoría. Solo lo ve la titular.</p>
      {dominios.length > 0 && <p className="pequeño">Dirección propia: {dominios.map((d) => <a key={d} href={`https://${d}`} target="_blank" rel="noopener">{d}</a>)}</p>}

      <h3>Dar acceso a tu gestoría</h3>
      <p className="pequeño">Genera un código y envíaselo. Lo escribe en su Mi Despacho y queda vinculada a esta empresa (un solo uso, caduca en 14 días). Antes de enviarle documentación, firma con ella el contrato de encargo del tratamiento.</p>
      {codigo ? (
        <div className="nota"><p>Código para la gestoría: <strong className="codigo-grande">{codigo}</strong></p><div className="acciones"><button className="btn" type="button" onClick={correo}>Enviárselo por correo (Outlook)</button><a className="btn ghost" href="#/contratos/crear/encargo-tratamiento">Contrato de encargo</a></div></div>
      ) : <button className="btn" type="button" onClick={async () => { try { setCodigo(await enlace.generar(empresa.id)); } catch (e) { setMsg(e.message); } }}>Generar código de enlace</button>}

      {sol.length > 0 && (<>
        <h3>Solicitudes de acceso</h3>
        <table className="tabla"><tbody>{sol.map((s) => (
          <tr key={s.id}><td><strong>{s.nombre || s.solicitante}</strong><div className="muted pequeño">{s.solicitante}{s.organizacion ? ` · ${s.organizacion}` : ""}</div>{s.mensaje && <div className="pequeño">«{s.mensaje}»</div>}</td>
            <td className="muted pequeño">{new Date(s.creado).toLocaleDateString("es-ES")}</td>
            <td className="acciones"><button className="btn mini" type="button" onClick={async () => { await enlace.resolver(s.id, true, empresa.id); cargar(); }}>Aceptar como gestoría</button><button className="btn mini ghost" type="button" onClick={async () => { await enlace.resolver(s.id, false, empresa.id); cargar(); }}>Rechazar</button></td></tr>
        ))}</tbody></table>
      </>)}

      <h3>Quién tiene acceso</h3>
      <table className="tabla"><tbody>{accesos.map((a) => (
        <tr key={a.email} className={a.activo ? "" : "muted"}><td><strong>{a.nombre || a.email}</strong><div className="muted pequeño">{a.email}{a.organizacion ? ` · ${a.organizacion}` : ""}</div></td><td>{ROL[a.rol] || a.rol}{!a.activo && " · sin acceso"}</td>
          <td>{a.activo && a.email !== yo.email && <button className="enlace" type="button" onClick={async () => { if (!window.confirm(`¿Quitar el acceso de ${a.email} a ${empresa.nombre}?`)) return; await enlace.quitar(empresa.id, a.email); cargar(); }}>Quitar acceso</button>}</td></tr>
      ))}</tbody></table>
      {msg && <p className="nota error">{msg}</p>}
    </section>
  );
}

export function VincularEmpresa({ onHecho }) {
  const [codigo, setCodigo] = useState("");
  const [cif, setCif] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [msg, setMsg] = useState("");
  return (
    <div className="app">
      <header className="app-cab"><div><div className="eyebrow">Administración</div><h1>Vincular una empresa</h1>
        <p className="muted">Para gestorías y despachos: accede a la documentación de un cliente con el código que te ha dado, o solicítale acceso.</p></div></header>
      <section className="tarjeta">
        <h2>Tengo un código de la empresa</h2>
        <div className="fila"><label>Código<input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="p. ej. K7M2Q9XA" /></label></div>
        <button className="btn" type="button" disabled={codigo.trim().length < 6} onClick={async () => { try { const n = await enlace.canjear(codigo.trim()); setMsg(`✓ Ya tienes acceso a ${n}. Elígela en «Cambiar de empresa».`); setCodigo(""); onHecho?.(); } catch (e) { setMsg(e.message); } }}>Vincular</button>
      </section>
      <section className="tarjeta">
        <h2>Solicitar acceso a una empresa</h2>
        <p className="pequeño muted">La empresa recibirá tu solicitud y decidirá si te da acceso.</p>
        <div className="fila"><label>CIF de la empresa<input value={cif} onChange={(e) => setCif(e.target.value.toUpperCase())} placeholder="B12345678" /></label><label>Mensaje (opcional)<input value={mensaje} onChange={(e) => setMensaje(e.target.value)} placeholder="Somos vuestra gestoría desde…" /></label></div>
        <button className="btn" type="button" disabled={cif.replace(/\W/g, "").length < 8} onClick={async () => { try { await enlace.solicitar(cif, mensaje); setMsg("Solicitud enviada. Si la empresa usa Mi Despacho, la verá su titular."); setCif(""); setMensaje(""); } catch (e) { setMsg(e.message); } }}>Enviar solicitud</button>
      </section>
      {msg && <p className="nota">{msg}</p>}
    </div>
  );
}
