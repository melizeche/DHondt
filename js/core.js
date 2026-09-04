/* Calculadora D'Hondt: reparto de bancas por el método D'Hondt.
 * Copyright (C) 2026 melizeche
 *
 * Software libre bajo la Licencia Pública General Affero de GNU, versión 3 o
 * posterior, sin ninguna garantía. El texto completo está en LICENSE y en
 * <https://www.gnu.org/licenses/>.
 *
 * Núcleo compartido por index.html y candidatos.html: paleta, estado, cálculo
 * D'Hondt y utilidades de formato. Se carga como script clásico (sin módulos)
 * para que las páginas también funcionen abiertas con file://. */
"use strict";

/* ================================================================== paleta
 * Orden validado para contraste y separación bajo daltonismo en los dos
 * modos. El color acompaña siempre a la lista, nunca a su posición en el
 * ranking, y las secuencias se dibujan en orden de lista para conservar la
 * vecindad que se validó.
 * ================================================================== */
const PALETA = [
  { nombre: "rojo",     claro: "#e34948", oscuro: "#e66767" },
  { nombre: "azul",     claro: "#2a78d6", oscuro: "#3987e5" },
  { nombre: "naranja",  claro: "#eb6834", oscuro: "#d95926" },
  { nombre: "aqua",     claro: "#1baf7a", oscuro: "#199e70" },
  { nombre: "amarillo", claro: "#eda100", oscuro: "#c98500" },
  { nombre: "magenta",  claro: "#e87ba4", oscuro: "#d55181" },
  { nombre: "verde",    claro: "#008300", oscuro: "#008300" },
  { nombre: "violeta",  claro: "#4a3aa7", oscuro: "#9085e9" },
];

const BANCAS_POR_DEFECTO = 12;
const LISTAS_POR_DEFECTO = 3;
const NOMBRE_ELECCION_POR_DEFECTO = "Elección de ejemplo";

/* Las claves ya no llevan «asuncion»: la herramienta sirve para cualquier
 * elección y la de Asunción es una más de las que se pueden elegir. */
const CLAVE_ALMACEN = "dhondt-datos-v1";
const CLAVE_TEMA = "dhondt-tema";
const CLAVE_ELECCION = "dhondt-eleccion";

/* Carpeta con los conjuntos de datos y su índice. */
const RUTA_DATOS = "datos/";

let proximoId = 1;

function nuevoCandidato(nombre) {
  return { nombre: nombre, pref: 0 };
}

const RE_RELLENO = /^Candidato\/a \d+$/;

/* ¿La nómina que hay cargada es de relleno? Sirve para no advertir sobre
 * nombres inventados cuando en realidad están las candidaturas oficiales. */
function hayNombresDeRelleno() {
  return estado.listas.some(function (l) {
    return l.candidatos.some(function (c) { return RE_RELLENO.test(c.nombre); });
  });
}

function nominaPorDefecto(cantidad) {
  const out = [];
  for (let i = 1; i <= cantidad; i++) out.push(nuevoCandidato("Candidato/a " + i));
  return out;
}

/* Nómina de la elección de ejemplo. A propósito no dice «Candidato/a 1»: ese
 * patrón es el que la página busca para avisar que una nómina quedó sin
 * llenar (ver RE_RELLENO), y acá no hay nada a medio llenar. */
function nominaDeEjemplo(cantidad, letra) {
  const out = [];
  for (let i = 1; i <= cantidad; i++) out.push(nuevoCandidato("Nº " + i + " de la Lista " + letra));
  return out;
}

/* Con qué se abre cuando no hay nada guardado ni nada importado: una elección
 * inventada, con todo en cero.
 *
 * Antes acá venían las candidaturas de la Junta Municipal de Asunción, que era
 * lo que correspondía cuando la herramienta calculaba esa elección y ninguna
 * otra. Ahora calcula cualquiera y trae varios conjuntos de datos, así que abrir
 * siempre en una ciudad (y encima en la capital) dejaba de ser un valor por
 * defecto para pasar a ser una afirmación. Asunción sigue estando, en el
 * desplegable, al lado de las demás.
 *
 * Las listas se llaman A, B y C: así la calculadora no dice nada de nadie
 * hasta que alguien carga los votos. Para ver el reparto funcionando sin
 * inventar números a mano está «Votos al azar». */
function datosPorDefecto() {
  proximoId = 1;
  const listas = [];
  for (let i = 0; i < LISTAS_POR_DEFECTO; i++) {
    const letra = String.fromCharCode(65 + i);
    listas.push({
      id: proximoId++,
      numero: i + 1,
      partido: "Lista " + letra,
      sigla: letra,
      color: i % PALETA.length,
      colorHex: null,
      votos: 0,
      soloLista: 0,
      abierta: false,
      candidatos: nominaDeEjemplo(BANCAS_POR_DEFECTO, letra),
    });
  }
  return {
    eleccion: NOMBRE_ELECCION_POR_DEFECTO,
    fuente: null,
    bancas: BANCAS_POR_DEFECTO,
    umbral: 0,
    // Es como se vota hoy en Paraguay desde la Ley 6318/2019, y deja ver de
    // entrada lo que hace la página por candidato.
    modo: "desbloqueada",
    blancos: 0,
    nulos: 0,
    listas: listas,
  };
}

/* ============================================================ votos al azar
 * Sortea un resultado para tener algo que repartir. No son datos reales ni un
 * pronóstico: son números inventados.
 *
 * Lo que importa no son los números sino la forma. Con totales parejos todas
 * las listas saldrían parecidas y el reparto se vería proporcional, que es
 * justo lo que D'Hondt no hace; la gracia de volver a tirar es ver una y otra
 * vez lo mismo: que la lista grande se lleva más bancas que votos, que la
 * cola queda afuera y que la última banca se define por poco. Un electorado
 * real es desparejo, así que los totales salen de un perfil que cae de una
 * lista a la siguiente y recién después se reparte al azar entre ellas, para
 * que no gane siempre la primera de la boleta.
 * ================================================================== */

