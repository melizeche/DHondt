#!/usr/bin/env node
/* Convierte una respuesta del TREP del TSJE (la transmisión de resultados
 * preliminares) al JSON que importan index.html y candidatos.html.
 *
 *   node tools/trep-a-json.mjs --trep <archivo> [opciones]
 *
 * El archivo es lo que devuelve, para una candidatura y un distrito,
 *   https://resultados.tsje.gov.py/publicacion/dinamics/divulgacion.ajax.php
 *     ?codeleccion=<n>&candidatura=<n>&departamento=<n>&distrito=<n>
 * guardado tal cual desde el navegador. El sitio está detrás de un firewall
 * que pide ejecutar JavaScript, así que el conversor no lo descarga: lee el
 * archivo que se guardó a mano.
 *
 * Son resultados preliminares y el archivo lo dice: la fuente lleva la hora del
 * corte y cuántas mesas había transmitidas.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { normalizarHex } = require("../js/core.js");

/* --------------------------------------------------------------- opciones */
function parsearArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.slice(0, 2) !== "--") continue;
    const clave = a.slice(2);
    const valor = argv[i + 1] && argv[i + 1].slice(0, 2) !== "--" ? argv[++i] : true;
    args[clave] = valor;
  }
  return args;
}

const args = parsearArgs(process.argv.slice(2));

function salirConAyuda(mensaje) {
  if (mensaje) console.error("Error: " + mensaje + "\n");
  console.error(`Uso:
  node tools/trep-a-json.mjs --trep <archivo> [opciones]

Opciones:
  --trep <archivo>     respuesta de divulgacion.ajax.php guardada desde el navegador
  --eleccion <texto>   nombre de la elección para el archivo de salida
  --bancas <n>         bancas a repartir (por defecto, el largo de la nómina más larga)
  --siglas <archivo>   otro JSON del proyecto del que tomar las siglas, por número de lista
  --salida <archivo>   dónde escribir el JSON (por defecto, la salida estándar)`);
  process.exit(mensaje ? 1 : 0);
}

if (args.ayuda || args.help || typeof args.trep !== "string") {
  salirConAyuda(args.ayuda || args.help ? null : "falta --trep");
}

function leerJSON(ruta) {
  try {
    return JSON.parse(readFileSync(ruta, "utf8"));
  } catch (e) {
    salirConAyuda("no se pudo leer " + ruta + " (" + e.message + ")");
  }
}

