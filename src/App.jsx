import { useEffect, useState } from "react";
import { leerConfig, guardarConfig, TIPOS } from "./almacen.js";
import { NUBES } from "./nube.js";
import Bienvenida from "./Bienvenida.jsx";
import Ajustes from "./Ajustes.jsx";
import ContratoCEP from "./apps/ContratoCEP.jsx";
import ContratoEncargo from "./apps/encargo/ContratoEncargo.jsx";
import VistaCarpeta from "./lib/VistaCarpeta.jsx";
import Calendario, { ProximosAvisos } from "./apps/calendario/Calendario.jsx";
import Seguridad from "./Seguridad.jsx";
import GuiaAsociaciones from "./apps/guias/GuiaAsociaciones.jsx";
import CarpetasEmpresa from "./lib/CarpetasUI.jsx";
import ContabilidadWeb from "./apps/contabilidad/ContabilidadWeb.jsx";
import Acceso from "./Acceso.jsx";
import Usuarios from "./Usuarios.jsx";
import { sb, miFicha, salir as salirCuenta, admin, misEmpresas } from "./lib/cuentas.js";
import { fijarEspacio, hayDatosAntiguos, moverDatosAntiguos, borrarDatosAntiguos } from "./lib/espacio.js";
import { recortarLogo } from "./lib/logo.js";
import { migrarRaizAntigua, borrarRaizAntigua } from "./lib/carpetas.js";

