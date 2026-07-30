/* Pruebas del cálculo, sin dependencias: `node tests/dhondt.test.mjs`.
 * Cargan js/core.js tal cual lo usa el navegador. */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  calcularDHondt, ordenInterno, detalleOrden, sumaPreferentes,
  recalcularTotal, reconciliarSoloLista, normalizar,
} = require("../js/core.js");

let fallos = 0;

function L(defs) {
  return defs.map(function (d, i) { return { id: i + 1, sigla: d[0], votos: d[1] }; });
}
function bancasDe(res, listas) { return listas.map(function (l) { return res.ganadas.get(l.id); }); }

function check(nombre, obtenido, esperado) {
  const ok = JSON.stringify(obtenido) === JSON.stringify(esperado);
  if (!ok) fallos++;
  console.log((ok ? "  ok   " : "  FALLA") + "  " + nombre +
    (ok ? "" : `\n           esperado ${JSON.stringify(esperado)}, obtenido ${JSON.stringify(obtenido)}`));
}

console.log("\nReparto D'Hondt entre listas");

// Ejemplo canónico del método, 8 bancas
{
  const listas = L([["A", 100000], ["B", 80000], ["C", 30000], ["D", 20000]]);
  const res = calcularDHondt(listas, 8, 0);
  check("ejemplo canónico, 8 bancas", bancasDe(res, listas), [4, 3, 1, 0]);
}

// La suma de bancas siempre cierra
{
  let malas = 0;
  for (let t = 0; t < 2000; t++) {
    const nl = 2 + Math.floor(Math.random() * 9);
    const listas = L(Array.from({ length: nl }, function (_, i) {
      return ["L" + i, 1 + Math.floor(Math.random() * 200000)];
    }));
    const res = calcularDHondt(listas, 24, 0);
    if (listas.reduce(function (s, l) { return s + res.ganadas.get(l.id); }, 0) !== 24) malas++;
  }
  check("2000 casos aleatorios reparten las 24 bancas", malas, 0);
}

// Más votos nunca dan menos bancas
{
  let malas = 0;
  for (let t = 0; t < 2000; t++) {
    const nl = 2 + Math.floor(Math.random() * 7);
    const listas = L(Array.from({ length: nl }, function (_, i) {
      return ["L" + i, 1 + Math.floor(Math.random() * 100000)];
    }));
    const res = calcularDHondt(listas, 24, 0);
    for (const a of listas) for (const b of listas) {
      if (a.votos > b.votos && res.ganadas.get(a.id) < res.ganadas.get(b.id)) malas++;
    }
  }
  check("monotonía votos → bancas", malas, 0);
}

// Coincide con tomar los mayores cocientes por fuerza bruta
{
  let malas = 0;
  for (let t = 0; t < 500; t++) {
    const nl = 2 + Math.floor(Math.random() * 7);
    const listas = L(Array.from({ length: nl }, function (_, i) {
      return ["L" + i, 1 + Math.floor(Math.random() * 50000)];
    }));
    const bancas = 24;
    const cocientes = [];
    for (const l of listas) for (let d = 1; d <= bancas; d++) cocientes.push({ id: l.id, q: l.votos / d });
    cocientes.sort(function (a, b) { return b.q - a.q; });
    const esperado = new Map(listas.map(function (l) { return [l.id, 0]; }));
    cocientes.slice(0, bancas).forEach(function (c) { esperado.set(c.id, esperado.get(c.id) + 1); });
    const res = calcularDHondt(listas, bancas, 0);
    if (listas.some(function (l) { return res.ganadas.get(l.id) !== esperado.get(l.id); })) malas++;
  }
  check("coincide con los 24 mayores cocientes (fuerza bruta)", malas, 0);
}

console.log("\nEmpates, umbral y casos límite");

{
  const listas = L([["A", 100], ["B", 100], ["C", 100]]);
  const res = calcularDHondt(listas, 2, 0);
  check("empate a tres por 2 bancas: se avisa", res.empates.length > 0, true);
  check("empate: se reparten igual las 2 bancas",
    bancasDe(res, listas).reduce(function (a, b) { return a + b; }, 0), 2);
}
{
  const listas = L([["A", 100], ["B", 100]]);
  const res = calcularDHondt(listas, 2, 0);
  check("empate sin consecuencia: sin aviso", res.empates.length, 0);
  check("empate sin consecuencia: 1 y 1", bancasDe(res, listas), [1, 1]);
}
{
  const listas = L([["A", 60000], ["B", 30000], ["C", 4000]]);   // C: 4,26 % < 5 %
  const res = calcularDHondt(listas, 10, 5);
  check("umbral 5 % excluye a C", bancasDe(res, listas), [7, 3, 0]);
  check("umbral: C queda registrada como excluida",
    res.excluidas.map(function (l) { return l.sigla; }), ["C"]);
}
{
  const listas = L([["A", 500], ["B", 0]]);
  check("una sola lista con votos se lleva todo", bancasDe(calcularDHondt(listas, 24, 0), listas), [24, 0]);
}
{
  check("sin votos no se adjudica nada", calcularDHondt(L([["A", 0], ["B", 0]]), 24, 0).rondas.length, 0);
}
{
  const listas = L([["A", 92000], ["B", 61000], ["C", 28500], ["D", 15200]]);
  const res = calcularDHondt(listas, 24, 0);
  check("la última banca adjudicada cuesta al menos lo que la primera afuera",
    res.ultima.cociente >= res.siguiente.cociente, true);
}

