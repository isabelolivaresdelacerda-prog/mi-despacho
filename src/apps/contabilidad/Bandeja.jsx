// Bandeja de entrada: todo lo que llega a la carpeta «entrada» (por correo o arrastrado) se lee, se clasifica,
// se renombra con el formato de la empresa y se archiva donde va. Una persona revisa antes de archivar.
import { useEffect, useState } from "react";
import { listar, abrir, subir, guardarLectura, num, asignarCuenta } from "./datos.js";
import { nombreSegunFormato, iniciales, prefijoEmpresa } from "../../lib/renombrar.js";
import { preguntarIA } from "../../ia-navegador.js";
import { esPropia } from "./datos.js";

export const CARPETA_ENTRADA = "entrada";
const DESTINOS = {
  factura_recibida: { nombre: "Factura recibida", carpeta: ["facturas"], conta: true },
  factura_emitida: { nombre: "Factura emitida", carpeta: ["facturas_emitidas"], conta: true },
  justificante_banco: { nombre: "Justificante del banco", carpeta: ["documentos_banco"], conta: true },
  extracto: { nombre: "Extracto del banco", carpeta: ["extractos"], conta: true },
  impuesto: { nombre: "Impuesto (modelo, recibo, tasa)", carpeta: ["impuestos"], conta: true },
  escritura: { nombre: "Escritura", carpeta: ["001 corporate"], conta: false },
  contrato: { nombre: "Contrato", carpeta: ["001 corporate"], conta: false },
  otro: { nombre: "Otro documento", carpeta: [], conta: false },
};

const PROMPT = (propia) => `Clasifica este documento de la empresa «${propia?.nombre || ""}»${propia?.cif ? ` (NIF ${propia.cif})` : ""} y responde SOLO con JSON:
{"clase":"factura_recibida|factura_emitida|justificante_banco|extracto|impuesto|escritura|contrato|otro","fecha":"dd/mm/aaaa","titulo":"","proveedor":"","nif_proveedor":"","cliente":"","nif_cliente":"","numero":"","base":0,"iva_pct":0,"iva_importe":0,"retencion_pct":0,"retencion_importe":0,"total":0,"concepto":"","notario":"","protocolo":"","contraparte":"","modelo":""}
Reglas: factura_recibida si la emite otro a nuestra empresa; factura_emitida si la emite nuestra empresa. justificante_banco = recibo, adeudo, orden de transferencia o cargo individual. impuesto = modelo de Hacienda o de la Comunidad (303, 111, 600…), recibo de IBI o tasa. titulo muy corto en mayúsculas (p. ej. «AMPLIACIÓN DE CAPITAL», «ARRENDAMIENTO DE LOCAL», «TRANSFERENCIA ARRAS»). Importes como número con punto. No inventes: si no aparece, vacío o 0.
TEXTO:
`;

async function analizar(arch, propia) {
  const file = await arch.h.getFile();
  let d = null, metodo = "por el nombre";
  if (/\.pdf$/i.test(arch.nombre)) {
    try {
      const { textoPDF } = await import("./leer.js");
      const t = await textoPDF(file, 4);
      if (t.length > 30) {
        const r = await preguntarIA(PROMPT(propia) + t.slice(0, 7000), { maxTokens: 450, json: true });
        const m = r.estado === "ok" && String(r.texto).match(/\{[\s\S]*\}/);
        if (m) { d = JSON.parse(m[0]); metodo = `IA (${r.ia})`; }
        else metodo = "sin IA: revisa la clase";
      } else metodo = "escaneado sin texto: revisa";
    } catch { /* sigue */ }
  }
  if (!d) {
    const n = arch.nombre.toLowerCase();
    d = { clase: /fra|factura|invoice|receipt|recibo/.test(n) ? "factura_recibida" : /extracto/.test(n) ? "extracto" : /transfer|adeudo|justificante/.test(n) ? "justificante_banco" : /modelo|303|111|115|600|ibi|tasa/.test(n) ? "impuesto" : /escritura|esc /.test(n) ? "escritura" : /contrato/.test(n) ? "contrato" : "otro", titulo: arch.nombre.replace(/\.[^.]+$/, "") };
  }
  // La IA a veces confunde quién emite: se corrige con los datos de la empresa
  if (d.clase === "factura_recibida" && esPropia(d.proveedor, d.nif_proveedor, propia) && d.cliente) d = { ...d, clase: "factura_emitida" };
  if (d.clase === "factura_emitida" && esPropia(d.cliente, d.nif_cliente, propia) && d.proveedor) d = { ...d, clase: "factura_recibida" };
  return { datos: d, metodo, mtime: file.lastModified };
}

