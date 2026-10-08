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
import { sincronizarAjustes, subirAjustes } from "./lib/ajustesNube.js";
const DIRECCION_ANTIGUA = "mi-despacho-nine.vercel.app", DIRECCION_NUEVA = "https://midespacho.vercel.app";
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
  const [sincronizando, setSincronizando] = useState(false);
  const elegirEmpresa = async (e) => {
    fijarEspacio(yo.email, e.id);
    try { localStorage.setItem("md-ultima-empresa:" + yo.email, e.id); } catch { /* nada */ }
    // Ajustes guardados en la cuenta: iguales en cualquier dirección y ordenador
    setSincronizando(true);
    // En la dirección antigua están los ajustes de verdad: se suben siempre a la cuenta y se lleva a la nueva
    if (location.hostname === DIRECCION_ANTIGUA) {
      const ok = await subirAjustes(yo.email, e.id);
      if (ok) { location.replace(DIRECCION_NUEVA + "/#/inicio"); return; }
    } else await sincronizarAjustes(yo.email, e.id);
    setSincronizando(false);
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
  const guardar = (c) => { setConfig(c); guardarConfig(c); if (yo && empresa) { clearTimeout(window.__mdSubir); window.__mdSubir = setTimeout(() => subirAjustes(yo.email, empresa.id), 1500); } };
  // Lo que guardan las demás apps (calendario, plantillas…) también se sube a la cuenta cada poco
  useEffect(() => { if (!yo || !empresa) return; const t = setInterval(() => subirAjustes(yo.email, empresa.id), 120000); return () => clearInterval(t); }, [yo, empresa]);
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
  if (empresas === null || sincronizando) return <div className="bienvenida"><p className="muted">{sincronizando ? (location.hostname === DIRECCION_ANTIGUA ? "Guardando tus ajustes en tu cuenta y llevándote a la nueva dirección…" : "Cargando tus ajustes…") : ""}</p></div>;
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
    case "prompts":
      vista = <Proximamente titulo="Prompts y skills" texto="Biblioteca de prompts y skills de IA preparados para tu despacho o empresa (contratos, contabilidad, cumplimiento…). Será un servicio adicional." />; break;
    case "papeleria":
      vista = <Proximamente titulo="Papelería corporativa" texto="Facturas, hoja de carta e informes con el logo, los colores y los datos legales de la empresa (CIF, domicilio, inscripción registral)." />; break;
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

  // Iconos de línea, todos del mismo estilo
  const I = {
    inicio: "M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z",
    calendario: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
    conta: "M4 19V5M4 19h16M8 15v-4M12 15V8M16 15v-6",
    carpeta: "M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z",
    carpetas: "M3 7h6l2 2h10v9H3zM7 4h5",
    contrato: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
    guia: "M5 4h10a4 4 0 014 4v12H9a4 4 0 01-4-4zM5 16a4 4 0 014-4h10",
    escudo: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
    usuarios: "M9 11a4 4 0 100-8 4 4 0 000 8zM2 21a7 7 0 0114 0M17 11a3 3 0 100-6M22 21a6 6 0 00-5-6",
    enlace: "M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1",
    ajustes: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z",
    empresa: "M4 21V5a1 1 0 011-1h9a1 1 0 011 1v16M15 9h4a1 1 0 011 1v11M8 8h3M8 12h3M8 16h3M3 21h18",
    salir: "M15 4h4a1 1 0 011 1v14a1 1 0 01-1 1h-4M10 17l5-5-5-5M15 12H3",
    punto: "M12 12h.01",
    chispa: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z",
    papel: "M6 3h9l3 3v15H6zM9 9h6M9 13h6M9 17h4",
    ia: "M9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2M7 7h10v10H7zM10 10h4v4h-4z",
  };
  const Ico = ({ n }) => <svg className="ico-menu" viewBox="0 0 24 24" aria-hidden><path d={I[n]} /></svg>;
  const Item = ({ r, icono, children, insignia }) => (
    <a href={"#/" + r} className={"menu-item" + (ruta === r ? " activo" : "")} aria-current={ruta === r ? "page" : undefined}>
      <Ico n={icono} /><span>{children}</span>{insignia > 0 && <span className="insignia">{insignia}</span>}
    </a>
  );
  const Seccion = ({ titulo, children }) => <div className="menu-seccion"><div className="menu-seccion-t">{titulo}</div>{children}</div>;
  const tiene = (app) => config.apps[app];

  return (
    <div className={"marco" + (menuAbierto ? " menu-abierto" : "")} style={tema}>
      <aside className="lateral">
        <div className="lateral-cab">
          <a href="#/inicio" className="marca-lat">{config.logo ? <img src={config.logo} alt={config.nombre || "Mi Despacho"} /> : <><Logo config={config} /><span>{config.nombre || "Mi Despacho"}</span></>}</a>
          <button className="btn-menu" type="button" aria-label="Abrir el menú" aria-expanded={menuAbierto} onClick={() => setMenuAbierto(!menuAbierto)}>☰</button>
        </div>
        <div className="quien-lat">
          <strong>{yo.nombre || yo.email}</strong>
          <span>{empresa.nombre}</span>
        </div>
        <nav className="menu">
          <Seccion titulo="General">
            <Item r="inicio" icono="inicio">Inicio</Item>
            <Item r="calendario" icono="calendario">Calendario</Item>
          </Seccion>
          {tiene("contabilidad") && <Seccion titulo="Contabilidad">
            <Item r="contabilidad" icono="conta">Mi contabilidad</Item>
            <Item r="contabilidad/carpeta" icono="carpeta">Carpeta de contabilidad</Item>
          </Seccion>}
          <Seccion titulo="Documentos">
            <Item r="empresa/carpeta" icono="carpeta">Carpeta de la empresa</Item>
            <Item r="carpetas" icono="carpetas">Organizar carpetas</Item>
          </Seccion>
          <Seccion titulo="Aplicaciones">
            {tiene("contratos") && <>
              <div className="menu-grupo-t"><Ico n="contrato" /><span>Contratos</span></div>
              <div className="menu-sub">
                <Item r="contratos/crear/cuentas-participacion" icono="punto">Cuentas en participación</Item>
                <Item r="contratos/crear/encargo-tratamiento" icono="punto">Encargo del tratamiento</Item>
              </div>
            </>}
            <Item r="prompts" icono="chispa">Prompts y skills <em className="pronto">pronto</em></Item>
            <Item r="papeleria" icono="papel">Papelería corporativa <em className="pronto">pronto</em></Item>
          </Seccion>
          <Seccion titulo="Ayuda">
            <Item r="guias/asociaciones" icono="guia">Guía: asociaciones</Item>
            <Item r="seguridad" icono="escudo">Seguridad, datos e IA</Item>
          </Seccion>
          <IaMenu />
          <div className="menu-pie">
            {yo.rol === "admin" && <Item r="usuarios" icono="usuarios" insignia={pendientes}>Usuarios y empresas</Item>}
            <Item r="vincular" icono="enlace">Vincular una empresa</Item>
            <Item r="ajustes" icono="ajustes">Ajustes</Item>
            {(empresas.length > 1 || yo.rol === "admin") && <button className="menu-item" type="button" onClick={() => { fijarEspacio(null); setEmpresa(null); }}><Ico n="empresa" /><span>Cambiar de empresa</span></button>}
            <button className="menu-item" type="button" onClick={salir}><Ico n="salir" /><span>Salir</span></button>
          </div>
        </nav>
      </aside>
      <div className="velo" onClick={() => setMenuAbierto(false)} aria-hidden />
      <main className="principal">{vista}<footer className="pie-app">Documentos en {NUBES[config.nube].nombre} · {empresa.nombre} · Mi Despacho · bitini labs</footer></main>
    </div>
  );
}

