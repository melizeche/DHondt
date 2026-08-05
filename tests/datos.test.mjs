/* Verifica los datos generados desde el simulador del TSJE:
 *   node tests/datos.test.mjs
 * Comprueba que el JSON importable y el script que las páginas cargan de
 * entrada digan lo mismo, y que las nóminas estén completas y sin relleno. */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { normalizar, normalizarHex, ajustarParaFondo, contraste,
        FONDO_CLARO, FONDO_OSCURO, CONTRASTE_MINIMO } = require("../js/core.js");

let fallos = 0;
function check(nombre, obtenido, esperado) {
  const ok = JSON.stringify(obtenido) === JSON.stringify(esperado);
  if (!ok) fallos++;
  console.log((ok ? "  ok   " : "  FALLA") + "  " + nombre +
    (ok ? "" : `\n           esperado ${JSON.stringify(esperado)}, obtenido ${JSON.stringify(obtenido)}`));
}

const datos = JSON.parse(readFileSync(new URL("../datos/asuncion-junta-municipal.json", import.meta.url), "utf8"));

console.log("\nCandidaturas de la Junta Municipal de Asunción");

check("9 listas", datos.listas.length, 9);
check("24 bancas", datos.bancas, 24);
check("voto preferente (la categoría JUN es preferente)", datos.modo, "desbloqueada");
check("cada lista tiene 24 candidatos",
  datos.listas.map(function (l) { return l.candidatos.length; }), Array(9).fill(24));
check("216 candidatos en total",
  datos.listas.reduce(function (s, l) { return s + l.candidatos.length; }, 0), 216);

check("ningún nombre de relleno",
  datos.listas.flatMap(function (l) { return l.candidatos; })
    .filter(function (c) { return /^Candidato\/a \d+$/.test(c.nombre); }).length, 0);
check("ningún nombre vacío",
  datos.listas.flatMap(function (l) { return l.candidatos; })
    .filter(function (c) { return !c.nombre || !c.nombre.trim(); }).length, 0);
check("todos los votos preferentes arrancan en cero",
  datos.listas.flatMap(function (l) { return l.candidatos; })
    .filter(function (c) { return c.pref !== 0; }).length, 0);
check("todos los totales arrancan en cero",
  datos.listas.filter(function (l) { return l.votos !== 0 || l.soloLista !== 0; }).length, 0);

check("números de lista de la boleta",
  datos.listas.map(function (l) { return l.numero; }), [1, 2, 3, 6, 7, 10, 16, 21, 300]);
check("números de lista sin repetir",
  new Set(datos.listas.map(function (l) { return l.numero; })).size, 9);
check("siglas sin repetir",
  new Set(datos.listas.map(function (l) { return l.sigla; })).size, 9);
check("todas las listas traen su color oficial",
  datos.listas.filter(function (l) { return normalizarHex(l.colorHex) === null; }).length, 0);

console.log("\nColores: el oficial se respeta, pero tiene que verse");

datos.listas.forEach(function (l) {
  const claro = ajustarParaFondo(l.colorHex, false);
  const oscuro = ajustarParaFondo(l.colorHex, true);
  const ok = contraste(claro, FONDO_CLARO) >= CONTRASTE_MINIMO &&
             contraste(oscuro, FONDO_OSCURO) >= CONTRASTE_MINIMO;
  if (!ok) fallos++;
  console.log((ok ? "  ok   " : "  FALLA") + "  " + l.sigla.padEnd(6) + l.colorHex +
    " → claro " + claro + " (" + contraste(claro, FONDO_CLARO).toFixed(2) + ":1)" +
    ", oscuro " + oscuro + " (" + contraste(oscuro, FONDO_OSCURO).toFixed(2) + ":1)");
});

check("los colores quedan distinguibles entre sí en modo claro",
  new Set(datos.listas.map(function (l) { return ajustarParaFondo(l.colorHex, false); })).size, 9);
check("y en modo oscuro",
  new Set(datos.listas.map(function (l) { return ajustarParaFondo(l.colorHex, true); })).size, 9);

console.log("\nEl script que cargan las páginas dice lo mismo que el JSON");

const js = readFileSync(new URL("../js/datos-asuncion.js", import.meta.url), "utf8");
const embebido = JSON.parse(js.slice(js.indexOf("{"), js.lastIndexOf("}") + 1));
// El JSON lleva `$schema` para el editor; el script embebido no lo necesita.
const sinSchema = Object.assign({}, datos);
delete sinSchema.$schema;
check("mismo contenido que datos/asuncion-junta-municipal.json", embebido, sinSchema);
check("el JSON referencia el esquema", datos.$schema, "esquema.json");
check("el script embebido no arrastra esa referencia", "$schema" in embebido, false);

console.log("\nLa app los lee sin perder nada");

const estado = normalizar(datos);
check("normalizar conserva las 9 listas", estado.listas.length, 9);
check("normalizar conserva el color oficial",
  estado.listas.map(function (l) { return l.colorHex; }),
  datos.listas.map(function (l) { return l.colorHex.toLowerCase(); }));
check("normalizar conserva los nombres del primer y último candidato",
  [estado.listas[0].candidatos[0].nombre, estado.listas[8].candidatos[23].nombre],
  [datos.listas[0].candidatos[0].nombre, datos.listas[8].candidatos[23].nombre]);
check("normalizar deja los totales en cero",
  estado.listas.filter(function (l) { return l.votos !== 0; }).length, 0);

console.log("\nHex sueltos");
check("acepta con y sin almohadilla", [normalizarHex("#FF0000"), normalizarHex("ff0000")], ["#ff0000", "#ff0000"]);
check("rechaza lo que no es un hex de 6", [normalizarHex("#f00"), normalizarHex("rojo"), normalizarHex(null)], [null, null, null]);
check("el blanco se oscurece en fondo claro", ajustarParaFondo("#ffffff", false) !== "#ffffff", true);
check("y se deja igual en fondo oscuro", ajustarParaFondo("#ffffff", true), "#ffffff");
check("el negro se aclara en fondo oscuro", ajustarParaFondo("#000000", true) !== "#000000", true);

console.log(fallos === 0 ? "\nTodo en orden.\n" : `\n${fallos} fallo(s).\n`);
process.exit(fallos === 0 ? 0 : 1);