/* Cuánto conserva cada escalón del anterior. Entre listas la caída es fuerte
 * (de la primera a la segunda puede haber menos de la mitad); entre los
 * candidatos de una misma lista es suave, para que el voto preferente no se
 * concentre en dos nombres y el resto de la nómina quede en cero. */
const CAIDA_LISTAS = [0.45, 0.85];
const CAIDA_PREFERENTES = [0.70, 0.95];
/* Votos válidos por banca en juego: Asunción reparte 24 con unos 250.000. */
const VOTOS_POR_BANCA = [6000, 18000];
/* Parte del total de una lista que la votó sin nombrar a ningún candidato. */
const CUOTA_SOLO_LISTA = [0.30, 0.60];
/* Blancos y nulos sobre los válidos. En el Senado 2023 fueron 4,2 % y 0,5 %. */
const CUOTA_BLANCOS = [0.015, 0.045];
const CUOTA_NULOS = [0.003, 0.012];
/* Dónde deja de caer la cola, como fracción de la lista más votada. Sin este
 * piso, con 18 listas la última queda en cero; con un piso fijo, las últimas
 * quedan todas en el mismo número, que se nota inventado. Por eso el piso se
 * sortea para cada una. */
const PISO_DE_LA_COLA = [0.0005, 0.004];

function azarEntre(rango, azar) {
  return rango[0] + azar() * (rango[1] - rango[0]);
}

function mezclar(arreglo, azar) {
  for (let i = arreglo.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    const t = arreglo[i]; arreglo[i] = arreglo[j]; arreglo[j] = t;
  }
  return arreglo;
}

/* Pesos que caen de uno al siguiente y quedan mezclados: el perfil es
 * desparejo, pero a quién le toca cada lugar lo decide el sorteo. */
function perfilDesparejo(cantidad, caida, piso, azar) {
  const pesos = [];
  let peso = 1;
  for (let i = 0; i < cantidad; i++) {
    pesos.push(piso ? Math.max(peso, azarEntre(piso, azar)) : peso);
    peso *= azarEntre(caida, azar);
  }
  return mezclar(pesos, azar);
}

function repartirPorPesos(total, pesos, piso) {
  const suma = pesos.reduce(function (a, b) { return a + b; }, 0);
  return pesos.map(function (p) {
    return Math.max(piso || 0, Math.round((total * p) / suma));
  });
}

/* El voto preferente sólo se nota si el orden cambia. Si el más votado cayera
 * justo en el primero de la nómina no habría reordenamiento que mostrar, así
 * que en ese caso los dos primeros se permutan entre sí, y el perfil sorteado
 * queda igual salvo por ese cambio de lugar. La comparación es >= porque un
 * empate de preferentes lo resuelve la nómina (ver ordenInterno), y ahí el
 * primero volvería a ganar. */
function destronarAlPrimero(candidatos, azar) {
  if (candidatos.length < 2) return;
  let mayor = 1;
  for (let i = 2; i < candidatos.length; i++) {
    if (candidatos[i].pref > candidatos[mayor].pref) mayor = i;
  }
  if (candidatos[mayor].pref === 0) return;          // nadie recibió preferentes
  if (candidatos[0].pref < candidatos[mayor].pref) return;
  const t = candidatos[0].pref;
  candidatos[0].pref = candidatos[mayor].pref;
  candidatos[mayor].pref = t;
  // Quedaron iguales: hace falta un voto de diferencia para romper el empate.
  if (candidatos[mayor].pref === candidatos[0].pref) candidatos[mayor].pref++;
}

/* Reparte el total de una lista entre voto de sola lista y preferentes. Con la
 * lista bloqueada no hay preferentes que sortear: todo es voto de lista. */
function sortearLista(lista, total, desbloqueada, azar) {
  const cant = lista.candidatos.length;
  if (!desbloqueada || !cant) {
    lista.candidatos.forEach(function (c) { c.pref = 0; });
    lista.soloLista = total;
    return recalcularTotal(lista);
  }

  const aRepartir = Math.round(total * (1 - azarEntre(CUOTA_SOLO_LISTA, azar)));
  // Sin piso: que el final de la nómina no saque ni un voto preferente es
  // exactamente lo que pasa en una elección de verdad.
  const pesos = perfilDesparejo(cant, CAIDA_PREFERENTES, null, azar);
  const votos = repartirPorPesos(aRepartir, pesos, 0);
  lista.candidatos.forEach(function (c, j) { c.pref = votos[j]; });
  destronarAlPrimero(lista.candidatos, azar);

  // El total sorteado es una intención: lo que manda es la suma, así que el
  // resto (lo que no fue a ningún candidato) se cuenta como voto de lista.
  lista.soloLista = Math.max(0, total - sumaPreferentes(lista));
  return recalcularTotal(lista);
}

/* Sortea votos para todas las listas de un estado, en su lugar. `azar` existe
 * para las pruebas: con un generador propio el sorteo es repetible. */
