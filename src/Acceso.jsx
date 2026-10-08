// Pantalla de acceso: entrar (clave + doble factor), crear mi clave (con el código de la administradora) o pedir acceso.
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { entrar, crearClave, pedirAcceso, estadoMFA, iniciarAltaMFA, verificarMFA, salir } from "./lib/cuentas.js";

export default function Acceso({ onDentro }) {
  const [modo, setModo] = useState("entrar"); // entrar | clave | pedir | mfa | mfa-alta
  const [f, setF] = useState({ email: "", clave: "", clave2: "", codigo: "", nombre: "", otp: "" });
  const [msg, setMsg] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [alta, setAlta] = useState(null); // { id, qr, secreto }
  const [factor, setFactor] = useState(null);
  const c = (k) => ({ value: f[k], onChange: (e) => setF({ ...f, [k]: e.target.value }) });

  const siguientePaso = async (e) => {
    const st = e || (await estadoMFA());
    if (!st.sesion) return;
    if (st.inscrito) { setFactor(st.factor); setModo("mfa"); }
    else { const a = await iniciarAltaMFA(); setAlta({ ...a, qr: await QRCode.toDataURL(a.uri, { margin: 1, width: 220 }) }); setModo("mfa-alta"); }
    setF((x) => ({ ...x, otp: "" }));
  };
  // Si ya hay sesión a medias (sin doble factor), ir directamente a ese paso
  useEffect(() => { estadoMFA().then((st) => { if (st.sesion && st.nivel !== "aal2") siguientePaso(st).catch(() => {}); }); }, []);

  const enviar = async (e) => {
    e.preventDefault();
    setMsg(null); setOcupado(true);
    try {
      if (modo === "entrar") await siguientePaso(await entrar(f.email, f.clave));
      else if (modo === "clave") {
        if (f.clave !== f.clave2) throw new Error("Las dos claves no coinciden.");
        await crearClave(f.email.trim().toLowerCase(), f.codigo, f.clave);
        await siguientePaso(await entrar(f.email, f.clave));
      } else if (modo === "pedir") {
        await pedirAcceso(f.nombre, f.email);
        setMsg({ tipo: "ok", texto: "Solicitud enviada. Cuando la administradora la apruebe, te dará un código para crear tu clave." });
        setF({ ...f, nombre: "" });
      } else if (modo === "mfa") onDentro(await verificarMFA(factor, f.otp));
      else if (modo === "mfa-alta") onDentro(await verificarMFA(alta.id, f.otp));
    } catch (err) {
      setMsg({ tipo: "error", texto: err.message });
    } finally { setOcupado(false); }
  };
  const cambiar = (m) => { setModo(m); setMsg(null); };
  const titulos = { entrar: "Entrar", clave: "Crear mi clave", pedir: "Pedir acceso", mfa: "Código de verificación", "mfa-alta": "Activa el doble factor" };
  const esMfa = modo === "mfa" || modo === "mfa-alta";

  return (
    <div className="bienvenida">
      <div className="bienvenida-caja acceso">
        <div className="eyebrow">Mi Despacho · bitini labs</div>
        <h1>{titulos[modo]}</h1>
        <p className="muted">
          {modo === "entrar" && "Entra con tu correo y tu clave."}
          {modo === "clave" && "La primera vez, o si has olvidado tu clave: escribe el código que te ha dado la administradora y elige tu clave."}
          {modo === "pedir" && "Déjanos tu nombre y tu correo. La administradora revisará tu solicitud."}
          {modo === "mfa" && "Abre la app de autenticación de tu móvil y escribe el código de 6 cifras de Mi Despacho."}
          {modo === "mfa-alta" && "Para proteger los datos, Mi Despacho pide un segundo paso al entrar. Solo se configura una vez."}
        </p>
        {modo === "mfa-alta" && alta && (
          <ol className="pasos-mfa">
            <li>Instala en tu móvil <strong>Google Authenticator</strong> o <strong>Microsoft Authenticator</strong> (gratis).</li>
            <li>Ábrela, pulsa <strong>+</strong> y escanea este código:<img src={alta.qr} alt="Código QR para el doble factor" className="qr" />
              <details><summary>¿No puedes escanearlo?</summary><p className="muted">Escribe esta clave en la app: <code className="secreto">{alta.secreto}</code></p></details></li>
            <li>Escribe el código de 6 cifras que aparece en la app.</li>
          </ol>
        )}
        <form onSubmit={enviar} className="formulario">
          {modo === "pedir" && <label>Nombre y apellidos<input required minLength={2} maxLength={120} autoComplete="name" {...c("nombre")} /></label>}
          {!esMfa && <label>Correo<input type="email" required autoComplete="username" {...c("email")} /></label>}
          {modo === "clave" && <label>Código de la administradora<input required autoComplete="one-time-code" maxLength={8} style={{ textTransform: "uppercase", letterSpacing: ".15em" }} {...c("codigo")} /></label>}
          {(modo === "entrar" || modo === "clave") && <label>{modo === "clave" ? "Nueva clave" : "Clave"}<input type="password" required autoComplete={modo === "clave" ? "new-password" : "current-password"} minLength={modo === "clave" ? 12 : 1} {...c("clave")} /></label>}
          {modo === "clave" && <>
            <label>Repite la clave<input type="password" required autoComplete="new-password" {...c("clave2")} /></label>
            <p className="muted" style={{ fontSize: 13 }}>Al menos 12 caracteres, con letras y números. Se guarda cifrada: nadie puede verla, tampoco la administradora.</p>
          </>}
          {esMfa && <label>Código de 6 cifras<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} className="otp" autoFocus {...c("otp")} /></label>}
          {msg && <p className={msg.tipo === "error" ? "nota error" : "nota"} role="status">{msg.texto}</p>}
          <div className="acciones">
            <button className="btn" type="submit" disabled={ocupado}>{ocupado ? "Un momento…" : { entrar: "Entrar", clave: "Guardar clave y seguir", pedir: "Enviar solicitud", mfa: "Verificar", "mfa-alta": "Activar y entrar" }[modo]}</button>
          </div>
        </form>
        <div className="acceso-enlaces">
          {esMfa ? <button className="enlace" type="button" onClick={async () => { await salir(); cambiar("entrar"); }}>Salir y entrar con otra cuenta</button> : <>
            {modo !== "entrar" && <button className="enlace" type="button" onClick={() => cambiar("entrar")}>Ya tengo clave: entrar</button>}
            {modo !== "clave" && <button className="enlace" type="button" onClick={() => cambiar("clave")}>Es mi primera vez / he olvidado mi clave</button>}
            {modo !== "pedir" && <button className="enlace" type="button" onClick={() => cambiar("pedir")}>No tengo acceso: pedirlo</button>}
          </>}
          {modo === "mfa" && <p className="muted pequeño">¿Has perdido el móvil? Pide a la administradora un código nuevo y vuelve a configurar el doble factor.</p>}
        </div>
      </div>
    </div>
  );
}
