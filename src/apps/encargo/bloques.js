// Pasa el modelo de encargo (modelo.js) al formato de bloques del sistema de contratos
// ({t:'title'|'sub'|'h'|'p'|'sig'|'salto', text, lead}), el mismo que usa el contrato de cuentas en participación.
// Cada cláusula es un único bloque con su título en negrita delante (lead) y sus párrafos separados por "\n",
// para poder modificarla entera desde «Modificar las cláusulas». El texto jurídico es el de modelo.js, sin cambios.
import { MODELO, banderas, rellenar } from "./modelo.js";

const letra = (i) => (i < 26 ? "" : String.fromCharCode(97 + Math.floor(i / 26) - 1)) + String.fromCharCode(97 + (i % 26));
const lista = (items) => items.map((t, i) => letra(i) + ") " + t);

export function bloquesEncargo(datos) {
  const f = banderas(datos);
  const B = [];
  let clausula = null; // bloque de la cláusula que se está escribiendo
  const cerrar = () => { if (clausula) { clausula.text = clausula.partes.join("\n"); delete clausula.partes; B.push(clausula); clausula = null; } };

  for (const b of MODELO) {
    if (b.si && !f[b.si]) continue;
    const texto = b.texto ? rellenar(b.texto, datos) : "";
    switch (b.tipo) {
      case "titulo": cerrar(); B.push({ t: "title", text: texto }); break;
      case "subtitulo": cerrar(); B.push({ t: "sub", text: texto }); break;
      case "seccion": cerrar(); B.push({ t: "h", text: texto }); break;
      case "clausula": cerrar(); clausula = { t: "p", lead: texto.replace(/\.?$/, "."), partes: [] }; break;
      case "p":
        if (clausula && !texto.startsWith("Y en prueba de conformidad")) clausula.partes.push(texto);
        else { cerrar(); B.push({ t: "p", text: texto }); }
        break;
      case "lista": {
        const items = lista(b.items.map((t) => rellenar(t, datos)));
        if (clausula) clausula.partes.push(...items);
        else B.push({ t: "p", text: items.join("\n") });
        break;
      }
      case "firmas":
        cerrar();
        B.push({
          t: "sig",
          a: "Fdo.: El Responsable\n" + rellenar("{{resp.razon_social}}", datos) + "\np.p. " + rellenar("{{resp.firmante_nombre}}", datos),
          b: "Fdo.: El Encargado\n" + rellenar("{{enc.razon_social}}", datos) + "\np.p. " + rellenar("{{enc.firmante_nombre}}", datos),
        });
        break;
      case "salto": cerrar(); B.push({ t: "salto" }); break;
      default: break;
    }
  }
  cerrar();
  return B;
}
