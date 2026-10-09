// Piezas comunes de los generadores de contratos (cuentas en participación, encargo del tratamiento…).
// Trabajan con bloques {t:'title'|'sub'|'h'|'p'|'tabla'|'sig'|'salto', text, lead, a, b, filas}; un texto puede tener
// varios párrafos separados por "\n".
import { useState } from "react";

const SIN_CAMBIOS = { textos: {}, nuevas: [] };

// Cambios guardados por la usuaria (textos cambiados, cláusulas quitadas y añadidas)
export function leerCambios(clave) {
  try { return { ...SIN_CAMBIOS, ...(JSON.parse(localStorage.getItem(clave)) || {}) }; } catch { return { ...SIN_CAMBIOS }; }
}

export function aplicarCambios(B, cambios) {
  const fuera = B.filter((b) => !(b.lead && cambios.textos[b.lead]?.quitada))
    .map((b) => (b.lead && cambios.textos[b.lead]?.texto != null ? { ...b, text: cambios.textos[b.lead].texto, cambiada: true } : b));
  const extra = cambios.nuevas.filter((n) => (n.texto || "").trim()).map((n) => ({ t: "p", lead: (n.titulo || "Cláusula adicional.").trim(), text: n.texto.trim(), cambiada: true }));
  const cierre = fuera.findIndex((b) => b.t === "p" && b.text.startsWith("Y en prueba de conformidad"));
  if (cierre < 0) return [...fuera, ...extra];
  return [...fuera.slice(0, cierre), ...extra, ...fuera.slice(cierre)];
}

export function EditorClausulas({ base, cambios, setCambios, aviso, clave, ejemploTitulo = "Cláusula adicional. Título de la cláusula.", bloqueado }) {
  const [abierto, setAbierto] = useState(false);
  const clausulas = base.filter((b) => b.lead);
  const guardar = (c) => { setCambios(c); try { localStorage.setItem(clave, JSON.stringify(c)); } catch {} };
  const cambiarTexto = (lead, texto) => guardar({ ...cambios, textos: { ...cambios.textos, [lead]: { ...(cambios.textos[lead] || {}), texto } } });
  const quitar = (lead, q) => guardar({ ...cambios, textos: { ...cambios.textos, [lead]: { ...(cambios.textos[lead] || {}), quitada: q } } });
  const restaurar = (lead) => { const t = { ...cambios.textos }; delete t[lead]; guardar({ ...cambios, textos: t }); };
  const nueva = (i, campo, v) => guardar({ ...cambios, nuevas: cambios.nuevas.map((n, j) => (j === i ? { ...n, [campo]: v } : n)) });
  const nCambios = Object.keys(cambios.textos).length + cambios.nuevas.length;
  const filas = (t) => Math.min(14, Math.max(4, Math.ceil((t || "").length / 90) + (t || "").split("\n").length));

  if (bloqueado) return (
    <section className="editor-clausulas">
      <div className="ia-cab">
        <div>
          <h2>Modificar las cláusulas</h2>
          <p className="muted">El contrato está cerrado para la firma y ya no se puede modificar. Para cambiar alguna cláusula, pulsa «Vaciar» y prepara uno nuevo.</p>
        </div>
      </div>
    </section>
  );

  return (
    <section className="editor-clausulas">
      <div className="ia-cab">
        <div>
          <h2>Modificar las cláusulas</h2>
          <p className="muted">Cambia el texto de cualquier cláusula, quítala o añade otras. Tus cambios se guardan en este navegador y se usan en todos los contratos que crees.{nCambios ? ` Tienes ${nCambios} cambio${nCambios === 1 ? "" : "s"} guardado${nCambios === 1 ? "" : "s"}.` : ""}</p>
        </div>
        <div className="acciones">
          <button className="btn ghost" type="button" onClick={() => setAbierto(!abierto)} aria-expanded={abierto}>{abierto ? "Cerrar" : "Modificar cláusulas"}</button>
          {nCambios > 0 && <button className="btn ghost" type="button" onClick={() => { if (window.confirm("¿Volver a todas las cláusulas originales?")) { guardar({ ...SIN_CAMBIOS }); aviso("Cláusulas originales recuperadas"); } }}>Volver al original</button>}
        </div>
      </div>
      {abierto && (
        <div className="lista-clausulas">
          {clausulas.map((b) => {
            const c = cambios.textos[b.lead] || {};
            const valor = c.texto ?? b.text;
            return (
              <div className={"clausula-edit" + (c.quitada ? " quitada" : "")} key={b.lead}>
                <div className="clausula-cab">
                  <strong>{b.lead}</strong>
                  <span className="acciones">
                    {c.texto != null && !c.quitada && <span className="etiqueta">modificada</span>}
                    <button className="enlace" type="button" onClick={() => quitar(b.lead, !c.quitada)}>{c.quitada ? "Volver a ponerla" : "Quitar"}</button>
                    {(c.texto != null || c.quitada) && <button className="enlace" type="button" onClick={() => restaurar(b.lead)}>Original</button>}
                  </span>
                </div>
                {!c.quitada && <textarea rows={filas(valor)} value={valor} onChange={(e) => cambiarTexto(b.lead, e.target.value)} aria-label={b.lead} />}
              </div>
            );
          })}
          {cambios.nuevas.map((n, i) => (
            <div className="clausula-edit nueva" key={"n" + i}>
              <div className="clausula-cab">
                <input value={n.titulo} onChange={(e) => nueva(i, "titulo", e.target.value)} placeholder={ejemploTitulo} aria-label="Título de la cláusula" />
                <button className="enlace" type="button" onClick={() => guardar({ ...cambios, nuevas: cambios.nuevas.filter((_, j) => j !== i) })}>Quitar</button>
              </div>
              <textarea rows={4} value={n.texto} onChange={(e) => nueva(i, "texto", e.target.value)} placeholder="Texto de la cláusula" aria-label="Texto de la cláusula" />
            </div>
          ))}
          <button className="btn ghost" type="button" onClick={() => guardar({ ...cambios, nuevas: [...cambios.nuevas, { titulo: "", texto: "" }] })}>+ Añadir cláusula</button>
          <p className="nota">Si cambias el texto de una cláusula, ese texto queda fijo: ya no se rellena solo con los datos del formulario. Si necesitas que vuelva a rellenarse, pulsa «Original».</p>
        </div>
      )}
    </section>
  );
}