function sortearVotos(destino, azar) {
  azar = azar || Math.random;
  const listas = destino.listas || [];
  if (!listas.length) return destino;

  const validos = Math.round(destino.bancas * azarEntre(VOTOS_POR_BANCA, azar));
  const pesos = perfilDesparejo(listas.length, CAIDA_LISTAS, PISO_DE_LA_COLA, azar);
  const totales = repartirPorPesos(validos, pesos, 1);
  const desbloqueada = destino.modo === "desbloqueada";

  listas.forEach(function (lista, i) { sortearLista(lista, totales[i], desbloqueada, azar); });

  const suma = listas.reduce(function (s, l) { return s + l.votos; }, 0);
  destino.blancos = Math.round(suma * azarEntre(CUOTA_BLANCOS, azar));
  destino.nulos = Math.round(suma * azarEntre(CUOTA_NULOS, azar));
  return destino;
}

/* ¿Los votos que hay en pantalla salen de un sorteo? Volver a tirar es la
 * gracia del botón, así que no se pregunta dos veces; pisar los votos que
 * vinieron con la elección (los reales de 2023, por ejemplo) o los que cargó
 * alguien a mano sí tiene que costar un clic más. No se guarda en el
 * navegador: después de recargar se vuelve a preguntar una vez, que es el
 * lado seguro de equivocarse. */
let votosSorteados = false;

function confirmarSorteo() {
  if (votosSorteados || !hayVotosCargados()) return true;
  return confirm("Se reemplazan los votos cargados por un sorteo. ¿Continuar?");
}

/* ================================================================== estado */
let estado = null;

/* Queda en true cuando el estado se recuperó del navegador, y no cuando se
 * armó de cero. Sirve para distinguir «primera visita» de «el usuario dejó
 * las cosas así», que no se tratan igual. */
let estadoRestaurado = false;

function cargarEstado() {
  estadoRestaurado = false;
  try {
    const crudo = localStorage.getItem(CLAVE_ALMACEN);
    if (crudo) {
      const recuperado = normalizar(JSON.parse(crudo));
      estadoRestaurado = true;
      return recuperado;
    }
  } catch (e) { /* dato corrupto o almacenamiento bloqueado: arrancamos limpio */ }
  return datosPorDefecto();
}

function guardar() {
  try {
    localStorage.setItem(CLAVE_ALMACEN, JSON.stringify(estado));
  } catch (e) { /* sin almacenamiento: seguimos solo en memoria */ }
}

/* Acepta tanto el formato que exporta la app como uno abreviado escrito a
 * mano: `candidatos` puede venir como textos o como {nombre, pref}. */
function normalizar(bruto) {
  if (!bruto || typeof bruto !== "object") throw new Error("formato inválido");
  const listasBrutas = Array.isArray(bruto.listas) ? bruto.listas : [];
  if (!listasBrutas.length) throw new Error("el archivo no contiene listas");

  proximoId = 1;
  const bancas = clampInt(bruto.bancas, 1, 99, BANCAS_POR_DEFECTO);

  const listas = listasBrutas.map(function (l, i) {
    const crudos = Array.isArray(l.candidatos) ? l.candidatos : [];
    let candidatos = crudos.map(function (c) {
      if (typeof c === "string") return nuevoCandidato(c.trim());
      return {
        nombre: String((c && c.nombre) || "").trim(),
        pref: clampInt(c && c.pref, 0, 1e12, 0),
      };
    }).filter(function (c) { return c.nombre !== ""; });
    if (!candidatos.length) candidatos = nominaPorDefecto(bancas);

    const lista = {
      id: proximoId++,
      numero: clampInt(l.numero, 0, 9999, i + 1),
      partido: String(l.partido || l.nombre || ("Lista " + (i + 1))).trim(),
      sigla: String(l.sigla || "").trim() || siglaDe(String(l.partido || l.nombre || ("L" + (i + 1)))),
      color: clampInt(l.color, 0, PALETA.length - 1, i % PALETA.length),
      colorHex: normalizarHex(l.colorHex),
      votos: clampInt(l.votos, 0, 1e12, 0),
      soloLista: clampInt(l.soloLista, 0, 1e12, -1),
      // Estado de la interfaz, no del dato: se guarda en el navegador para que
      // recargar no cierre lo que estaba abierto, y se saca de lo que se
      // exporta. Un archivo importado no la trae y arranca cerrada.
      abierta: l.abierta === true,
      candidatos: candidatos,
    };
    // Si el archivo no trae "solo lista", se deduce del total para que las dos
    // páginas muestren la misma cantidad de votos.
    if (lista.soloLista < 0) lista.soloLista = Math.max(0, lista.votos - sumaPreferentes(lista));
    return lista;
  });

  const fuente = bruto.fuente && typeof bruto.fuente === "object" && bruto.fuente.nombre
    ? { nombre: String(bruto.fuente.nombre), url: urlHttp(bruto.fuente.url) }
    : null;

  return {
    eleccion: String(bruto.eleccion || "Elección sin nombre"),
    fuente: fuente,
    bancas: bancas,
    umbral: clampNum(bruto.umbral, 0, 20, 0),
    modo: bruto.modo === "desbloqueada" ? "desbloqueada" : "bloqueada",
    blancos: clampInt(bruto.blancos, 0, 1e12, 0),
    nulos: clampInt(bruto.nulos, 0, 1e12, 0),
    listas: listas,
  };
}

function clampInt(valor, min, max, porDefecto) {
  const num = Math.floor(Number(valor));
  if (!isFinite(num)) return porDefecto;
  return Math.min(max, Math.max(min, num));
}

function clampNum(valor, min, max, porDefecto) {
  const num = Number(valor);
  if (!isFinite(num)) return porDefecto;
  return Math.min(max, Math.max(min, num));
}

function siglaDe(texto) {
  const palabras = texto.split(/\s+/).filter(function (p) { return p.length > 2; });
  return palabras.slice(0, 3).map(function (p) { return p[0].toUpperCase(); }).join("") || "L";
}

