/* Verifica los datos generados desde el simulador del TSJE:
 *   node tests/datos.test.mjs
 * Comprueba que las nóminas estén completas y sin relleno, que el reparto de
 * una elección real dé lo que dio, y que la elección con la que se abre la
 * página no diga nada de ninguna elección de verdad. */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { normalizar, calcularDHondt, ordenInterno, detalleOrden, datosPorDefecto, normalizarHex,
        ajustarParaFondo, contraste, FONDO_CLARO, FONDO_OSCURO, CONTRASTE_MINIMO } = require("../js/core.js");

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
console.log("\nSenadores 2023: resultados oficiales");
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

/* Y los 45 nombres, en el orden en que se adjudicó cada banca. La lista oficial
 * de electos vive acá y no en datos/senadores-2023.json a propósito: el archivo
 * que carga la calculadora trae los votos, no el resultado. Quién ganó es lo
 * que tiene que salir de la cuenta.
 *
 * Los nombres del JSON salen del PDF del TSJE y vienen cortados a lo ancho de
 * la columna, así que se compara por prefijo contra el nombre oficial entero. */
console.log("\nSenadores 2023: los 45 electos, banca por banca");
{
  // orden | nombre | nro de lista | votos preferentes
  const oficiales = [
    [1, "SILVIO ADALBERTO OVELAR BENITEZ", 1, 282237],
    [2, "ENRIQUE SALYN CONCEPCION BUZARQUIS CACERES", 2, 125096],
    [3, "DERLIS HERNAN MAIDANA ZARZA", 1, 76066],
    [4, "JUAN CARLOS BARUJA FERNANDEZ", 1, 71867],
    [5, "SERGIO ROBERTO ROJAS SOSA", 2, 71072],
    [6, "RAMONA YOLANDA PAREDES", 911, 141102],
    [7, "LUIS ALBERTO PETTENGILL VACCA", 1, 61168],
    [8, "DERLIS ARIEL ALEJANDRO OSORIO NUNES", 1, 57361],
    [9, "EDGAR IDALINO LOPEZ RUIZ", 2, 63077],
    [10, "OSCAR RUBEN SALOMON FERNANDEZ", 1, 56504],
    [11, "REGINA LIZARELLA VALIENTE CABRERA", 1, 56047],
    [12, "CELESTE JOSEFINA AMARILLA VDA DE BOCCIA", 2, 42207],
    [13, "RAFAEL ESQUIVEL", 911, 51443],
    [14, "LILIAN GRACIELA SAMANIEGO GONZALEZ", 1, 54750],
    [15, "KATTYA MABEL GONZALEZ VILLANUEVA", 9, 100155],
    [16, "CARLOS NUÑEZ AGUERO", 1, 54498],
    [17, "EVER FEDERICO VILLALBA BENITEZ", 2, 37734],
    [18, "MARIO ALBERTO VARELA CARDOZO", 1, 47925],
    [19, "ARNALDO SAMANIEGO GONZALEZ", 1, 35022],
    [20, "EDUARDO HIROHITO NAKAYAMA ROJAS", 2, 28499],
    [21, "JOSE DANIEL OVIEDO ANTUNEZ", 911, 18100],
    [22, "CARLOS ALCIBIADES GIMENEZ DIAZ", 1, 33729],
    [23, "BASILIO GUSTAVO NUÑEZ GIMENEZ", 1, 31631],
    [24, "RAFAEL AUGUSTO FILIZZOLA SERRA", 2, 28251],
    [25, "NATALICIO ESTEBAN CHASE ACOSTA", 1, 30165],
    [26, "COLYM GREGORIO SOROKA BENITEZ", 1, 29555],
    [27, "HERMELINDA ALVARENGA DE ORTEGA", 2, 26296],
    [28, "ZENAIDA CONCEPCION DELGADO BENITEZ", 911, 12859],
    [29, "ERICO GALEANO SEGOVIA", 1, 27977],
    [30, "JOSE GREGORIO LEDESMA NARVAEZ", 2, 25241],
    [31, "HERNAN DAVID RIVAS ROMAN", 1, 25178],
    [32, "PATRICK PAUL KEMPER THIEDE", 9, 7315],
    [33, "ENRIQUE RIERA ESCUDERO", 1, 23598],
    [34, "ORLANDO PENNER DURKSEN", 8, 14185],
    [35, "DIONISIO OSWALDO AMARILLA GUIRLAND", 2, 24880],
    [36, "PEDRO ALEJANDRO DIAZ VERON", 1, 23059],
    [37, "NORMA BEATRIZ AQUINO LURAGHI", 911, 12637],
    [38, "ERNESTO JAVIER ZACARIAS IRUN", 1, 22567],
    [39, "LIDER SANTIAGO AMARILLA RIOS", 2, 24383],
    [40, "JUAN EUDES AFARA MACIEL", 1, 21302],
    [41, "ESPERANZA MARTINEZ DE PORTILLO", 40, 11735],
    [42, "BLANCA MARGARITA OVELAR DE DUARTE", 1, 17864],
    [43, "LOURDES NOELIA CABRERA PETTERS", 2, 22312],
    [44, "GUSTAVO ALFREDO LEITE GUSINKY", 1, 15978],
    [45, "ANTONIO RUBEN VELAZQUEZ CHAMORRO", 123, 18485],
  ];

  const s = leer("senadores-2023.json");
  const e = normalizar(s);
  const r = calcularDHondt(e.listas, e.bancas, e.umbral);

  // Cada ronda adjudica una banca a una lista: la ocupa el candidato que quedó
  // en ese lugar de su orden interno (la primera banca de la lista, la primera
  // de la nómina reordenada; la segunda, la segunda, y así).
  const porId = new Map(e.listas.map(function (l) { return [l.id, l]; }));
  const ordenes = new Map(e.listas.map(function (l) { return [l.id, ordenInterno(l, e.modo)]; }));
  const electos = r.rondas.map(function (ronda) {
    const l = porId.get(ronda.listaId);
    const c = l.candidatos[ordenes.get(l.id)[ronda.divisor - 1]];
    return { numero: l.numero, nombre: c.nombre, pref: c.pref };
  });

  // Mayúsculas, sin tildes y con los espacios colapsados: el PDF no es parejo.
  const clave = function (texto) {
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toUpperCase().replace(/\s+/g, " ").trim();
  };

  check("45 bancas adjudicadas", electos.length, 45);

  let malos = 0;
  oficiales.forEach(function (of, i) {
    const puesto = of[0];
    const obtenido = electos[i];
    if (!obtenido) { malos++; console.log("  FALLA  puesto " + puesto + ": no se adjudicó ninguna banca"); return; }
    // El nombre del JSON viene cortado, así que tiene que ser prefijo del
    // oficial; el oficial no se recorta.
    const ok = obtenido.numero === of[2] && obtenido.pref === of[3] &&
               clave(of[1]).startsWith(clave(obtenido.nombre)) && clave(obtenido.nombre) !== "";
    if (!ok) {
      malos++;
      console.log("  FALLA  puesto " + puesto +
        `\n           esperado ${of[1]} (lista ${of[2]}, ${of[3]} pref.)` +
        `\n           obtenido ${obtenido.nombre} (lista ${obtenido.numero}, ${obtenido.pref} pref.)`);
    }
  });
  check("los 45 electos, con nombre, lista y voto preferente, en el orden de adjudicación", malos, 0);
}

