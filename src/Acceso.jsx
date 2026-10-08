// Pantalla de acceso: entrar, crear mi clave (con el código que da la administradora) o pedir acceso.
import { useState } from "react";
import { entrar, crearClave, pedirAcceso } from "./lib/cuentas.js";

export default function Acceso({ onDentro }) {
  const [modo, setModo] = useState("entrar"); // entrar | clave | pedir
  const [f, setF] = useState({ email: "", clave: "", clave2: "", codigo: "", nombre: "" });
  const [msg, setMsg] = useState(null); // { tipo: "ok" | "error", texto }
  const [ocupado, setOcupado] = useState(false);
  const c = (k) => ({ value: f[k], onChange: (e) => setF({ ...f, [k]: e.target.value }) });

  const enviar = async (e) => {
    e.preventDefault();
    setMsg(null); setOcupado(true);
    try {
      if (modo === "entrar") {
        onDentro(await entrar(f.email, f.clave));
      } else if (modo === "clave") {
        if (f.clave !== f.clave2) throw new Error("Las dos claves no coinciden.");
        await crearClave(f.email.trim().toLowerCase(), f.codigo, f.clave);
        onDentro(await entrar(f.email, f.clave));
      } else {
        await pedirAcceso(f.nombre, f.email);
        setMsg({ tipo: "ok", texto: "Solicitud enviada. Cuando la administradora la apruebe, te dará un código para crear tu clave." });
        setF({ ...f, nombre: "" });
      }
    } catch (err) {
      setMsg({ tipo: "error", texto: err.message });
    } finally { setOcupado(false); }
  };

  const cambiar = (m) => { setModo(m); setMsg(null); };

  return (
    <div className="bienvenida">
      <div className="bienvenida-caja acceso">
        <div className="eyebrow">Mi Despacho · bitini labs</div>
        <h1>{modo === "entrar" ? "Entrar" : modo === "clave" ? "Crear mi clave" : "Pedir acceso"}</h1>
        <p className="muted">
          {modo === "entrar" && "Entra con tu correo y tu clave."}
          {modo === "clave" && "La primera vez, o si has olvidado tu clave: escribe el código que te ha dado la administradora y elige tu clave."}
          {modo === "pedir" && "Déjanos tu nombre y tu correo. La administradora revisará tu solicitud."}
        </p>
        <form onSubmit={enviar} className="formulario">
          {modo === "pedir" && <label>Nombre y apellidos<input required minLength={2} maxLength={120} autoComplete="name" {...c("nombre")} /></label>}
          <label>Correo<input type="email" required autoComplete="username" {...c("email")} /></label>
          {modo === "clave" && <label>Código<input required autoComplete="one-time-code" maxLength={8} style={{ textTransform: "uppercase", letterSpacing: ".15em" }} {...c("codigo")} /></label>}
          {modo !== "pedir" && <label>{modo === "clave" ? "Nueva clave" : "Clave"}<input type="password" required autoComplete={modo === "clave" ? "new-password" : "current-password"} minLength={modo === "clave" ? 12 : 1} {...c("clave")} /></label>}
          {modo === "clave" && <>
            <label>Repite la clave<input type="password" required autoComplete="new-password" {...c("clave2")} /></label>
            <p className="muted" style={{ fontSize: 13 }}>Al menos 12 caracteres, con letras y números. Se guarda cifrada: nadie puede verla, tampoco la administradora.</p>
          </>}
          {msg && <p className={msg.tipo === "error" ? "nota error" : "nota"} role="status">{msg.texto}</p>}
          <div className="acciones">
            <button className="btn" type="submit" disabled={ocupado}>{ocupado ? "Un momento…" : modo === "entrar" ? "Entrar" : modo === "clave" ? "Guardar clave y entrar" : "Enviar solicitud"}</button>
          </div>
        </form>
        <div className="acceso-enlaces">
          {modo !== "entrar" && <button className="enlace" type="button" onClick={() => cambiar("entrar")}>Ya tengo clave: entrar</button>}
          {modo !== "clave" && <button className="enlace" type="button" onClick={() => cambiar("clave")}>Es mi primera vez / he olvidado mi clave</button>}
          {modo !== "pedir" && <button className="enlace" type="button" onClick={() => cambiar("pedir")}>No tengo acceso: pedirlo</button>}
        </div>
      </div>
    </div>
  );
}
