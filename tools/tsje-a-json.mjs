#!/usr/bin/env node
/* Convierte los datos del simulador oficial del TSJE al JSON que importan
 * index.html y candidatos.html.
 *
 *   node tools/tsje-a-json.mjs --datos <carpeta> [opciones]
 *
 * La carpeta tiene que contener Categorias.json, Agrupaciones.json y
 * Candidaturas.json, tal como los sirve
 * https://simuladoroficial.tsje.gov.py/datos/<codigo>/
 *
 * El <codigo> de cada municipio sale de ubicaciones.json:
 *   node tools/tsje-a-json.mjs --ciudades ubicaciones.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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
  node tools/tsje-a-json.mjs --datos <carpeta> [opciones]
  node tools/tsje-a-json.mjs --ciudades <ubicaciones.json>

Opciones:
  --datos <carpeta>    carpeta con Categorias.json, Agrupaciones.json y Candidaturas.json
  --categoria <cod>    categoría a convertir (por defecto JUN, la Junta Municipal)
  --bancas <n>         bancas a repartir (por defecto, el largo de la nómina más larga)
  --eleccion <texto>   nombre de la elección para el archivo de salida
  --salida <archivo>   dónde escribir el JSON (por defecto, la salida estándar)
  --js <archivo>       además, escribe el mismo dato como script para que las
                       páginas lo traigan cargado de entrada (js/datos-asuncion.js)
  --ciudades <archivo> lista los municipios de ubicaciones.json con su código`);
  process.exit(mensaje ? 1 : 0);
}

if (args.ayuda || args.help || (!args.datos && !args.ciudades)) {
  salirConAyuda(args.datos || args.ciudades ? null : "falta --datos o --ciudades");
}

function leerJSON(ruta) {
  try {
    return JSON.parse(readFileSync(ruta, "utf8"));
  } catch (e) {
    salirConAyuda("no se pudo leer " + ruta + " (" + e.message + ")");
  }
}

/* ------------------------------------------------------- modo --ciudades */
if (args.ciudades) {
  // ubicaciones.json es [municipio, local, codigo]; un municipio puede tener
  // varios locales y repite el mismo código, así que se agrupan.
  const filas = leerJSON(args.ciudades);
  const porCodigo = new Map();
  for (const fila of filas) {
    if (!Array.isArray(fila) || fila.length < 3) continue;
    const municipio = String(fila[0]).replace(/^\d+-/, "").trim();
    const codigo = String(fila[2]).trim();
    if (!porCodigo.has(codigo)) porCodigo.set(codigo, municipio);
  }
  const ordenadas = [...porCodigo.entries()].sort((a, b) => a[1].localeCompare(b[1], "es"));
  console.log(`${ordenadas.length} municipios:\n`);
  for (const [codigo, municipio] of ordenadas) {
    console.log("  " + codigo.padEnd(10) + municipio);
  }
  console.log(`\nLos datos de cada uno están en:\n  https://simuladoroficial.tsje.gov.py/datos/<codigo>/Candidaturas.json`);
  process.exit(0);
}

/* --------------------------------------------------------- carga de datos */
const dir = args.datos;
const categorias = leerJSON(join(dir, "Categorias.json"));
const agrupaciones = leerJSON(join(dir, "Agrupaciones.json"));
const candidaturas = leerJSON(join(dir, "Candidaturas.json"));

const codCategoria = typeof args.categoria === "string" ? args.categoria.toUpperCase() : "JUN";
const categoria = categorias.find(function (c) { return c.codigo === codCategoria; });
if (!categoria) {
  salirConAyuda("no existe la categoría " + codCategoria + ". Hay: " +
    categorias.map(function (c) { return c.codigo + " (" + c.nombre + ")"; }).join(", "));
}

/* ------------------------------------------------------------- conversión
 * Candidaturas trae, además de los candidatos, tres entradas especiales por
 * categoría — voto en blanco, nulos y no computados — que se distinguen por
 * `clase` y no tienen cod_lista. No son candidatos y quedan afuera.
 */
const deLaCategoria = candidaturas.filter(function (c) {
  return c.cod_categoria === codCategoria && c.clase === "Candidato" && c.cod_lista;
});