/* La segunda comprobación contra una elección real, y la más exigente: la
 * planilla de datos.gov.py trae los votos preferentes de cada candidato de las
 * Municipales 2021, así que acá no se verifica sólo cuántas bancas sacó cada
 * lista sino quiénes las ocuparon. Es lo único que prueba el orden interno
 * —ordenInterno y su desempate— contra un resultado oficial completo. */
console.log("\nJunta Municipal de Asunción 2021: resultados oficiales");
{
  const a = leer("asuncion-junta-municipal-2021.json");
  const e = normalizar(a);
  const cands = a.listas.flatMap(function (l) { return l.candidatos; });

  check("23 listas", a.listas.length, 23);
  check("24 bancas", a.bancas, 24);
  check("552 candidatos, 24 por lista", [cands.length, new Set(a.listas.map(function (l) {
    return l.candidatos.length; })).size], [552, 1]);
  check("246.844 votos válidos",
    a.listas.reduce(function (s, l) { return s + l.votos; }, 0), 246844);
  check("cada lista: los preferentes suman su total",
    a.listas.filter(function (l) {
      return l.candidatos.reduce(function (s, c) { return s + c.pref; }, 0) !== l.votos;
    }).length, 0);
  // La planilla es de votos preferentes y no trae blancos ni nulos.
  check("sin blancos ni nulos", [a.blancos, a.nulos], [0, 0]);

  const r = calcularDHondt(e.listas, e.bancas, e.umbral);
  const bancas = e.listas
    .filter(function (l) { return r.ganadas.get(l.id) > 0; })
    .map(function (l) { return [l.sigla, r.ganadas.get(l.id)]; })
    .sort(function (x, y) { return x[0].localeCompare(y[0]); });
  // Composición proclamada de la Junta de Asunción 2021-2026.
  check("reparto de las 24 bancas", bancas,
    [["ANR", 15], ["EC", 1], ["PLRA", 5], ["PPQ", 3]]);
  check("sin sorteos", r.empates.length, 0);

  /* Y los nombres. El voto preferente reordenó las cuatro nóminas que sacaron
   * banca, así que esta lista no es la que presentaron los partidos: es la que
   * salió de las urnas, y es la que la herramienta tiene que reproducir. */
  const electosDe = function (sigla) {
    const l = e.listas.find(function (x) { return x.sigla === sigla; });
    return detalleOrden(l, "desbloqueada", r.ganadas.get(l.id))
      .filter(function (d) { return d.electo; })
      .map(function (d) { return d.nombre; });
  };
  check("los 15 concejales de la ANR", electosDe("ANR"), [
    "LUIS FERNANDO BERNAL MAZO", "JORGE SALVADOR CAPPELLO BERNAL",
    "ENRIQUE JAVIER BERNI BRITEZ", "JUAN CARLOS OZORIO ADMEN",
    "CESAR EDUARDO ESCOBAR GUBO", "MARCELO FAUSTINO CENTURION VELILLA",
    "ROSANNA LUCIA ROLON VICIOSO", "CERVANTE JESUS MARIA LARA CESPEDES",
    "NASSER ESGAIB ORTEGA", "ARTURO RAMON ALMIRON CHAMORRO",
    "MARIANO ARIEL CACERES", "JOSE CLAUDIO MAXIMILIANO ALVARENGA BONZI",
    "JUAN JOSE ARNOLD GARCIA", "MIGUEL SOSA CABAÑAS", "RENE GABRIEL CALONGA ACEVEDO",
  ]);
  check("los 5 del PLRA", electosDe("PLRA"), [
    "AUGUSTO ISIDRO CONCEPCION WAGNER LEZCANO", "VICTOR RAMON ORTIZ ROMERO",
    "FELIX MANUEL AYALA RUIZ DIAZ", "HUMBERTO BLASCO GAVILAN",
    "FIORELLA MARIA FORESTIERI DE BUZARQUIS",
  ]);
  check("los 3 de Patria Querida", electosDe("PPQ"), [
    "PABLO MANUEL CALLIZO BEDOYA", "PAULINA BEATRIZ MARIA SERRANO GUSTAFSON",
    "ALVARO MATIAS GRAU MARTINEZ",
  ]);
  check("la banca de Encuentro Ciudadano", electosDe("EC"), ["JAZMIN MARIA GALEANO SAPENA"]);

  // El voto preferente movió gente de verdad: si esto diera 0, la nómina y el
  // resultado coincidirían y el caso no probaría el reordenamiento.
  const movidos = e.listas.reduce(function (s, l) {
    return s + detalleOrden(l, "desbloqueada", r.ganadas.get(l.id))
      .filter(function (d) { return d.movimiento !== 0; }).length;
  }, 0);
  check("el voto preferente reordenó buena parte de las nóminas", movidos > 400, true);
}

