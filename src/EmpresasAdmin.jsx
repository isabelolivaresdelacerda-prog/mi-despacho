// Administración de empresas: quién entra en cada una (titular, gestoría, colaborador).
import { useEffect, useState } from "react";
import { misEmpresas, empresasAdmin } from "./lib/cuentas.js";
import { nifValido } from "./lib/empresa.js";

const ROLES = { titular: "Titular", gestoria: "Gestoría", colaborador: "Colaborador" };
const TIPOS = { empresa: "Empresa", gestoria: "Gestoría", despacho: "Despacho", asociacion: "Asociación" };

export default function EmpresasAdmin({ usuarios }) {
  const [emps, setEmps] = useState([]);
  const [acc, setAcc] = useState([]);
  const [nueva, setNueva] = useState({ nombre: "", cif: "", tipo: "empresa" });
  const [asig, setAsig] = useState({});
  const [error, setError] = useState("");
  const cargar = async () => { try { setEmps(await misEmpresas()); setAcc(await empresasAdmin.accesos()); } catch { setError("No se pudieron cargar las empresas."); } };
  useEffect(() => { cargar(); }, []);
  const hacer = async (fn) => { setError(""); try { await fn(); await cargar(); } catch (e) { setError(e.message || "No se pudo completar."); } };
  const cifMal = nueva.cif && !nifValido(nueva.cif);

  return (
    <section className="tarjeta">
      <h2>Empresas</h2>
      <p className="muted pequeño">Cada empresa tiene sus datos por separado. Un usuario solo ve las empresas que le asignes. Si tiene varias, al entrar elige con cuál trabajar.</p>
      {error && <p className="nota error">{error}</p>}
      {emps.map((e) => {
        const miembros = acc.filter((a) => a.empresa_id === e.id && a.activo);
        const a = asig[e.id] || { email: "", rol: "titular" };
        return (
          <div key={e.id} className="empresa-admin">
            <div className="empresa-admin-cab"><strong>{e.nombre}</strong><span className="muted pequeño">{e.cif || "sin CIF"} · {TIPOS[e.tipo]}</span></div>
            <ul className="miembros">
              {miembros.length === 0 && <li className="muted pequeño">Nadie tiene acceso todavía (solo tú, como administradora).</li>}
              {miembros.map((m) => (
                <li key={m.email}><span>{m.email}</span><span className="etq-rol">{ROLES[m.rol]}</span>
                  <button className="enlace" type="button" onClick={() => window.confirm(`¿Quitar el acceso de ${m.email} a ${e.nombre}?`) && hacer(() => empresasAdmin.asignar(e.id, m.email, m.rol, false))}>Quitar</button></li>
              ))}
            </ul>
            <div className="fila">
              <select value={a.email} onChange={(ev) => setAsig({ ...asig, [e.id]: { ...a, email: ev.target.value } })}>
                <option value="">Dar acceso a…</option>
                {usuarios.filter((u) => u.rol !== "admin" && !miembros.some((m) => m.email === u.email)).map((u) => <option key={u.email} value={u.email}>{u.nombre ? `${u.nombre} · ` : ""}{u.email}</option>)}
              </select>
              <select value={a.rol} onChange={(ev) => setAsig({ ...asig, [e.id]: { ...a, rol: ev.target.value } })}>{Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              <button className="btn ghost" type="button" disabled={!a.email} onClick={() => hacer(async () => { await empresasAdmin.asignar(e.id, a.email, a.rol); setAsig({ ...asig, [e.id]: { email: "", rol: "titular" } }); })}>Añadir</button>
            </div>
          </div>
        );
      })}
      <div className="empresa-nueva">
        <p className="ce-sub">Nueva empresa</p>
        <div className="fila">
          <input placeholder="Razón social" value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} />
          <input placeholder="CIF" value={nueva.cif} onChange={(e) => setNueva({ ...nueva, cif: e.target.value })} />
          <select value={nueva.tipo} onChange={(e) => setNueva({ ...nueva, tipo: e.target.value })}>{Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <button className="btn" type="button" disabled={nueva.nombre.trim().length < 2 || cifMal} onClick={() => hacer(async () => { await empresasAdmin.crear(nueva.nombre, nueva.cif.toUpperCase().replace(/[\s.-]/g, ""), nueva.tipo); setNueva({ nombre: "", cif: "", tipo: "empresa" }); })}>Crear</button>
        </div>
        {cifMal && <p className="nota error">El CIF no es válido.</p>}
      </div>
    </section>
  );
}
