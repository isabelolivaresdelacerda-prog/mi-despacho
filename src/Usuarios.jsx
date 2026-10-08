// Usuarios (solo administradora): solicitudes de alta, personas con acceso y registro de actividad.
import { useEffect, useState } from "react";
import { admin } from "./lib/cuentas.js";
import EmpresasAdmin from "./EmpresasAdmin.jsx";

export const TIPOS_CUENTA = { administracion: "Administración", empresa: "Empresa", gestoria: "Gestoría", despacho: "Despacho" };
const ESTADOS = { pendiente_clave: "Pendiente de crear clave", activo: "Activo", bloqueado: "Bloqueado" };

export default function Usuarios({ yo, onCambio }) {
  const [sol, setSol] = useState([]);
  const [us, setUs] = useState([]);
  const [reg, setReg] = useState([]);
  const [codigo, setCodigo] = useState(null); // { email, nombre, codigo }
  const [error, setError] = useState("");
  const [edit, setEdit] = useState(null); // { email, nombre, organizacion, tipo_cuenta }

  const cargar = async () => {
    try { const [a, b, c] = await Promise.all([admin.solicitudes(), admin.usuarios(), admin.registro()]); setSol(a); setUs(b); setReg(c); onCambio?.(a.length); }
    catch { setError("No se han podido cargar los usuarios."); }
  };
  useEffect(() => { cargar(); }, []);

  const hacer = async (fn) => { setError(""); try { await fn(); await cargar(); } catch (e) { setError(e.message || "No se pudo completar."); } };

  const correoCodigo = (c) => {
    const asunto = "Tu acceso a Mi Despacho";
    const cuerpo = `Hola${c.nombre ? ", " + c.nombre.split(" ")[0] : ""}:\n\nYa tienes acceso a Mi Despacho.\n\n1. Entra en https://mi-despacho-nine.vercel.app\n2. Pulsa «Es mi primera vez».\n3. Escribe tu correo, este código y la clave que quieras.\n\nCódigo: ${c.codigo}\n(Caduca en 7 días y solo sirve una vez.)\n\nUn saludo,\n${yo?.nombre || ""}`;
    window.location.href = `mailto:${encodeURIComponent(c.email)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
  };

  return (
    <div className="app">
      <header className="app-cab">
        <div>
          <div className="eyebrow">Administración</div>
          <h1>Usuarios</h1>
          <p className="muted">Solo tú ves esta pantalla. Las claves se guardan cifradas: nadie puede verlas.</p>
        </div>
      </header>
      {error && <p className="nota error">{error}</p>}

      <section className="tarjeta">
        <h2>Solicitudes de acceso {sol.length > 0 && <span className="insignia">{sol.length}</span>}</h2>
        {sol.length === 0 ? <p className="muted">No hay solicitudes pendientes.</p> : (
          <table className="tabla">
            <thead><tr><th>Nombre</th><th>Correo</th><th>Fecha</th><th></th></tr></thead>
            <tbody>{sol.map((s) => (
              <tr key={s.id}>
                <td>{s.nombre}</td><td>{s.email}</td><td>{new Date(s.creada).toLocaleString("es-ES")}</td>
                <td className="acciones">
                  <button className="btn" type="button" onClick={() => hacer(async () => setCodigo({ email: s.email, nombre: s.nombre, codigo: await admin.autorizar(s.id) }))}>Autorizar</button>
                  <button className="btn ghost" type="button" onClick={() => window.confirm(`¿Rechazar la solicitud de ${s.email}?`) && hacer(() => admin.rechazar(s.id))}>Rechazar</button>
                </td>
              </tr>))}</tbody>
          </table>
        )}
      </section>

      {codigo && (
        <section className="tarjeta destacado">
          <h2>Código para {codigo.email}</h2>
          <p className="codigo-grande">{codigo.codigo}</p>
          <p className="muted">Solo se muestra ahora. Envíaselo por un canal de confianza: con él creará su clave (caduca en 7 días).</p>
          <div className="acciones">
            <button className="btn" type="button" onClick={() => correoCodigo(codigo)}>Enviar por correo (Outlook)</button>
            <button className="btn ghost" type="button" onClick={() => navigator.clipboard?.writeText(codigo.codigo)}>Copiar código</button>
            <button className="btn ghost" type="button" onClick={() => setCodigo(null)}>Hecho</button>
          </div>
        </section>
      )}

      <section className="tarjeta">
        <h2>Personas con acceso</h2>
        <table className="tabla">
          <thead><tr><th>Nombre</th><th>Correo</th><th>Organización</th><th>Tipo</th><th>Estado</th><th></th></tr></thead>
          <tbody>{us.map((u) => (
            edit?.email === u.email ? (
            <tr key={u.email}>
              <td><input value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} /></td><td>{u.email}</td>
              <td><input value={edit.organizacion} onChange={(e) => setEdit({ ...edit, organizacion: e.target.value })} /></td>
              <td><select value={edit.tipo_cuenta} onChange={(e) => setEdit({ ...edit, tipo_cuenta: e.target.value })}>{Object.entries(TIPOS_CUENTA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
              <td>{ESTADOS[u.estado]}</td>
              <td className="acciones">
                <button className="btn" type="button" onClick={() => hacer(async () => { await admin.ficha(u.email, edit.nombre, edit.organizacion, edit.tipo_cuenta); setEdit(null); })}>Guardar</button>
                <button className="btn ghost" type="button" onClick={() => setEdit(null)}>Cancelar</button>
              </td>
            </tr>) : (
            <tr key={u.email}>
              <td>{u.nombre || "—"}{u.rol === "admin" && <small className="muted"> · administradora</small>}</td><td>{u.email}</td><td>{u.organizacion || "—"}</td><td>{TIPOS_CUENTA[u.tipo_cuenta]}</td><td>{ESTADOS[u.estado]}</td>
              <td className="acciones">
                <button className="btn ghost" type="button" onClick={() => setEdit({ email: u.email, nombre: u.nombre, organizacion: u.organizacion, tipo_cuenta: u.tipo_cuenta })}>Editar</button>
                {u.email !== yo?.email && <>
                  <button className="btn ghost" type="button" onClick={() => hacer(async () => setCodigo({ email: u.email, nombre: u.nombre, codigo: await admin.codigo(u.email) }))}>{u.estado === "pendiente_clave" ? "Generar código" : "Código para cambiar clave"}</button>
                  {u.estado === "bloqueado"
                    ? <button className="btn ghost" type="button" onClick={() => hacer(() => admin.estado(u.email, "activo"))}>Desbloquear</button>
                    : u.estado === "activo" && <button className="btn ghost" type="button" onClick={() => window.confirm(`¿Bloquear el acceso de ${u.email}?`) && hacer(() => admin.estado(u.email, "bloqueado"))}>Bloquear</button>}
                </>}
              </td>
            </tr>)))}</tbody>
        </table>
      </section>

      <EmpresasAdmin usuarios={us} />

      <section className="tarjeta">
        <h2>Actividad reciente</h2>
        {reg.length === 0 ? <p className="muted">Sin actividad todavía.</p> : (
          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Quién</th><th>Qué</th><th>Detalle</th></tr></thead>
            <tbody>{reg.map((r) => <tr key={r.id}><td>{new Date(r.en).toLocaleString("es-ES")}</td><td>{r.quien}</td><td>{r.accion}</td><td>{r.detalle}</td></tr>)}</tbody>
          </table>
        )}
      </section>
    </div>
  );
}
