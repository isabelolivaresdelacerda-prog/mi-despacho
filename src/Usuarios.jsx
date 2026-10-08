// Usuarios (solo administradora): solicitudes de alta, personas con acceso y registro de actividad.
import { useEffect, useState } from "react";
import { admin } from "./lib/cuentas.js";

const ESTADOS = { pendiente_clave: "Pendiente de crear clave", activo: "Activo", bloqueado: "Bloqueado" };

export default function Usuarios({ yo, onCambio }) {
  const [sol, setSol] = useState([]);
  const [us, setUs] = useState([]);
  const [reg, setReg] = useState([]);
  const [codigo, setCodigo] = useState(null); // { email, nombre, codigo }
  const [error, setError] = useState("");

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
          <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
          <tbody>{us.map((u) => (
            <tr key={u.email}>
              <td>{u.nombre || "—"}</td><td>{u.email}</td><td>{u.rol === "admin" ? "Administradora" : "Usuario"}</td><td>{ESTADOS[u.estado]}</td>
              <td className="acciones">
                {u.email !== yo?.email && <>
                  <button className="btn ghost" type="button" onClick={() => hacer(async () => setCodigo({ email: u.email, nombre: u.nombre, codigo: await admin.codigo(u.email) }))}>{u.estado === "pendiente_clave" ? "Generar código" : "Código para cambiar clave"}</button>
                  {u.estado === "bloqueado"
                    ? <button className="btn ghost" type="button" onClick={() => hacer(() => admin.estado(u.email, "activo"))}>Desbloquear</button>
                    : u.estado === "activo" && <button className="btn ghost" type="button" onClick={() => window.confirm(`¿Bloquear el acceso de ${u.email}?`) && hacer(() => admin.estado(u.email, "bloqueado"))}>Bloquear</button>}
                </>}
              </td>
            </tr>))}</tbody>
        </table>
      </section>

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