if (!deLaCategoria.length) {
  salirConAyuda("no hay candidatos en la categoría " + codCategoria);
}

const porLista = new Map();
for (const c of deLaCategoria) {
  if (!porLista.has(c.cod_lista)) porLista.set(c.cod_lista, []);
  porLista.get(c.cod_lista).push(c);
}

// Las agrupaciones se repiten por categoría (una entrada para intendente y
// otra para la junta), así que se toma la que corresponde a cada cod_lista.
const agrupacionPorCodigo = new Map(agrupaciones.map(function (a) { return [a.codigo, a]; }));

const listas = [...porLista.entries()]
  .sort(function (a, b) { return Number(a[0]) - Number(b[0]); })   // orden de la boleta
  .map(function (entrada, indice) {
    const [codLista, candidatos] = entrada;
    const agrupacion = agrupacionPorCodigo.get(codLista);
    if (!agrupacion) {
      console.error("Aviso: la lista " + codLista + " no figura en Agrupaciones.json");
    }

    candidatos.sort(function (a, b) { return (a.nro_orden || 0) - (b.nro_orden || 0); });

    const ordenes = candidatos.map(function (c) { return c.nro_orden; });
    const esperado = ordenes.map(function (_, i) { return i + 1; });
    if (JSON.stringify(ordenes) !== JSON.stringify(esperado)) {
      console.error("Aviso: la lista " + codLista + " tiene nro_orden con huecos o repetidos: " +
        ordenes.join(","));
    }

    return {
      numero: agrupacion ? Number(agrupacion.numero) : Number(codLista),
      partido: agrupacion ? agrupacion.nombre : "Lista " + codLista,
      sigla: agrupacion ? (agrupacion.nombre_corto || agrupacion.nombre) : "L" + codLista,
      color: indice % 8,                                    // respaldo de la paleta
      colorHex: agrupacion && Array.isArray(agrupacion.color) ? agrupacion.color[0] : null,
      votos: 0,
      soloLista: 0,
      candidatos: candidatos.map(function (c) { return { nombre: c.nombre, pref: 0 }; }),
    };
  });

const bancas = args.bancas
  ? Number(args.bancas)
  : listas.reduce(function (m, l) { return Math.max(m, l.candidatos.length); }, 0);

const salida = {
  eleccion: typeof args.eleccion === "string" ? args.eleccion : categoria.nombre,
  // Sólo los archivos que salen de acá llevan la atribución: las páginas no
  // le cuelgan el crédito al TSJE por nóminas que vengan de otro lado.
  fuente: {
    nombre: "simulador oficial del TSJE",
    url: "https://simuladoroficial.tsje.gov.py/",
  },
  bancas: bancas,
  umbral: 0,
  // La categoría declara si se vota con preferencia; para la Junta Municipal
  // viene preferente: true, que es el desbloqueo de la Ley 6318/2019.
  modo: categoria.preferente ? "desbloqueada" : "bloqueada",
  blancos: 0,
  nulos: 0,
  listas: listas,
};

const texto = JSON.stringify(salida, null, 2) + "\n";
const totalCandidatos = listas.reduce(function (s, l) { return s + l.candidatos.length; }, 0);
const resumen = `${listas.length} listas, ${totalCandidatos} candidatos, ${bancas} bancas`;

if (typeof args.salida === "string") {
  writeFileSync(args.salida, texto);
  console.error(resumen + " → " + args.salida);
} else if (typeof args.js !== "string") {
  process.stdout.write(texto);
}

if (typeof args.js === "string") {
  // Script clásico, no módulo: así las páginas siguen funcionando con file://,
  // donde un import ES sería bloqueado por CORS.
  writeFileSync(args.js,
    "/* Generado por tools/tsje-a-json.mjs a partir de los datos del simulador\n" +
    " * oficial del TSJE. No editar a mano: volvé a correr el conversor.\n" +
    " *\n" +
    " * " + resumen + "\n" +
    " */\n" +
    "var DATOS_ASUNCION = " + JSON.stringify(salida, null, 2) + ";\n");
  console.error(resumen + " → " + args.js);
}
