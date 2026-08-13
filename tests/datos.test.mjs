/* Verifica los datos generados desde el simulador del TSJE:
 *   node tests/datos.test.mjs
 * Comprueba que las nóminas estén completas y sin relleno, que el reparto de
 * una elección real dé lo que dio, y que la elección con la que se abre la
 * página no diga nada de ninguna elección de verdad. */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { normalizar, calcularDHondt, datosPorDefecto, normalizarHex, ajustarParaFondo,
        contraste, FONDO_CLARO, FONDO_OSCURO, CONTRASTE_MINIMO } = require("../js/core.js");

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

/* El único conjunto con votos de verdad: sirve para comprobar el cálculo
 * contra una elección que ya pasó, no sólo contra ejemplos. */
console.log("\nSenadores 2023 — resultados oficiales");
{
  const s = leer("senadores-2023.json");
  const e = normalizar(s);
  const cands = s.listas.flatMap(function (l) { return l.candidatos; });

  check("18 listas", s.listas.length, 18);
  check("45 bancas", s.bancas, 45);
  check("45 candidatos por lista",
    s.listas.map(function (l) { return l.candidatos.length; }), Array(18).fill(45));
  check("810 candidatos", cands.length, 810);

  // Cuadre con el PDF del TSJE: 2.885.656 + 13.706 nulos + 120.825 blancos.
  const validos = s.listas.reduce(function (a, l) { return a + l.votos; }, 0);
  check("votos válidos", validos, 2885656);
  check("emitidos = válidos + blancos + nulos", validos + s.blancos + s.nulos, 3020187);
  check("cada lista: los preferentes suman su total",
    s.listas.filter(function (l) {
      return l.candidatos.reduce(function (a, c) { return a + c.pref; }, 0) !== l.votos;
    }).length, 0);

  const r = calcularDHondt(e.listas, e.bancas, e.umbral);
  // Ordenado por sigla: comparar objetos con JSON.stringify depende del orden
  // en que se insertaron las claves, que acá lo fija el reparto.
  const bancas = e.listas
    .filter(function (l) { return r.ganadas.get(l.id) > 0; })
    .map(function (l) { return [l.sigla, r.ganadas.get(l.id)]; })
    .sort(function (a, b) { return a[0].localeCompare(b[0]); });
  // Coincide con la composición proclamada del Senado 2023-2028: ANR 23,
  // Alianza Senadores por la Patria 12, Cruzada Nacional 5, Encuentro Nacional
  // 2, y una banca para Patria Querida, Frente Guasu y Yo Creo.
  check("reparto de las 45 bancas", bancas, [
    ["Alianza", 12], ["ANR", 23], ["Frente Guasu", 1], ["PCN", 5],
    ["PEN", 2], ["PPQ", 1], ["Yo Creo", 1],
  ]);
  check("las 45 bancas se reparten enteras",
    bancas.reduce(function (a, x) { return a + x[1]; }, 0), 45);
  check("sin sorteos", r.empates.length, 0);
  // La banca 45 se define por poco más de mil votos.
  check("la última banca fue para Yo Creo", Math.round(r.ultima.cociente), 56386);
  check("y la primera afuera fue el sexto cociente del PCN", Math.round(r.siguiente.cociente), 55324);
}

/* Con qué se abre la página en una ventana nueva, sin nada guardado. Es una
 * elección inventada y en cero a propósito: la herramienta no arranca diciendo
 * nada de ninguna elección real ni de ninguna ciudad en particular. */
console.log("\nLa elección con la que se abre");
{
  const d = datosPorDefecto();
  const cands = d.listas.flatMap(function (l) { return l.candidatos; });

  check("6 listas", d.listas.length, 6);
  check("12 bancas", d.bancas, 12);
  check("nóminas completas", cands.length, 72);
  check("todo en cero",
    d.listas.filter(function (l) { return l.votos !== 0 || l.soloLista !== 0; }).length +
    cands.filter(function (c) { return c.pref !== 0; }).length + d.blancos + d.nulos, 0);

  // Ninguna lista, sigla ni candidato puede coincidir con algo de verdad.
  check("listas sin nombre de partido real",
    d.listas.map(function (l) { return l.partido; }),
    ["Lista A", "Lista B", "Lista C", "Lista D", "Lista E", "Lista F"]);
  check("no acredita ninguna fuente", d.fuente, null);
  check("no dice ser ninguna elección real", d.eleccion, "Elección de ejemplo");
  check("no usa el color oficial de ninguna boleta",
    d.listas.filter(function (l) { return l.colorHex !== null; }).length, 0);

  // El aviso de nóminas de relleno es para las que quedaron sin llenar, no
  // para ésta, que es de ejemplo entera y a la vista.
  check("no dispara el aviso de nombres de relleno",
    cands.filter(function (c) { return /^Candidato\/a \d+$/.test(c.nombre); }).length, 0);

  check("normalizar la deja igual", normalizar(d).listas.length, d.listas.length);
}

console.log("\nLa app los lee sin perder nada");

check("el JSON referencia el esquema", datos.$schema, "schema.json");
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