/* El ejemplo de Star Wars está armado para mostrar una cosa concreta: que las
 * bancas las gana la lista y no el candidato, así que con la lista bien votada
 * entran candidatos con un solo voto preferente. Si el cálculo cambiara y eso
 * dejara de pasar, el ejemplo dejaría de enseñar lo que el README dice que
 * enseña, y nadie lo notaría mirando el archivo. */
console.log("\nSenado Galáctico: electos con uno o dos votos");
{
  const g = leer("ejemplo-star-wars.json");
  const e = normalizar(g);
  const r = calcularDHondt(e.listas, e.bancas, e.umbral);
  const imperio = e.listas.find(function (l) { return l.sigla === "Imperio"; });
  const ganadas = r.ganadas.get(imperio.id);
  const orden = detalleOrden(imperio, "desbloqueada", ganadas);
  const electos = orden.filter(function (d) { return d.electo; });

  check("cada lista: los preferentes suman su total",
    e.listas.filter(function (l) {
      return l.soloLista + l.candidatos.reduce(function (a, c) { return a + c.pref; }, 0) !== l.votos;
    }).length, 0);
  // Si parte del total no nombrara a nadie, el ejemplo tendría una respuesta
  // fácil: que las bancas de los stormtroopers salieron de esos votos.
  check("ningún voto quedó sin nombrar a un candidato",
    e.listas.filter(function (l) { return l.soloLista !== 0; }).length, 0);
  check("el Imperio gana 5 bancas con 159.011 votos", [imperio.votos, ganadas], [159011, 5]);
  check("los 5 electos", electos.map(function (d) { return d.nombre; }), [
    "Darth Vader", "Sheev Palpatine",
    "Stormtrooper TD-9091", "Stormtrooper TK-421", "Stormtrooper TK-422",
  ]);
  // Lo que hace el ejemplo: bancas para candidatos con un voto propio.
  check("dos de esas bancas se llenan con un voto preferente cada una",
    electos.filter(function (d) { return d.pref === 1; }).length, 2);
  check("y el voto preferente igual da vuelta a los dos primeros",
    [electos[0].posOriginal, electos[1].posOriginal], [2, 1]);
  // TD-9091 iba último de doce y tiene un voto más que el resto de la tropa:
  // con esa diferencia se salta nueve lugares y entra.
  const td = electos[2];
  check("el último de la nómina entra con dos votos",
    [td.nombre, td.pref, td.posOriginal, td.posFinal],
    ["Stormtrooper TD-9091", 2, 12, 3]);
  // Los demás stormtroopers empatan en 1: el Artículo 258 resuelve a favor del
  // orden que propuso el partido, así que entran los primeros de la nómina.
  check("entre los que empatan en un voto, manda el orden de la nómina",
    electos.slice(3).map(function (d) { return d.posOriginal; }), [3, 4]);
}

console.log("\nEjemplo mínimo: nóminas completas");
{
  const e = normalizar(leer("ejemplo.json"));
  check("cada lista tiene tantos candidatos como bancas",
    e.listas.every(function (l) { return l.candidatos.length === e.bancas; }), true);
}

/* Con qué se abre la página en una ventana nueva, sin nada guardado. Es una
 * elección inventada y en cero a propósito: la herramienta no arranca diciendo
 * nada de ninguna elección real ni de ninguna ciudad en particular. */
console.log("\nLa elección con la que se abre");
{
  const d = datosPorDefecto();
  const cands = d.listas.flatMap(function (l) { return l.candidatos; });

  check("3 listas", d.listas.length, 3);
  check("12 bancas", d.bancas, 12);
  check("nóminas completas", cands.length, 36);
  check("todo en cero",
    d.listas.filter(function (l) { return l.votos !== 0 || l.soloLista !== 0; }).length +
    cands.filter(function (c) { return c.pref !== 0; }).length + d.blancos + d.nulos, 0);

  // Ninguna lista, sigla ni candidato puede coincidir con algo de verdad.
  check("listas sin nombre de partido real",
    d.listas.map(function (l) { return l.partido; }),
    ["Lista A", "Lista B", "Lista C"]);
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