export function Marcas({ texto }) {
  return texto.split(/(\[[^\]]+\])/g).map((t, i) => (/^\[[^\]]+\]$/.test(t) ? <mark key={i}>{t}</mark> : t));
}

// Vista previa del documento (la misma presentación que el Word)
export function VistaDocumento({ bloques }) {
  return (
    <article className="documento" aria-live="polite">
      {bloques.map((b, i) => {
        if (b.t === "title") return <h2 key={i}>{b.text}</h2>;
        if (b.t === "sub") return <p key={i} className="subtitulo">{b.text}</p>;
        if (b.t === "h") return <h3 key={i}>{b.text}</h3>;
        if (b.t === "salto") return <hr key={i} className="salto" />;
        if (b.t === "tabla") return (
          <table key={i} className="tabla-doc"><tbody>
            {(b.filas || []).map(([k, v], n) => <tr key={n}><th scope="row">{k}</th><td>{String(v).split("\n").map((l, j) => <div key={j}><Marcas texto={l} /></div>)}</td></tr>)}
          </tbody></table>
        );
        if (b.t === "sig") return (
          <div key={i} className="firmas">
            {[b.a, b.b].map((s, j) => <div key={j}>{s.split("\n").map((l, n) => <div key={n}><Marcas texto={l} /></div>)}</div>)}
          </div>
        );
        return String(b.text).split("\n").filter((t, n) => n === 0 || t.trim()).map((t, n) => (
          <p key={i + "-" + n} className={b.cambiada ? "cambiada" : undefined}>{n === 0 && b.lead && <span className="clausula">{b.lead} </span>}<Marcas texto={t} /></p>
        ));
      })}
    </article>
  );
}

// Aviso común de todos los contratos: no los escribe la IA y los datos no salen de tu ordenador
export function AvisoSinIA() {
  return (
    <div className="sin-ia">
      <p><strong>Este contrato está hecho sin IA.</strong> El texto es una plantilla jurídica fija que se completa con tus datos y con las cláusulas que tú modifiques. La IA solo lo revisa si tú se lo pides aquí abajo, y no cambia nada por su cuenta.</p>
      <p><strong>Tus datos no salen de aquí.</strong> Lo que escribes en el formulario solo se usa, en tu propio navegador, para generar el documento que descargas o guardas en tu carpeta. Ningún dato sale de tu Drive u OneDrive ni se comparte con una IA abierta: la revisión, si la pides, la hace la IA instalada en tu ordenador. Solo si tú activas en Ajustes la IA en la nube se usaría otra, y la app te avisa antes.</p>
    </div>
  );
}