// 1324 → "1.324", sin depender del ICU con que se compiló node.
function miles(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/* --------------------------------------------------------- carga de datos */
const trep = leerJSON(args.trep);
const totales = trep.totales;
if (!totales || !Array.isArray(trep.candidatos) || !trep.candidatos.length) {
  salirConAyuda(args.trep + " no tiene la forma de una respuesta del TREP (faltan totales o candidatos)");
}

// El TREP no trae siglas. Si hay un archivo del proyecto con la misma boleta
// (las candidaturas del simulador, por ejemplo), se toman de ahí.
const siglaPorNumero = new Map();
if (typeof args.siglas === "string") {
  for (const l of leerJSON(args.siglas).listas || []) {
    if (l.sigla && Number.isInteger(l.numero)) siglaPorNumero.set(l.numero, l.sigla);
  }
}

/* ------------------------------------------------------------- conversión
 * Cada entrada de `candidatos` es una lista: `votos` es su total y
 * `candidatosPref` trae a cada candidato con sus preferentes, ordenados de más
 * a menos votado. El orden de la nómina, que es el que guarda el JSON, está en
 * `ordCandidato`.
 */
const errores = [];

const listas = trep.candidatos
  .slice()
  .sort(function (a, b) { return a.orden - b.orden; })     // orden de la boleta
  .map(function (l, indice) {
    const numero = Number(l.numLista);
    const sigla = siglaPorNumero.get(numero);
    const etiqueta = "la lista " + l.numLista;

    const pref = (l.candidatosPref || []).slice()
      .sort(function (a, b) { return a.ordCandidato - b.ordCandidato; });
    const ordenes = pref.map(function (c) { return c.ordCandidato; });
    const esperado = ordenes.map(function (_, i) { return i + 1; });
    if (JSON.stringify(ordenes) !== JSON.stringify(esperado)) {
      errores.push(etiqueta + " tiene ordCandidato con huecos o repetidos: " + ordenes.join(","));
    }

    // En Paraguay todo voto nombra a un candidato, así que los preferentes
    // tienen que sumar exactamente el total de la lista.
    const sumaPref = pref.reduce(function (s, c) { return s + c.votos; }, 0);
    if (sumaPref !== l.votos) {
      errores.push(etiqueta + ": los preferentes suman " + miles(sumaPref) +
        " y el total de la lista es " + miles(l.votos));
    }

    const rgb = String(l.colLista || "").split(",").map(Number);
    const colorHex = rgb.length === 3 && rgb.every(function (n) { return n >= 0 && n <= 255; })
      ? normalizarHex(rgb.map(function (n) { return n.toString(16).padStart(2, "0"); }).join(""))
      : null;

    const lista = {
      numero: numero,
      partido: l.desPartido.trim(),
    };
    if (sigla) lista.sigla = sigla;                         // si no, la app la deduce
    return Object.assign(lista, {
      color: indice % 8,                                    // respaldo de la paleta
      colorHex: colorHex,
      votos: l.votos,
      soloLista: 0,
      candidatos: pref.map(function (c) {
        return { nombre: c.nomCandidato.replace(/\s+/g, " ").trim(), pref: c.votos };
      }),
    });
  });

/* ---------------------------------------------------------------- cuadre
 * Válidos + blancos + nulos + no computados tiene que dar el total de votos que
 * declara el TREP. Los no computados no tienen lugar en el formato: no cuentan
 * para el reparto ni para las estadísticas de la página.
 */
const validos = listas.reduce(function (s, l) { return s + l.votos; }, 0);
const noComputados = totales.nocomputados || 0;
const suma = validos + totales.blancos + totales.nulos + noComputados;
if (suma !== totales.totalVotos) {
  errores.push("válidos + blancos + nulos + no computados = " + miles(suma) +
    ", y el TREP declara " + miles(totales.totalVotos));
}

if (errores.length) {
  console.error("Las cuentas no cierran; no se escribe nada:");
  errores.forEach(function (e) { console.error("  " + e); });
  process.exit(1);
}

const bancas = args.bancas
  ? Number(args.bancas)
  : listas.reduce(function (m, l) { return Math.max(m, l.candidatos.length); }, 0);

const corte = trep.horaFormated ? " al " + trep.horaFormated : "";
const mesas = miles(totales.mesasPublicadas) + " de " + miles(totales.totalMesas) + " mesas";

const salida = {
  eleccion: typeof args.eleccion === "string" ? args.eleccion : "Resultados preliminares del TREP",
  fuente: {
    nombre: "TREP del TSJE, resultados preliminares" + corte + " (" + mesas + ")",
    url: "https://resultados.tsje.gov.py/",
  },
  bancas: bancas,
  umbral: 0,
  // El TREP trae voto preferente por candidato: es la lista desbloqueada de la
  // Ley 6318/2019.
  modo: "desbloqueada",
  blancos: totales.blancos,
  nulos: totales.nulos,
  listas: listas,
};

const texto = JSON.stringify(Object.assign({ "$schema": "schema.json" }, salida), null, 2) + "\n";
const resumen = `${listas.length} listas, ${miles(validos)} votos válidos, ${bancas} bancas, ` +
  `${mesas}` + (noComputados ? `, ${miles(noComputados)} no computados que quedan afuera` : "");

if (typeof args.salida === "string") {
  writeFileSync(args.salida, texto);
  console.error(resumen + " → " + args.salida);
} else {
  process.stdout.write(texto);
}