console.log("\nOrden interno de la lista (voto preferente)");

function listaDe(prefs) {
  return {
    id: 1, sigla: "X", soloLista: 0, votos: 0,
    candidatos: prefs.map(function (p, i) { return { nombre: "C" + (i + 1), pref: p }; }),
  };
}

{
  const l = listaDe([10, 50, 30]);
  check("bloqueada: manda el orden de la nómina", ordenInterno(l, "bloqueada"), [0, 1, 2]);
  check("desbloqueada: ordena por votos preferentes", ordenInterno(l, "desbloqueada"), [1, 2, 0]);
}
{
  check("empate de preferentes: gana el orden original",
    ordenInterno(listaDe([40, 40, 40]), "desbloqueada"), [0, 1, 2]);
}
{
  check("sin votos preferentes no se reordena",
    ordenInterno(listaDe([0, 0, 0]), "desbloqueada"), [0, 1, 2]);
}
{
  const d = detalleOrden(listaDe([10, 50, 30, 5]), "desbloqueada", 2);
  check("detalle: posiciones finales", d.map(function (f) { return f.posFinal; }), [1, 2, 3, 4]);
  check("detalle: posiciones originales", d.map(function (f) { return f.posOriginal; }), [2, 3, 1, 4]);
  check("detalle: movimiento (+ subió, − bajó)", d.map(function (f) { return f.movimiento; }), [1, 1, -2, 0]);
  check("detalle: entran los dos primeros", d.map(function (f) { return f.electo; }), [true, true, false, false]);
  check("detalle: cuota sobre los preferentes de la lista",
    d.map(function (f) { return Math.round(f.cuota * 1000) / 1000; }), [0.526, 0.316, 0.105, 0.053]);
}
{
  const d = detalleOrden(listaDe([10, 20]), "bloqueada", 1);
  check("bloqueada: el detalle no mueve a nadie", d.map(function (f) { return f.movimiento; }), [0, 0]);
}

console.log("\nTotales de la lista (las dos páginas comparten el estado)");

{
  const l = listaDe([100, 200, 300]);
  l.soloLista = 400;
  check("total = sola lista + preferentes", recalcularTotal(l), 1000);
  check("suma de preferentes", sumaPreferentes(l), 600);
}
{
  // Lo que se cargó como total en la página por lista se reparte: lo que no
  // reclamó ningún candidato pasa a contarse como voto de sola lista.
  const l = listaDe([100, 200, 300]);
  l.votos = 1000;
  check("del total se deduce el voto de sola lista", reconciliarSoloLista(l), 400);
}
{
  const l = listaDe([600, 600]);
  l.votos = 1000;   // los preferentes superan al total declarado
  check("preferentes por encima del total: sola lista no queda negativo", reconciliarSoloLista(l), 0);
}
{
  let malas = 0;
  for (let t = 0; t < 500; t++) {
    const cant = 1 + Math.floor(Math.random() * 10);
    const l = listaDe(Array.from({ length: cant }, function () { return Math.floor(Math.random() * 5000); }));
    l.soloLista = Math.floor(Math.random() * 20000);
    const total = recalcularTotal(l);
    reconciliarSoloLista(l);
    if (recalcularTotal(l) !== total) malas++;
  }
  check("ida y vuelta entre vistas conserva el total", malas, 0);
}

console.log("\nLectura de archivos JSON");

{
  const e = normalizar({ listas: [{ partido: "Prueba", votos: 900, candidatos: ["Ana", "Bruno"] }] });
  check("candidatos como texto", e.listas[0].candidatos.map(function (c) { return c.nombre; }), ["Ana", "Bruno"]);
  check("preferentes por defecto en cero", e.listas[0].candidatos[0].pref, 0);
  check("sin «soloLista» se deduce del total", e.listas[0].soloLista, 900);
  check("bancas por defecto: las 24 de Asunción", e.bancas, 24);
}
{
  const e = normalizar({
    bancas: 3, umbral: 4.5, modo: "desbloqueada",
    listas: [{ partido: "P", sigla: "P", votos: 500, soloLista: 200,
               candidatos: [{ nombre: "Ana", pref: 300 }] }],
  });
  check("se respeta «soloLista» cuando viene en el archivo", e.listas[0].soloLista, 200);
  check("se respeta el umbral", e.umbral, 4.5);
  check("se respeta el modo", e.modo, "desbloqueada");
  check("se respeta la cantidad de bancas", e.bancas, 3);
}
{
  const e = normalizar({ listas: [{ partido: "P", votos: -50, candidatos: [" ", "Ana"] }] });
  check("votos negativos se recortan a cero", e.listas[0].votos, 0);
  check("los nombres vacíos se descartan", e.listas[0].candidatos.length, 1);
}
{
  let error = null;
  try { normalizar({ listas: [] }); } catch (e) { error = e.message; }
  check("un archivo sin listas se rechaza", error !== null, true);
}

console.log(fallos === 0 ? "\nTodo en orden.\n" : `\n${fallos} fallo(s).\n`);
process.exit(fallos === 0 ? 0 : 1);