function nombrePara(d, prefijo, ext) {
  if (d.clase === "factura_recibida" || d.clase === "factura_emitida") {
    const t = d.clase === "factura_recibida" ? d.proveedor : d.cliente;
    return nombreSegunFormato({ fecha: d.fecha, titulo: `FRA ${d.numero ? d.numero + " " : ""}`.trim(), contraparte: t, clase: "otro" }, "", ext);
  }
  if (d.clase === "escritura") return nombreSegunFormato({ ...d, clase: "escritura" }, prefijo, ext);
  if (d.clase === "contrato") return nombreSegunFormato({ ...d, clase: "contrato" }, "", ext);
  if (d.clase === "impuesto") return nombreSegunFormato({ fecha: d.fecha, titulo: d.modelo ? `MODELO ${d.modelo} ${d.titulo || ""}`.trim() : d.titulo || "IMPUESTO", clase: "otro" }, "", ext);
  return nombreSegunFormato({ fecha: d.fecha, titulo: d.titulo || "DOCUMENTO", contraparte: d.contraparte, clase: "otro" }, "", ext);
}

async function dirDe(base, ruta) { let d = base; for (const p of ruta) d = await d.getDirectoryHandle(p, { create: true }); return d; }

export default function Bandeja({ raiz, empresa, propia, aviso, recargar, onCambio }) {
  const [items, setItems] = useState([]);
  const [trabajando, setTrabajando] = useState("");
  const prefijo = (() => { try { return localStorage.getItem("md-prefijo-docs") ?? prefijoEmpresa(propia?.nombre); } catch { return prefijoEmpresa(propia?.nombre); } })();
  const [carpetasEmpresa, setCarpetasEmpresa] = useState([]);

  const cargar = async () => {
    const a = (await listar(raiz, CARPETA_ENTRADA)).filter((x) => !/^_/.test(x.nombre));
    setItems((prev) => a.map((x) => prev.find((p) => p.arch.nombre === x.nombre) || { arch: x, estado: "nuevo" }));
  };
  useEffect(() => { cargar(); (async () => { const out = []; if (empresa) for await (const [n, h] of empresa.entries()) if (h.kind === "directory" && /^\d{3}/.test(n)) out.push(n); setCarpetasEmpresa(out.sort()); })(); }, [raiz]);

  const analizarTodo = async () => {
    for (let i = 0; i < items.length; i++) {
      if (items[i].datos) continue;
      setTrabajando(`Leyendo ${i + 1} de ${items.length}: ${items[i].arch.nombre}`);
      const r = await analizar(items[i].arch, propia);
      const ext = (items[i].arch.nombre.match(/\.[^.]+$/) || [".pdf"])[0].toLowerCase();
      const dest = DESTINOS[r.datos.clase] || DESTINOS.otro;
      setItems((l) => l.map((x, j) => (j === i ? { ...x, ...r, clase: r.datos.clase, nuevo: nombrePara(r.datos, prefijo, ext), carpeta: dest.carpeta.join("/"), estado: "propuesto" } : x)));
    }
    setTrabajando("");
  };

  const archivar = async (it) => {
    const dest = DESTINOS[it.clase] || DESTINOS.otro;
    const ruta = it.carpeta ? it.carpeta.split("/") : dest.carpeta;
    if (!ruta.length) { aviso?.("Elige una carpeta de destino"); return false; }
    const base = dest.conta ? raiz : empresa;
    const d = await dirDe(base, ruta);
    const file = await it.arch.h.getFile();
    // Guardado sin sobrescribir nunca otro archivo
    let final = it.nuevo || it.arch.nombre; const [bn, ex] = final.match(/^(.*?)(\.[^.]+)?$/).slice(1);
    for (let k = 2; k < 100; k++) { try { await d.getFileHandle(final); final = `${bn} (${k})${ex || ""}`; } catch { break; } }
    const w = await (await d.getFileHandle(final, { create: true })).createWritable(); await w.write(file); await w.close();
    // Las facturas quedan ya leídas para la contabilidad
    if ((it.clase === "factura_recibida" || it.clase === "factura_emitida") && it.datos) {
      const x = it.datos; const datos = { archivo: final, fecha: x.fecha, numero: x.numero, proveedor: x.proveedor, nif_proveedor: x.nif_proveedor, cliente: x.cliente, nif_cliente: x.nif_cliente, base: num(x.base), iva_pct: num(x.iva_pct), iva_importe: num(x.iva_importe), retencion_pct: num(x.retencion_pct), retencion_importe: num(x.retencion_importe), total: num(x.total), concepto: x.concepto, cuenta_pgc: it.clase === "factura_emitida" ? "705" : asignarCuenta(`${x.proveedor || ""} ${x.concepto || ""}`), analizado_ia: it.metodo?.startsWith("IA") };
      await guardarLectura(raiz, final, file.lastModified, datos, it.clase === "factura_emitida");
    }
    const ent = await raiz.getDirectoryHandle(CARPETA_ENTRADA);
    await ent.removeEntry(it.arch.nombre);
    return true;
  };
  const archivarUno = async (it) => { try { if (await archivar(it)) { aviso?.(`Archivado: ${it.nuevo}`); await cargar(); recargar?.(); onCambio?.(); } } catch { aviso?.("No se pudo archivar"); } };
  const archivarTodos = async () => {
    let n = 0;
    for (const it of items.filter((x) => x.estado === "propuesto" && x.marcado !== false && x.clase !== "otro")) { setTrabajando(`Archivando ${it.nuevo}`); try { if (await archivar(it)) n++; } catch { /* sigue */ } }
    setTrabajando(""); aviso?.(`${n} documentos archivados`); await cargar(); recargar?.(); onCambio?.();
  };
  const set = (i, k, v) => setItems((l) => l.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  return (
    <div>
      <section className="tarjeta">
        <div className="cierre-cab">
          <h2>Bandeja de entrada</h2>
          <div className="acciones">
            <label className="btn ghost">Añadir documentos<input type="file" multiple hidden onChange={async (e) => { const f = [...e.target.files]; e.target.value = ""; if (f.length) { await subir(raiz, CARPETA_ENTRADA, f); cargar(); } }} /></label>
            <button className="btn" type="button" disabled={!items.length || !!trabajando} onClick={analizarTodo}>{trabajando && trabajando.startsWith("Leyendo") ? "Leyendo…" : "Leer y proponer"}</button>
            <button className="btn" type="button" disabled={!items.some((x) => x.estado === "propuesto") || !!trabajando} onClick={archivarTodos}>Archivar todo lo propuesto</button>
          </div>
        </div>
        <p className="pequeño">Todo lo que llega a la carpeta <code>entrada</code> de la contabilidad (desde el correo de contabilidad, las facturas de Anthropic o arrastrándolo aquí) se lee, se clasifica y se archiva con tu formato de nombre: facturas a «facturas» o «facturas_emitidas» (ya leídas para la contabilidad), justificantes a «documentos_banco», impuestos a «impuestos», escrituras y contratos a la carpeta de la empresa que elijas.</p>
        {trabajando && <p className="pend pequeño">{trabajando}</p>}
      </section>
      {!items.length ? <div className="vacio"><p>✓ La bandeja está vacía.</p></div> : (
        <div className="tabla-scroll"><table className="tabla">
          <thead><tr><th></th><th>Llegó</th><th>Qué es</th><th>Nuevo nombre</th><th>Destino</th><th></th></tr></thead>
          <tbody>{items.map((it, i) => (
            <tr key={it.arch.nombre}>
              <td><input type="checkbox" checked={it.marcado !== false} onChange={(e) => set(i, "marcado", e.target.checked)} /></td>
              <td className="pequeño"><button className="enlace" type="button" onClick={() => abrir(it.arch)}>{it.arch.nombre}</button>{it.metodo && <div className="muted">{it.metodo}</div>}</td>
              <td><select value={it.clase || ""} onChange={(e) => { const c = e.target.value; const dst = DESTINOS[c]; set(i, "clase", c); setItems((l) => l.map((x, j) => (j === i ? { ...x, clase: c, carpeta: dst.carpeta.join("/") } : x))); }}><option value="">—</option>{Object.entries(DESTINOS).map(([k, x]) => <option key={k} value={k}>{x.nombre}</option>)}</select></td>
              <td><input value={it.nuevo || ""} placeholder="(pulsa «Leer y proponer»)" onChange={(e) => set(i, "nuevo", e.target.value)} /></td>
              <td>{it.clase && !DESTINOS[it.clase]?.conta
                ? <select value={it.carpeta || ""} onChange={(e) => set(i, "carpeta", e.target.value)}><option value="">— Elige carpeta —</option>{carpetasEmpresa.map((c) => <option key={c} value={c}>{c}</option>)}</select>
                : <span className="pequeño">{it.carpeta ? `contabilidad › ${it.carpeta}` : ""}</span>}</td>
              <td><button className="btn mini" type="button" disabled={!it.clase || !it.nuevo} onClick={() => archivarUno(it)}>Archivar</button></td>
            </tr>))}</tbody>
        </table></div>
      )}
    </div>
  );
}