/* La URL de la fuente termina en un enlace de la página, así que sólo se
 * aceptan direcciones http(s): un archivo importado no puede colar un
 * «javascript:» que se ejecute al hacer clic. */
function urlHttp(valor) {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim();
  return /^https?:\/\//i.test(limpio) ? limpio : null;
}

function normalizarHex(valor) {
  if (typeof valor !== "string") return null;
  const m = valor.trim().match(/^#?([0-9a-fA-F]{6})$/);
  return m ? "#" + m[1].toLowerCase() : null;
}

/* ========================================================= color oficial
 * Los datos del TSJE traen el color de cada lista tal como aparece en la
 * boleta. Se usan esos, porque son los que el votante reconoce, pero algunos
 * no se ven contra el fondo (el PDC es blanco): a esos se les corrige la
 * luminosidad, conservando el tono, hasta que se distingan. El hex original
 * nunca se pisa: sigue en los datos y se muestra al editar la lista.
 * ================================================================== */
const FONDO_CLARO = "#fcfcfb";
const FONDO_OSCURO = "#1a1a19";
const CONTRASTE_MINIMO = 3;

function aRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function luminanciaRelativa(hex) {
  const canales = aRgb(hex).map(function (v) {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * canales[0] + 0.7152 * canales[1] + 0.0722 * canales[2];
}

function contraste(hexA, hexB) {
  const a = luminanciaRelativa(hexA);
  const b = luminanciaRelativa(hexB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function rgbAHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslAHex(h, s, l) {
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const canal = function (t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    r = canal(h + 1 / 3); g = canal(h); b = canal(h - 1 / 3);
  }
  const hex = function (v) { return Math.round(v * 255).toString(16).padStart(2, "0"); };
  return "#" + hex(r) + hex(g) + hex(b);
}

/* Distancia perceptual entre dos colores, en OKLab (×100).
 *
 * El umbral no pretende que todas las listas se distingan entre sí: con siete
 * o nueve eso no lo logra ninguna paleta, y por eso nada acá depende sólo del
 * color (cada segmento de la cinta va rotulado, hay leyenda con siglas y las
 * tablas son de texto). Lo que marca es el caso patológico: dos colores tan
 * parecidos que se leen como el mismo, y hacen ver rota la cinta. La boleta de
 * Encarnación trae tres amarillos a ΔE 1.8 entre sí. */
const SEPARACION_MINIMA = 10;

function aOklab(hex) {
  const lineal = aRgb(hex).map(function (v) {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  const r = lineal[0], g = lineal[1], b = lineal[2];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

function distanciaColor(hexA, hexB) {
  const a = aOklab(hexA), b = aOklab(hexB);
  return Math.sqrt(
    Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2) + Math.pow(a[2] - b[2], 2)) * 100;
}

/* ¿Se distinguen en los dos modos, ya corregidos contra su fondo? */
function seDistinguen(hexA, hexB) {
  return distanciaColor(ajustarParaFondo(hexA, false), ajustarParaFondo(hexB, false)) >= SEPARACION_MINIMA &&
         distanciaColor(ajustarParaFondo(hexA, true), ajustarParaFondo(hexB, true)) >= SEPARACION_MINIMA;
}

const cacheColores = new Map();

function ajustarParaFondo(hex, oscuro) {
  const clave = hex + (oscuro ? "|d" : "|l");
  if (cacheColores.has(clave)) return cacheColores.get(clave);

  const fondo = oscuro ? FONDO_OSCURO : FONDO_CLARO;
  let salida = hex;

  if (contraste(hex, fondo) < CONTRASTE_MINIMO) {
    const hsl = rgbAHsl.apply(null, aRgb(hex));
    // en fondo claro hay que oscurecer; en fondo oscuro, aclarar
    const paso = oscuro ? 0.02 : -0.02;
    let l = hsl[2];
    for (let i = 0; i < 50; i++) {
      l += paso;
      if (l <= 0 || l >= 1) break;
      const intento = hslAHex(hsl[0], hsl[1], l);
      if (contraste(intento, fondo) >= CONTRASTE_MINIMO) { salida = intento; break; }
      salida = intento;
    }
  }

  cacheColores.set(clave, salida);
  return salida;
}

/* ======================================================== votos por lista
 * El total de una lista son los votos que sólo la eligieron a ella más los
 * que además nombraron a un candidato. Las dos páginas trabajan sobre el
 * mismo estado, así que hace falta poder ir y volver entre las dos vistas
 * sin perder votos.
 * ================================================================== */
function sumaPreferentes(lista) {
  return lista.candidatos.reduce(function (s, c) { return s + c.pref; }, 0);
}

/* Vista por candidato → total de la lista. */
function recalcularTotal(lista) {
  lista.votos = lista.soloLista + sumaPreferentes(lista);
  return lista.votos;
}

/* Total de la lista → vista por candidato: lo que no está atribuido a ningún
 * candidato pasa a contarse como voto de sola lista. */
function reconciliarSoloLista(lista) {
  lista.soloLista = Math.max(0, lista.votos - sumaPreferentes(lista));
  return lista.soloLista;
}

/* ================================================================= D'Hondt
 * Adjudicación banca por banca. Las comparaciones usan productos cruzados de
 * enteros en lugar de divisiones, para que un empate exacto se detecte como
 * tal y no quede escondido detrás de un error de punto flotante.
 * ================================================================== */
function calcularDHondt(listas, bancas, umbralPct) {
  const votosValidos = listas.reduce(function (s, l) { return s + l.votos; }, 0);
  const minimo = votosValidos * (umbralPct / 100);

  const habilitadas = listas.filter(function (l) { return l.votos > 0 && l.votos >= minimo; });
  const excluidas = listas.filter(function (l) { return l.votos > 0 && l.votos < minimo; });

  const ganadas = new Map(listas.map(function (l) { return [l.id, 0]; }));
  const rondas = [];
  const empates = [];

  for (let ronda = 1; ronda <= bancas; ronda++) {
    let mejor = null;
    let empatadas = [];

    for (let i = 0; i < habilitadas.length; i++) {
      const l = habilitadas[i];
      const d = ganadas.get(l.id) + 1;
      if (!mejor) { mejor = { lista: l, divisor: d }; empatadas = [l]; continue; }
      // l.votos / d  contra  mejor.lista.votos / mejor.divisor
      const cmp = l.votos * mejor.divisor - mejor.lista.votos * d;
      if (cmp > 0) { mejor = { lista: l, divisor: d }; empatadas = [l]; }
      else if (cmp === 0) {
        // Artículo 258: a igual cociente la banca va a la lista con más votos.
        // Dos listas con distinto total pueden empatar en un cociente (100/1 y
        // 200/2 dan 100), así que esto no es un caso raro. Recién si también
        // empatan en votos hay sorteo.
        if (l.votos > mejor.lista.votos) { mejor = { lista: l, divisor: d }; empatadas = [l]; }
        else if (l.votos === mejor.lista.votos) { empatadas.push(l); }
      }
    }

    if (!mejor) break;

    const restantes = bancas - ronda + 1;
    if (empatadas.length > 1 && empatadas.length > restantes) {
      empates.push({
        ronda: ronda,
        cociente: mejor.lista.votos / mejor.divisor,
        listas: empatadas.slice(),
        enDisputa: restantes,
      });
    }

    ganadas.set(mejor.lista.id, mejor.divisor);
    rondas.push({
      ronda: ronda,
      listaId: mejor.lista.id,
      divisor: mejor.divisor,
      cociente: mejor.lista.votos / mejor.divisor,
    });
  }

  // Cociente de la primera banca que quedó sin adjudicar: cuánto costaba la
  // banca siguiente, para ver qué tan cerca quedó cada lista.
  let siguiente = null;
  for (let i = 0; i < habilitadas.length; i++) {
    const l = habilitadas[i];
    const q = l.votos / (ganadas.get(l.id) + 1);
    if (!siguiente || q > siguiente.cociente) siguiente = { lista: l, cociente: q };
  }

  return {
    votosValidos: votosValidos,
    ganadas: ganadas,
    rondas: rondas,
    empates: empates,
    excluidas: excluidas,
    ultima: rondas.length ? rondas[rondas.length - 1] : null,
    siguiente: siguiente,
  };
}

/* Orden interno de una lista: el de la nómina si está bloqueada, o por votos
 * preferentes de mayor a menor si está desbloqueada. Los empates de votos
 * preferentes se resuelven a favor del orden original de la nómina. */
function ordenInterno(lista, modo) {
  const indices = lista.candidatos.map(function (_, i) { return i; });
  if (modo === "desbloqueada") {
    indices.sort(function (a, b) {
      const d = lista.candidatos[b].pref - lista.candidatos[a].pref;
      return d !== 0 ? d : a - b;
    });
  }
  return indices;
}

/* Detalle del reordenamiento de una lista: quién estaba en qué lugar, adónde
 * fue a parar y quién entra con las bancas que la lista ganó. */
function detalleOrden(lista, modo, bancasGanadas) {
  const orden = ordenInterno(lista, modo);
  const total = sumaPreferentes(lista);
  return orden.map(function (idxOriginal, posicion) {
    const c = lista.candidatos[idxOriginal];
    return {
      candidato: c,
      nombre: c.nombre,
      pref: c.pref,
      cuota: total > 0 ? c.pref / total : 0,
      posOriginal: idxOriginal + 1,
      posFinal: posicion + 1,
      movimiento: idxOriginal - posicion,   // > 0 subió, < 0 bajó
      electo: posicion < bancasGanadas,
    };
  });
}

/* ================================================================ formato */
const fmtEntero = new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 });
const fmtDecimal = new Intl.NumberFormat("es-PY", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtCociente = new Intl.NumberFormat("es-PY", { maximumFractionDigits: 1 });

function n(valor) { return fmtEntero.format(Math.round(valor)); }

/* «1 banca» y no «1 banca(s)». El paréntesis es una forma de no elegir, y acá
 * el número siempre se sabe antes de escribir la frase. */
function nBancas(cantidad) {
  return cantidad + (cantidad === 1 ? " banca" : " bancas");
}

function nListas(cantidad) {
  return cantidad + (cantidad === 1 ? " lista" : " listas");
}

function nCandidatos(cantidad) {
  return cantidad + (cantidad === 1 ? " candidato" : " candidatos");
}

function pct(parte, total) {
  return total > 0 ? fmtDecimal.format((parte / total) * 100) + " %" : "—";
}

/* --------------------------------------------- campos de cantidad de votos */
/* Los votos se escriben con separador de miles: 1.319.617 se lee de un vistazo
 * y 1319617 hay que contarlo con el dedo. Eso obliga a que el campo sea de
 * texto y no <input type="number">, porque un campo numérico descarta como
 * inválido cualquier valor con separadores. Se compensa con inputmode e
 * enterkeyhint, que son los que deciden qué teclado abre el teléfono.
 *
 * Lo que se escribe se lee siempre con enteroDeTexto: cualquier cosa que no sea
 * un dígito se ignora, así da igual si el separador que tipeó la persona es el
 * punto, la coma o un espacio. */
const ATRIBUTOS_CAMPO_VOTOS = {
  type: "text", inputmode: "numeric", enterkeyhint: "done", autocomplete: "off",
};

function enteroDeTexto(valor) {
  const digitos = String(valor === null || valor === undefined ? "" : valor).replace(/\D+/g, "");
  return digitos === "" ? 0 : clampInt(digitos, 0, 1e12, 0);
}

/* Reescribe el campo con los separadores puestos y deja el cursor donde
 * estaba, contado en dígitos: si se inserta un punto a la izquierda del
 * cursor, el cursor tiene que correrse con él. Devuelve el valor ya leído. */
function formatearCampoVotos(campo) {
  const antes = campo.value;
  const corte = campo.selectionStart === null ? antes.length : campo.selectionStart;
  const digitosAntes = antes.slice(0, corte).replace(/\D+/g, "").length;
  const valor = enteroDeTexto(antes);
  // Un campo vacío se deja vacío: se está por escribir otro número, y poner un
  // 0 obligaría a borrarlo antes de seguir.
  const texto = antes.replace(/\D+/g, "") === "" ? "" : n(valor);

  if (texto !== antes) {
    campo.value = texto;
    let i = 0;
    for (let vistos = 0; i < texto.length && vistos < digitosAntes; i++) {
      if (texto[i] >= "0" && texto[i] <= "9") vistos++;
    }
    try { campo.setSelectionRange(i, i); } catch (e) { /* el campo no tiene foco */ }
  }
  return valor;
}

/* Campo de votos armado: los atributos de arriba, el valor ya formateado y el
 * reformateo en cada tecla. «props» puede traer cualquier otro atributo (id,
 * class, aria-label) y también onchange, que el llamador usa para redibujar
 * recién cuando se termina de escribir. */
function campoDeVotos(props, alEscribir) {
  const atributos = Object.assign({}, ATRIBUTOS_CAMPO_VOTOS, props);
  atributos.class = "votos" + (props && props.class ? " " + props.class : "");
  atributos.value = n(clampInt(props && props.value, 0, 1e12, 0));
  const campo = el("input", atributos);
  campo.addEventListener("input", function () { alEscribir(formatearCampoVotos(campo)); });
  return campo;
}

/* ================================================================== tema */
function modoOscuro() {
  const t = document.documentElement.getAttribute("data-theme");
  if (t === "dark") return true;
  if (t === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function colorDe(lista) {
  if (lista.colorHex) return ajustarParaFondo(lista.colorHex, modoOscuro());
  const p = PALETA[lista.color] || PALETA[0];
  return modoOscuro() ? p.oscuro : p.claro;
}

/* Las notas desplegables se cierran al tocar afuera o con Escape, como
 * cualquier globo de ayuda: son un <details> y no un `title=` porque en el
 * teléfono el title no se puede abrir y con el teclado no se alcanza. */
function conectarAyudas() {
  function cerrar(salvo) {
    document.querySelectorAll("details.ayuda[open]").forEach(function (d) {
      if (!salvo || !d.contains(salvo)) d.open = false;
    });
  }
  document.addEventListener("click", function (ev) { cerrar(ev.target); });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") cerrar(null);
  });
}

/* Conecta el botón de tema y avisa a la página cuando cambia, porque los
 * colores de las listas se calculan en JS y hay que volver a dibujarlos. */
function inicializarTema(alCambiar) {
  try {
    const guardado = localStorage.getItem(CLAVE_TEMA);
    if (guardado) document.documentElement.setAttribute("data-theme", guardado);
  } catch (e) { /* sin almacenamiento: queda el tema del sistema */ }

  const boton = document.getElementById("btn-tema");
  if (boton) {
    boton.addEventListener("click", function () {
      const actual = document.documentElement.getAttribute("data-theme");
      const siguiente = actual === "dark" ? "light" : actual === "light" ? "" : (modoOscuro() ? "light" : "dark");
      if (siguiente) {
        document.documentElement.setAttribute("data-theme", siguiente);
        try { localStorage.setItem(CLAVE_TEMA, siguiente); } catch (e) {}
      } else {
        document.documentElement.removeAttribute("data-theme");
        try { localStorage.removeItem(CLAVE_TEMA); } catch (e) {}
      }
      alCambiar();
    });
  }

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
    if (!document.documentElement.getAttribute("data-theme")) alCambiar();
  });
}

/* =================================================================== DOM */
function el(tag, props, hijos) {
  const nodo = document.createElement(tag);
  if (props) {
    for (const k in props) {
      if (k === "class") nodo.className = props[k];
      else if (k === "text") nodo.textContent = props[k];
      else if (k.slice(0, 2) === "on") nodo.addEventListener(k.slice(2), props[k]);
      else if (props[k] !== null && props[k] !== undefined) nodo.setAttribute(k, props[k]);
    }
  }
  (hijos || []).forEach(function (h) {
    if (h === null || h === undefined || h === false) return;
    nodo.appendChild(typeof h === "string" ? document.createTextNode(h) : h);
  });
  return nodo;
}

/* Aviso de nóminas de relleno y procedencia de los datos. Las dos páginas lo
 * llaman en cada render, porque importar o editar cambia la respuesta. */
function renderProcedencia() {
  const aviso = document.getElementById("aviso-relleno");
  if (aviso) aviso.hidden = !hayNombresDeRelleno();

  // El encabezado es el nombre de la herramienta, que no depende de la
  // elección; cuál está cargada se dice acá.
  const titulo = document.getElementById("eleccion-actual");
  if (titulo) titulo.textContent = estado.eleccion;

  const origen = document.getElementById("origen-datos");
  if (!origen) return;
  origen.textContent = "";
  if (hayNombresDeRelleno()) return;

  const listas = estado.listas.length;
  const candidatos = estado.listas.reduce(function (s, l) { return s + l.candidatos.length; }, 0);
  origen.appendChild(document.createTextNode(
    estado.eleccion + " · " + nListas(listas) + ", " + nCandidatos(candidatos) + "."));

  // La atribución sólo sale si el archivo dice de dónde salieron las nóminas:
  // no se le puede colgar el crédito de unos datos cualesquiera al TSJE.
  if (estado.fuente && estado.fuente.nombre) {
    origen.appendChild(document.createTextNode(" Nóminas del "));
    if (estado.fuente.url) {
      origen.appendChild(el("a", {
        href: estado.fuente.url, target: "_blank", rel: "noopener",
        text: estado.fuente.nombre,
      }));
    } else {
      origen.appendChild(document.createTextNode(estado.fuente.nombre));
    }
    origen.appendChild(document.createTextNode("."));
  }

  origen.appendChild(document.createTextNode(
    " Los votos los ponés vos: esta herramienta no publica ni predice resultados."));
}

/* Selector de color de una lista. Si la lista trae el color oficial de la
 * boleta, ese va primero y queda elegido; los de la paleta lo reemplazan.
 *
 * No toca la lista: la elección queda en `borrador` y la aplica el diálogo al
 * guardar, así «Cancelar» cancela también el color. */
function renderSelectorColor(contenedor, lista, borrador) {
  contenedor.textContent = "";
  borrador.color = lista.color;
  borrador.colorHex = lista.colorHex;

  function marcar() {
    contenedor.querySelectorAll(".swatch").forEach(function (s) {
      const esOficial = s.dataset.oficial === "1";
      const elegido = esOficial ? !!borrador.colorHex
                                : !borrador.colorHex && Number(s.dataset.indice) === borrador.color;
      s.setAttribute("aria-pressed", elegido ? "true" : "false");
    });
  }

  if (lista.colorHex) {
    const boton = el("button", {
      type: "button", class: "swatch",
      style: "background:" + ajustarParaFondo(lista.colorHex, modoOscuro()),
      title: "Color oficial de la boleta (" + lista.colorHex + ")",
      "aria-label": "Color oficial de la boleta",
      // el botón «oficial» recupera el hex después de descartarlo
      onclick: function () { borrador.colorHex = lista.colorHex; marcar(); },
    });
    boton.dataset.oficial = "1";
    contenedor.appendChild(boton);
    contenedor.appendChild(el("span", {
      style: "width:1px; align-self:stretch; background:var(--border-strong); margin:0 4px",
    }));
  }

  PALETA.forEach(function (p, i) {
    const boton = el("button", {
      type: "button", class: "swatch",
      style: "background:" + (modoOscuro() ? p.oscuro : p.claro),
      title: p.nombre, "aria-label": "Color " + p.nombre,
      onclick: function () {
        borrador.color = i;
        borrador.colorHex = null;   // elegir de la paleta descarta el color oficial
        marcar();
      },
    });
    boton.dataset.indice = String(i);
    contenedor.appendChild(boton);
  });

  marcar();
}

/* Abre el diálogo «Editar lista» y, al guardar, aplica número, nombre, sigla
 * y color de una vez. Las dos páginas lo comparten. */
let listaEnEdicion = null;
const colorEnEdicion = { color: 0, colorHex: null };

function abrirDialogoLista(lista) {
  listaEnEdicion = lista;
  document.getElementById("dl-num").value = lista.numero;
  document.getElementById("dl-partido").value = lista.partido;
  document.getElementById("dl-sigla").value = lista.sigla;
  renderSelectorColor(document.getElementById("dl-colores"), lista, colorEnEdicion);
  document.getElementById("dlg-lista").showModal();
}

function conectarDialogoLista(alGuardar) {
  document.getElementById("dlg-lista").addEventListener("close", function (e) {
    if (e.target.returnValue === "ok" && listaEnEdicion) {
      const l = listaEnEdicion;
      l.numero = clampInt(document.getElementById("dl-num").value, 0, 9999, l.numero);
      l.partido = document.getElementById("dl-partido").value.trim() || l.partido;
      l.sigla = document.getElementById("dl-sigla").value.trim() || l.sigla;
      l.color = colorEnEdicion.color;
      l.colorHex = colorEnEdicion.colorHex;
      guardar();
    }
    listaEnEdicion = null;
    alGuardar();
  });
}

/* ============================================== importar / exportar JSON */

/* Nombre de archivo a partir del nombre de la elección, para que lo que se
 * baja describa lo que hay cargado y no una elección fija. */
function nombreDeArchivo(texto) {
  const limpio = (texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return limpio || "eleccion";
}

function exportarJSON(nombreArchivo) {
  const copia = JSON.parse(JSON.stringify(estado));
  copia.listas.forEach(function (l) { delete l.id; delete l.abierta; });
  const blob = new Blob([JSON.stringify(copia, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: nombreArchivo || nombreDeArchivo(estado.eleccion) + ".json" });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* =============================================== elegir otra elección
 * Los conjuntos de datos de `datos/` se traen con fetch, que es del mismo
 * origen y no necesita servidor propio... pero sí necesita *un* servidor:
 * con file:// el navegador lo bloquea por CORS. Por eso el que viene
 * embebido sigue siendo un script, para que abrir el HTML a mano funcione
 * igual, y el selector aparece sólo si se pudo leer el índice.
 * ================================================================== */
const VALOR_SIN_ARCHIVO = "";

/* La opción sin archivo del índice representa los datos embebidos o importados.
 * Lleva el nombre de la elección, no una etiqueta de estado. */
function actualizarMarcadorEleccion(sel, nombre) {
  const marcador = sel.querySelector('option[value=""]');
  if (marcador) marcador.textContent = nombre || estado.eleccion;
}

function recordarEleccion(archivo) {
  try {
    if (archivo) localStorage.setItem(CLAVE_ELECCION, archivo);
    else localStorage.removeItem(CLAVE_ELECCION);
  } catch (e) { /* sin almacenamiento: sólo se pierde cuál quedó elegida */ }
}

function eleccionRecordada() {
  try { return localStorage.getItem(CLAVE_ELECCION); } catch (e) { return null; }
}

function hayVotosCargados() {
  return estado.listas.some(function (l) {
    return l.votos > 0 || l.soloLista > 0 || sumaPreferentes(l) > 0;
  });
}

function conectarSelectorElecciones(idSelect, alCambiar) {
  const sel = document.getElementById(idSelect);
  if (!sel) return;
  const campo = sel.closest(".field") || sel;
  campo.hidden = true;   // hasta saber si hay índice que leer

  // Con file:// el fetch está condenado a fallar por CORS y sólo dejaría un
  // error en la consola, así que ni se intenta.
  if (location.protocol === "file:") return;

  fetch(RUTA_DATOS + "indice.json", { cache: "no-cache" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (indice) {
      const elecciones = (indice && indice.elecciones) || [];
      if (!elecciones.length) return;

      const recordada = eleccionRecordada();
      sel.textContent = "";
      // Para los datos embebidos o importados, que no salen de un archivo del
      // índice, la opción conserva igual el nombre de la elección. Si hay una
      // del índice elegida, queda disponible la elección de ejemplo.
      sel.appendChild(el("option", {
        value: VALOR_SIN_ARCHIVO,
        text: recordada ? NOMBRE_ELECCION_POR_DEFECTO : estado.eleccion,
      }));
      elecciones.forEach(function (e) {
        sel.appendChild(el("option", {
          value: e.archivo,
          text: e.nombre,
          title: e.detalle || "",
        }));
      });

      sel.value = elecciones.some(function (e) { return e.archivo === recordada; })
        ? recordada : VALOR_SIN_ARCHIVO;

      sel.addEventListener("change", function () {
        const archivo = sel.value;
        if (!archivo) {
          if (hayVotosCargados() &&
              !confirm("Volver a la elección de ejemplo reemplaza las listas y los votos que tengas cargados. ¿Continuar?")) {
            sel.value = eleccionRecordada() || VALOR_SIN_ARCHIVO;
            return;
          }
          restablecer();
          alCambiar();
          return;
        }
        if (hayVotosCargados() &&
            !confirm("Cargar otra elección reemplaza las listas y los votos que tengas cargados. ¿Continuar?")) {
          sel.value = eleccionRecordada() || VALOR_SIN_ARCHIVO;
          return;
        }
        cargarEleccion(archivo)
          .then(function () { alCambiar(); })
          .catch(function (err) {
            alert("No se pudo cargar esa elección: " + err.message);
            sel.value = eleccionRecordada() || VALOR_SIN_ARCHIVO;
          });
      });

      campo.hidden = false;
    })
    .catch(function () {
      /* Sin índice (file://, o el archivo no está) el selector no aparece y
         se sigue con los datos embebidos. Importar JSON sigue disponible. */
    });
}

/* «Restablecer»: vuelve a la elección de ejemplo. También olvida cuál estaba
 * elegida en el desplegable, que si no seguiría diciendo «Asunción» sobre una
 * página que ya no la muestra, y elegirla de nuevo no dispararía nada. */
function restablecer() {
  estado = datosPorDefecto();
  votosSorteados = false;
  recordarEleccion(null);
  const sel = document.getElementById("cfg-eleccion");
  if (sel) {
    actualizarMarcadorEleccion(sel);
    sel.value = VALOR_SIN_ARCHIVO;
  }
  guardar();
}

function cargarEleccion(archivo) {
  return fetch(RUTA_DATOS + archivo, { cache: "no-cache" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (bruto) {
      estado = normalizar(bruto);
      votosSorteados = false;   // lo que traiga el archivo no es un sorteo
      recordarEleccion(archivo);
      const sel = document.getElementById("cfg-eleccion");
      if (sel) actualizarMarcadorEleccion(sel, NOMBRE_ELECCION_POR_DEFECTO);
      guardar();
    });
}

function conectarImportacion(idBoton, idInput, alImportar) {
  const boton = document.getElementById(idBoton);
  const input = document.getElementById(idInput);
  if (!boton || !input) return;
  boton.addEventListener("click", function () { input.click(); });
  input.addEventListener("change", function (e) {
    const archivo = e.target.files && e.target.files[0];
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = function () {
      try {
        estado = normalizar(JSON.parse(String(lector.result)));
        votosSorteados = false;
        recordarEleccion(null);   // ya no corresponde a ningún archivo del índice
        const sel = document.getElementById("cfg-eleccion");
        if (sel) {
          actualizarMarcadorEleccion(sel);
          sel.value = VALOR_SIN_ARCHIVO;
        }
        guardar();
        alImportar();
      } catch (err) {
        alert("No se pudo leer el archivo: " + err.message);
      }
    };
    lector.readAsText(archivo);
    e.target.value = "";
  });
}

/* Para poder probar el cálculo con node, fuera del navegador. */
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    calcularDHondt, ordenInterno, detalleOrden, sumaPreferentes,
    recalcularTotal, reconciliarSoloLista, normalizar, clampInt, clampNum,
    datosPorDefecto, sortearVotos, PALETA, normalizarHex, ajustarParaFondo, contraste,
    FONDO_CLARO, FONDO_OSCURO, CONTRASTE_MINIMO,
    distanciaColor, seDistinguen, SEPARACION_MINIMA,
    enteroDeTexto, formatearCampoVotos,
  };
}
