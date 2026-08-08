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

function leer(archivo) {
  return JSON.parse(readFileSync(new URL("../datos/" + archivo, import.meta.url), "utf8"));
}

const datos = leer("asuncion-junta-municipal.json");

/* Las dos ciudades convertidas desde el TSJE: misma forma, distinto tamaño. */
const ciudades = [
  { archivo: "asuncion-junta-municipal.json", nombre: "Asunción", listas: 9, bancas: 24,
    numeros: [1, 2, 3, 6, 7, 10, 16, 21, 300] },
  { archivo: "encarnacion-junta-municipal.json", nombre: "Encarnación", listas: 7, bancas: 12,
    numeros: [1, 5, 6, 15, 16, 21, 40] },
  { archivo: "ciudad-del-este-junta-municipal.json", nombre: "Ciudad del Este", listas: 8, bancas: 12,
    numeros: [1, 2, 6, 21, 44, 99, 123, 300] },
];

ciudades.forEach(function (c) {
  console.log("\nCandidaturas de la Junta Municipal de " + c.nombre);
  const d = leer(c.archivo);
  const cands = d.listas.flatMap(function (l) { return l.candidatos; });

  check(c.listas + " listas", d.listas.length, c.listas);
  check(c.bancas + " bancas", d.bancas, c.bancas);
  check("voto preferente (la categoría JUN es preferente)", d.modo, "desbloqueada");
  check("cada lista tiene " + c.bancas + " candidatos",
    d.listas.map(function (l) { return l.candidatos.length; }), Array(c.listas).fill(c.bancas));
  check(c.listas * c.bancas + " candidatos en total", cands.length, c.listas * c.bancas);

  check("ningún nombre de relleno",
    cands.filter(function (x) { return /^Candidato\/a \d+$/.test(x.nombre); }).length, 0);
  check("ningún nombre vacío",
    cands.filter(function (x) { return !x.nombre || !x.nombre.trim(); }).length, 0);
  check("todos los votos preferentes arrancan en cero",
    cands.filter(function (x) { return x.pref !== 0; }).length, 0);
  check("todos los totales arrancan en cero",
    d.listas.filter(function (l) { return l.votos !== 0 || l.soloLista !== 0; }).length, 0);

  check("números de lista de la boleta",
    d.listas.map(function (l) { return l.numero; }), c.numeros);
  check("siglas sin repetir",
    new Set(d.listas.map(function (l) { return l.sigla; })).size, c.listas);
  check("acredita al TSJE", !!(d.fuente && d.fuente.nombre), true);

  // Se respeta el color de la boleta siempre; lo único exigible es que se vea.
  check("todas conservan el color oficial de la boleta",
    d.listas.filter(function (l) { return normalizarHex(l.colorHex) === null; }).length, 0);

  d.listas.forEach(function (l) {
    const claro = ajustarParaFondo(l.colorHex, false);
    const oscuro = ajustarParaFondo(l.colorHex, true);
    const ok = contraste(claro, FONDO_CLARO) >= CONTRASTE_MINIMO &&
               contraste(oscuro, FONDO_OSCURO) >= CONTRASTE_MINIMO;
    if (!ok) fallos++;
    console.log((ok ? "  ok   " : "  FALLA") + "  " + l.sigla.padEnd(6) + l.colorHex +
      " se ve en los dos fondos → " + claro + " (" + contraste(claro, FONDO_CLARO).toFixed(2) + ":1)" +
      ", " + oscuro + " (" + contraste(oscuro, FONDO_OSCURO).toFixed(2) + ":1)");
  });
});

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
