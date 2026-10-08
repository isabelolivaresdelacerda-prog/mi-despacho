import { useEffect, useState } from "react";
import { leerConfig, guardarConfig, TIPOS } from "./almacen.js";
import { NUBES } from "./nube.js";
import Bienvenida from "./Bienvenida.jsx";
import Ajustes from "./Ajustes.jsx";
import ContratoCEP from "./apps/ContratoCEP.jsx";
import ContratoEncargo from "./apps/encargo/ContratoEncargo.jsx";
import Carpeta from "./apps/Carpeta.jsx";
import Contabilidad from "./apps/Contabilidad.jsx";

// Apps del despacho. "app" es la clave de contratación (de momento, todas activas).
const MENU = [
  {
    app: "contabilidad", titulo: "Contabilidad", icono: "€",
    hijos: [
      { ruta: "contabilidad", titulo: "Mi contabilidad" },
      { ruta: "contabilidad/carpeta", titulo: "Mi carpeta" },
    ],
  },
  {
    app: "contratos", titulo: "Contratos", icono: "§",
    hijos: [
      { grupo: "Crear", hijos: [{ ruta: "contratos/crear/cuentas-participacion", titulo: "Contrato de cuentas en participación" }, { ruta: "contratos/crear/encargo-tratamiento", titulo: "Contrato de encargo del tratamiento (RGPD)" }] },
      { ruta: "contratos/carpeta", titulo: "Mi carpeta de contratos" },
    ],
  },
];

const rutaActual = () => decodeURIComponent(window.location.hash.replace(/^#\/?/, "")) || "inicio";

function Logo({ config, grande }) {
  return config.logo
    ? <img className={grande ? "logo grande" : "logo"} src={config.logo} alt="" />
    : <span className={grande ? "logo-letra grande" : "logo-letra"}>{(config.nombre || "D").trim()[0]}</span>;
}

function Inicio({ config, ir }) {
  return (
    <div className="app">
      <header className="app-cab inicio-cab">
        <Logo config={config} grande />
        <div>
          <div className="eyebrow">Mi despacho · {TIPOS[config.tipo]?.nombre}</div>
          <h1>{config.nombre || "Mi Despacho"}</h1>
          <p className="muted">Estas son las apps que tienes contratadas. También las tienes en el menú.</p>
        </div>
      </header>
      <div className="tarjetas">
        {MENU.filter((m) => config.apps[m.app]).map((m) => (
          <section className="tarjeta app-tarjeta" key={m.app}>
            <h2><span className="icono">{m.icono}</span>{m.titulo}</h2>
            <ul>
              {m.hijos.flatMap((h) => (h.grupo ? h.hijos.map((x) => ({ ...x, titulo: h.grupo + " · " + x.titulo })) : [h])).map((h) => (
                <li key={h.ruta}><button className="enlace" type="button" onClick={() => ir(h.ruta)}>{h.titulo}</button></li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [config, setConfig] = useState(leerConfig);
  const [ruta, setRuta] = useState(rutaActual);
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => {
    const f = () => { setRuta(rutaActual()); setMenuAbierto(false); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);

  const ir = (r) => { window.location.hash = "/" + r; };
  const guardar = (c) => { setConfig(c); guardarConfig(c); };
  const irAAjustes = () => ir("ajustes");

  const tema = { "--brand": config.color, "--fondo": config.fondo };

  if (!config.configurado) return <Bienvenida config={config} guardar={guardar} />;

  let vista;
  switch (ruta) {
    case "contratos/crear/cuentas-participacion":
      vista = <ContratoCEP config={config} irAAjustes={irAAjustes} />; break;
    case "contratos/crear/encargo-tratamiento":
      vista = <div className="app"><ContratoEncargo /></div>; break;
    case "contratos/carpeta":
      vista = <Carpeta titulo="Mi carpeta de contratos" eyebrow="Contratos" enlace={config.carpetas.contratos} nube={config.nube} irAAjustes={irAAjustes} />; break;
    case "contabilidad":
      vista = <Contabilidad direccion={config.appContabilidad} irAAjustes={irAAjustes} />; break;
    case "contabilidad/carpeta":
      vista = <Carpeta titulo="Mi carpeta de contabilidad" eyebrow="Contabilidad" enlace={config.carpetas.contabilidad} nube={config.nube} irAAjustes={irAAjustes} />; break;
    case "ajustes":
      vista = <Ajustes config={config} guardar={guardar} />; break;
    default:
      vista = <Inicio config={config} ir={ir} />;
  }

  const Item = ({ r, children }) => (
    <a href={"#/" + r} className={"menu-item" + (ruta === r ? " activo" : "")} aria-current={ruta === r ? "page" : undefined}>{children}</a>
  );

  return (
    <div className="marco" style={tema}>
      <aside className={"lateral" + (menuAbierto ? " abierto" : "")}>
        <div className="lateral-cab">
          <a href="#/inicio" className="marca"><Logo config={config} /><span>{config.nombre || "Mi Despacho"}</span></a>
          <button className="btn-menu" type="button" aria-label="Menú" aria-expanded={menuAbierto} onClick={() => setMenuAbierto(!menuAbierto)}>☰</button>
        </div>
        <nav className="menu">
          <Item r="inicio">Inicio</Item>
          {MENU.filter((m) => config.apps[m.app]).map((m) => (
            <div className="menu-grupo" key={m.app}>
              <div className="menu-titulo"><span className="icono">{m.icono}</span>{m.titulo}</div>
              {m.hijos.map((h) => h.grupo ? (
                <div className="menu-sub" key={h.grupo}>
                  <div className="menu-subtitulo">{h.grupo}</div>
                  {h.hijos.map((x) => <Item key={x.ruta} r={x.ruta}>{x.titulo}</Item>)}
                </div>
              ) : <Item key={h.ruta} r={h.ruta}>{h.titulo}</Item>)}
            </div>
          ))}
          <div className="menu-pie">
            <Item r="ajustes">⚙ Ajustes</Item>
            <div className="nube-actual">Documentos en {NUBES[config.nube].nombre}</div>
          </div>
        </nav>
      </aside>
      <main className="principal">{vista}</main>
    </div>
  );
}
