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
import { sb, miFicha, salir as salirCuenta, admin, misEmpresas, empresaPorDominio } from "./lib/cuentas.js";
import { AccesosEmpresa, VincularEmpresa } from "./lib/Enlaces.jsx";
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
      { ruta: "empresa/carpeta", titulo: "Carpeta de la empresa (toda)" },
    ],
  },
  {
    app: "contratos", titulo: "Contratos", icono: "§",
    hijos: [
      { ruta: "contratos/crear/cuentas-participacion", titulo: "Contrato de cuentas en participación" },
      { ruta: "contratos/crear/encargo-tratamiento", titulo: "Contrato de encargo del tratamiento (RGPD)" },
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
        {!config.logo && <Logo config={config} grande />}
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
    Promise.all([misEmpresas(), empresaPorDominio()]).then(([l, dom]) => {
      setEmpresas(l);
      let ult = null; try { ult = localStorage.getItem("md-ultima-empresa:" + yo.email); } catch { /* nada */ }
      // Dominio propio de una empresa (midespacho.beatrizinversiones.com): se entra directamente en ella
      const porDominio = dom && l.find((x) => x.id === dom.id);
      if (porDominio) elegirEmpresa(porDominio);
      else if (l.length === 1) elegirEmpresa(l[0]);
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
    case "empresa/carpeta":
    case "contratos/carpeta":
      vista = <VistaCarpeta titulo="Carpeta de la empresa" eyebrow="Documentación" enlace={config.carpetas.contratos} nube={config.nube} config={config} empezarEnPC />; break;
    case "vincular":
      vista = <VincularEmpresa onHecho={() => misEmpresas().then(setEmpresas)} />; break;
    case "seguridad":
      vista = <Seguridad config={config} />; break;
    case "guias/asociaciones":
      vista = <GuiaAsociaciones />; break;
    case "calendario":
      vista = <Calendario config={config} guardar={guardar} />; break;
    case "carpetas":
      vista = <div className="app"><header className="app-cab"><div><div className="eyebrow">Mi empresa</div><h1>Carpetas de la empresa</h1></div></header><CarpetasEmpresa config={config} guardar={guardar} /></div>; break;
    case "contabilidad":
      vista = <ContabilidadWeb config={config} guardar={guardar} empresaId={empresa.id} />; break;
    case "contabilidad/carpeta":
      vista = <VistaCarpeta titulo="Carpeta de contabilidad" eyebrow="Contabilidad" enlace={config.carpetas.contabilidad} nube={config.nube} contabilidad config={config} />; break;
    case "usuarios":
      vista = yo.rol === "admin" ? <Usuarios yo={yo} onCambio={setPendientes} /> : <Inicio config={config} ir={ir} />; break;
    case "ajustes":
      vista = <><Ajustes config={config} guardar={guardar} /><div className="app"><AccesosEmpresa empresa={empresa} yo={yo} esTitular={empresa.rol === "titular"} /></div></>; break;
    default:
      vista = <Inicio config={config} ir={ir} />;
  }

  const Enl = ({ r, children }) => (
    <a href={"#/" + r} className={ruta === r ? "active" : ""} aria-current={ruta === r ? "page" : undefined} onClick={() => document.activeElement?.blur()}>{children}</a>
  );
  // Desplegable estilo Patriam: el título del grupo y sus opciones debajo
  const Despl = ({ titulo, items, insignia }) => {
    const activo = items.some((x) => x && ruta === x.ruta);
    return (
      <div className="despl">
        <button type="button" className={"despl-btn" + (activo ? " active" : "")} aria-haspopup="true">{titulo}{insignia > 0 && <span className="insignia">{insignia}</span>} <span aria-hidden>▾</span></button>
        <div className="despl-menu">{items.filter(Boolean).map((x) => x.accion
          ? <button key={x.titulo} type="button" onClick={() => { document.activeElement?.blur(); x.accion(); }}>{x.titulo}</button>
          : <Enl key={x.ruta} r={x.ruta}>{x.titulo}{x.insignia > 0 && <span className="insignia">{x.insignia}</span>}</Enl>)}</div>
      </div>
    );
  };
  const apps = MENU.filter((m) => config.apps[m.app]);

  return (
    <div className="sitio-app" style={tema}>
      <header className="cabecera">
        <div className="cabecera-in">
          <a href="#/inicio" className="logo-cab" aria-label="Inicio">{config.logo ? <img src={config.logo} alt={config.nombre || "Mi Despacho"} /> : <><Logo config={config} /><span className="nombre-cab">{config.nombre || "Mi Despacho"}</span></>}</a>
          <div className="cabecera-derecha">
            {(empresas.length > 1 || yo.rol === "admin") && <button type="button" className="enlace-cuenta" title="Cambiar de empresa" onClick={() => { fijarEspacio(null); setEmpresa(null); }}>🏢 <span className="texto-cuenta">{empresa.nombre}</span></button>}
            <span className="enlace-cuenta" title={yo.email}>
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><path d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0" /></svg>
              <span className="texto-cuenta">{yo.nombre || yo.email}</span>
            </span>
            <button type="button" className="btn btn-cabecera" onClick={salir}>Salir</button>
          </div>
        </div>
        <nav className="menu-principal" aria-label="Menú principal">
          <div className="menu-in">
            <Enl r="inicio">Inicio</Enl>
            <Enl r="calendario">Calendario</Enl>
            {apps.map((m) => <Despl key={m.app} titulo={m.titulo} items={m.hijos} />)}
            <Despl titulo="Utilidades" items={[
              { ruta: "carpetas", titulo: "Organizar las carpetas de la empresa" },
              { ruta: "guias/asociaciones", titulo: "Guía: contabilidad de asociaciones" },
              { ruta: "seguridad", titulo: "Seguridad, datos e IA" },
            ]} />
            <Despl titulo="Administración" insignia={yo.rol === "admin" ? pendientes : 0} items={[
              yo.rol === "admin" && { ruta: "usuarios", titulo: "Usuarios y empresas", insignia: pendientes },
              { ruta: "vincular", titulo: "Vincular una empresa (gestorías)" },
              { ruta: "ajustes", titulo: "Ajustes de la empresa" },
              (empresas.length > 1 || yo.rol === "admin") && { titulo: "Cambiar de empresa", accion: () => { fijarEspacio(null); setEmpresa(null); } },
              { titulo: "Salir", accion: salir },
            ]} />
          </div>
        </nav>
      </header>
      <main className="principal">{vista}</main>
      <footer className="pie-app">Documentos en {NUBES[config.nube].nombre} · {empresa.nombre} · Mi Despacho · bitini labs</footer>
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