function Proximamente({ titulo, texto }) {
  return (
    <div className="app"><header className="app-cab"><div><div className="eyebrow">Aplicaciones · próximamente</div><h1>{titulo}</h1><p className="muted">{texto}</p></div></header>
      <section className="tarjeta"><p>Estamos preparándola. Si quieres que esté activa en tu cuenta en cuanto salga, díselo a la administradora.</p></section></div>
  );
}

// Estado de la IA del ordenador, siempre a la vista en el menú
function IaMenu() {
  const [e, setE] = useState(null);
  const mirar = () => import("./ia-navegador.js").then((m) => m.estadoLocal()).then(setE).catch(() => setE({ ok: false }));
  useEffect(() => { mirar(); const t = setInterval(mirar, 30000); return () => clearInterval(t); }, []);
  return (
    <button type="button" className={"ia-menu " + (e?.ok ? "ok" : e ? "no" : "")} onClick={mirar} title={e?.ok ? `IA de tu ordenador lista (${e.modelo})` : "La IA de tu ordenador no responde. Abre «IA local de Mi Despacho» en el escritorio; si Chrome pregunta por la red local, pulsa Permitir."}>
      <span className="ia-punto" />{e == null ? "Comprobando la IA…" : e.ok ? "IA de tu ordenador lista" : "IA del ordenador apagada"}
    </button>
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