// Apps del despacho. "app" es la clave de contratación (de momento, todas activas).
const MENU = [
  {
    app: "contabilidad", titulo: "Contabilidad", icono: "€",
    hijos: [
      { ruta: "contabilidad", titulo: "Mi contabilidad" },
      { ruta: "contabilidad/carpeta", titulo: "Carpeta de contabilidad" },
    ],
  },
  {
    app: "contratos", titulo: "Contratos", icono: "§",
    hijos: [
      { grupo: "Crear", hijos: [{ ruta: "contratos/crear/cuentas-participacion", titulo: "Contrato de cuentas en participación" }, { ruta: "contratos/crear/encargo-tratamiento", titulo: "Contrato de encargo del tratamiento (RGPD)" }] },
      { ruta: "contratos/carpeta", titulo: "Carpeta de la empresa" },
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
      <ProximosAvisos config={config} ir={ir} />
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
  const [yo, setYo] = useState(undefined); // undefined = comprobando; null = sin sesión
  const [pendientes, setPendientes] = useState(0);
  const [empresas, setEmpresas] = useState(null);   // empresas a las que tiene acceso
  const [empresa, setEmpresa] = useState(null);     // empresa elegida
  const [antiguos, setAntiguos] = useState(false);  // datos de este navegador de antes de las cuentas

  const salir = async () => { fijarEspacio(null); setEmpresa(null); setEmpresas(null); await salirCuenta(); };
  const elegirEmpresa = (e) => {
    fijarEspacio(yo.email, e.id);
    try { localStorage.setItem("md-ultima-empresa:" + yo.email, e.id); } catch { /* nada */ }
    const c = leerConfig();
    setConfig(c.nombre ? c : { ...c, nombre: e.nombre, tipo: e.tipo === "gestoria" ? "gestoria" : "empresa", empresa: { ...(c.empresa || {}), razon_social: e.nombre, cif: e.cif || "" } });
    setEmpresa(e);
    setAntiguos(yo.rol === "admin" && hayDatosAntiguos());
    window.location.hash = "/inicio";
  };
  useEffect(() => {
    if (!yo) return;
    misEmpresas().then((l) => {
      setEmpresas(l);
      let ult = null; try { ult = localStorage.getItem("md-ultima-empresa:" + yo.email); } catch { /* nada */ }
      if (l.length === 1) elegirEmpresa(l[0]);
      else if (ult && l.length > 1 && yo.rol !== "admin") { const e = l.find((x) => x.id === ult); if (e) elegirEmpresa(e); }
    }).catch(() => setEmpresas([]));
  }, [yo]);

  useEffect(() => {
    miFicha().then((f) => setYo(f && f.estado === "activo" ? f : null)).catch(() => setYo(null));
    const { data } = sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT") { fijarEspacio(null); setYo(null); } });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (yo?.rol !== "admin") return;
    const mirar = () => admin.solicitudes().then((s) => setPendientes(s.length)).catch(() => {});
    mirar();
    const t = setInterval(mirar, 60000);
    return () => clearInterval(t);
  }, [yo]);

  useEffect(() => {
    const f = () => { setRuta(rutaActual()); setMenuAbierto(false); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);

  const ir = (r) => { window.location.hash = "/" + r; };
  const guardar = (c) => { setConfig(c); guardarConfig(c); };
  // El logo se recorta (sin márgenes blancos) una vez, para que ocupe todo su espacio
  useEffect(() => {
    if (config.logo && config.logoRecortado !== config.logo.length) {
      recortarLogo(config.logo).then((l) => guardar({ ...config, logo: l, logoRecortado: l.length }));
    }
  }, [config.logo]);
  const irAAjustes = () => ir("ajustes");

  const tema = { "--brand": config.color, "--fondo": config.fondo };

  if (yo === undefined) return <div className="bienvenida" />;
  if (!yo) return <Acceso onDentro={setYo} />;
  if (empresas === null) return <div className="bienvenida" />;
  if (!empresa) return <SelectorEmpresa yo={yo} empresas={empresas} elegir={elegirEmpresa} salir={salir} />;
  if (antiguos) return <DatosAntiguos empresa={empresa} usar={async () => { moverDatosAntiguos(); await migrarRaizAntigua(); setConfig(leerConfig()); setAntiguos(false); }} descartar={() => { borrarDatosAntiguos(); borrarRaizAntigua(); setAntiguos(false); }} />;
  if (!config.configurado) {
    // Primera vez: se rellena con los datos de la cuenta (nombre de la organización y tipo)
    const base = config.nombre ? config : { ...config, nombre: yo.organizacion || "", tipo: yo.tipo_cuenta === "gestoria" ? "gestoria" : "empresa" };
    return <Bienvenida config={base} guardar={guardar} />;
  }

  let vista;
  switch (ruta) {
    case "contratos/crear/cuentas-participacion":
      vista = <ContratoCEP config={config} irAAjustes={irAAjustes} />; break;
    case "contratos/crear/encargo-tratamiento":
      vista = <div className="app"><ContratoEncargo /></div>; break;
    case "contratos/carpeta":
      vista = <VistaCarpeta titulo="Carpeta de la empresa" eyebrow="Contratos" enlace={config.carpetas.contratos} nube={config.nube} />; break;
    case "seguridad":
      vista = <Seguridad config={config} />; break;
    case "guias/asociaciones":
      vista = <GuiaAsociaciones />; break;
    case "calendario":
      vista = <Calendario config={config} guardar={guardar} />; break;
    case "carpetas":
      vista = <div className="app"><header className="app-cab"><div><div className="eyebrow">Mi empresa</div><h1>Carpetas de la empresa</h1></div></header><CarpetasEmpresa config={config} guardar={guardar} /></div>; break;
    case "contabilidad":
      vista = <ContabilidadWeb config={config} guardar={guardar} />; break;
    case "contabilidad/carpeta":
      vista = <VistaCarpeta titulo="Carpeta de contabilidad" eyebrow="Contabilidad" enlace={config.carpetas.contabilidad} nube={config.nube} contabilidad />; break;
    case "usuarios":
      vista = yo.rol === "admin" ? <Usuarios yo={yo} onCambio={setPendientes} /> : <Inicio config={config} ir={ir} />; break;
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
          <a href="#/inicio" className={"marca" + (config.logo ? " con-logo" : "")}>{config.logo ? <><img className="logo-apilado" src={config.logo} alt="" /><span>{config.nombre || "Mi Despacho"}</span></> : <><Logo config={config} /><span>{config.nombre || "Mi Despacho"}</span></>}</a>
          <button className="btn-menu" type="button" aria-label="Menú" aria-expanded={menuAbierto} onClick={() => setMenuAbierto(!menuAbierto)}>☰</button>
        </div>
        <nav className="menu">
          <Item r="inicio">Inicio</Item>
          <Item r="calendario">📅 Calendario</Item>
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
            {yo.rol === "admin" && <Item r="usuarios">👤 Usuarios {pendientes > 0 && <span className="insignia" title="Solicitudes de acceso pendientes">{pendientes}</span>}</Item>}
            <Item r="guias/asociaciones">📖 Guía: asociaciones</Item>
            <Item r="carpetas">📁 Carpetas de la empresa</Item>
            <Item r="ajustes">⚙ Ajustes</Item>
            {(empresas.length > 1 || yo.rol === "admin") && <button className="menu-item salir" type="button" onClick={() => { fijarEspacio(null); setEmpresa(null); }}>🏢 Cambiar de empresa ({empresa.nombre})</button>}
            <button className="menu-item salir" type="button" onClick={salir}>Salir ({yo.email})</button>
            <div className="nube-actual">Documentos en {NUBES[config.nube].nombre}</div>
          </div>
        </nav>
      </aside>
      <main className="principal">{vista}</main>
    </div>
  );
}

function SelectorEmpresa({ yo, empresas, elegir, salir }) {
  return (
    <div className="bienvenida">
      <div className="bienvenida-caja">
        <div className="eyebrow">Mi Despacho</div>
        <h1>Elige la empresa</h1>
        {empresas.length === 0 ? (
          <><p className="muted">Tu cuenta todavía no tiene ninguna empresa asignada. Pide a la administradora que te dé acceso.</p>
            <button className="btn ghost" type="button" onClick={salir}>Salir</button></>
        ) : (
          <>
            <p className="muted">Cada empresa tiene sus datos, carpetas y documentos por separado.</p>
            <div className="lista-empresas">
              {empresas.map((e) => (
                <button key={e.id} type="button" className="empresa-tarjeta" onClick={() => elegir(e)}>
                  <span className="logo-letra">{e.nombre.trim()[0]}</span>
                  <span><strong>{e.nombre}</strong><small>{e.cif || ({ empresa: "Empresa", gestoria: "Gestoría", despacho: "Despacho", asociacion: "Asociación" }[e.tipo])}</small></span>
                </button>
              ))}
            </div>
            <p className="muted pequeño">Entraste como {yo.email}. <button className="enlace" type="button" onClick={salir}>Salir</button></p>
          </>
        )}
      </div>
    </div>
  );
}

function DatosAntiguos({ empresa, usar, descartar }) {
  return (
    <div className="bienvenida">
      <div className="bienvenida-caja">
        <div className="eyebrow">Una sola vez</div>
        <h1>Datos guardados en este navegador</h1>
        <p>En este navegador hay datos de Mi Despacho de antes de las cuentas de usuario (logo, colores, contratos, calendario…).</p>
        <p>¿Son de <strong>{empresa.nombre}</strong>? Si lo son, pásalos a esta empresa. Si no, bórralos: así nadie que entre en este ordenador con otra cuenta podrá verlos.</p>
        <div className="acciones">
          <button className="btn" type="button" onClick={usar}>Sí, pasarlos a {empresa.nombre}</button>
          <button className="btn ghost" type="button" onClick={descartar}>No, borrarlos</button>
        </div>
      </div>
    </div>
  );
}
