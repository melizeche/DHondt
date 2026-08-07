/* Núcleo compartido por index.html y candidatos.html: paleta, estado, cálculo
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

const BANCAS_ASUNCION = 24;

/* Partidos realmente inscriptos ante la Justicia Electoral. Los números de
 * lista y las nóminas son de relleno y se editan desde la página. */
const PARTIDOS_BASE = [
  { numero: 1, partido: "Asociación Nacional Republicana – Partido Colorado", sigla: "ANR",     color: 0 },
  { numero: 2, partido: "Partido Liberal Radical Auténtico",                  sigla: "PLRA",    color: 1 },
  { numero: 3, partido: "Partido Patria Querida",                             sigla: "PPQ",     color: 2 },
  { numero: 4, partido: "Partido Encuentro Nacional",                         sigla: "PEN",     color: 3 },
  { numero: 5, partido: "Partido Hagamos",                                    sigla: "Hagamos", color: 4 },
  { numero: 6, partido: "Partido Cruzada Nacional",                           sigla: "PCN",     color: 5 },
  { numero: 7, partido: "Partido Democrático Progresista",                    sigla: "PDP",     color: 6 },
  { numero: 8, partido: "Partido Yo Creo",                                    sigla: "Yo Creo", color: 7 },
];

/* Las claves ya no llevan «asuncion»: la herramienta sirve para cualquier
 * elección y la de Asunción es sólo la que viene cargada. */
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

/* Las páginas cargan js/datos-asuncion.js antes que este archivo, así que
 * arrancan con las candidaturas oficiales. Sin ese archivo — por ejemplo al
 * correr los tests con node — se cae a nóminas de relleno editables. */
function datosPorDefecto() {
  if (typeof DATOS_ASUNCION !== "undefined") {
    try {
      return normalizar(DATOS_ASUNCION);
    } catch (e) { /* dato inservible: seguimos con el relleno */ }
  }
  return datosDeRelleno();
}

function datosDeRelleno() {
  proximoId = 1;
  return {
    eleccion: "Elecciones Municipales — Asunción",
    bancas: BANCAS_ASUNCION,
    umbral: 0,
    modo: "bloqueada",
    blancos: 0,
    nulos: 0,
    listas: PARTIDOS_BASE.map(function (p) {
      return {
        id: proximoId++,
        numero: p.numero,
        partido: p.partido,
        sigla: p.sigla,
        color: p.color,
        votos: 0,
        soloLista: 0,
        abierta: false,
        candidatos: nominaPorDefecto(BANCAS_ASUNCION),
      };
    }),
  };
}

/* Votos ilustrativos para probar la herramienta. No son resultados reales ni
 * pronósticos: son números inventados para que el reparto tenga algo que
 * repartir. Se aplican por posición a las listas que estén cargadas. */
const VOTOS_EJEMPLO = [95000, 62000, 41000, 3000, 5000, 12000, 2000, 1500, 900];

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
  const bancas = clampInt(bruto.bancas, 1, 99, BANCAS_ASUNCION);

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
      sigla: String(l.sigla || "").trim() || siglaDe(String(l.partido || ("L" + (i + 1)))),
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
    ? { nombre: String(bruto.fuente.nombre), url: bruto.fuente.url ? String(bruto.fuente.url) : null }
    : null;

  return {
    eleccion: String(bruto.eleccion || "Elecciones Municipales — Asunción"),
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
 * nunca se pisa — sigue en los datos y se muestra al editar la lista.
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

function pct(parte, total) {
  return total > 0 ? fmtDecimal.format((parte / total) * 100) + " %" : "—";
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
    estado.eleccion + " — " + listas + " listas, " + candidatos + " candidatos."));

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
 * boleta, ese va primero y queda elegido; los de la paleta lo reemplazan. */
function renderSelectorColor(contenedor, lista) {
  contenedor.textContent = "";

  function marcar() {
    contenedor.querySelectorAll(".swatch").forEach(function (s) {
      const esOficial = s.dataset.oficial === "1";
      const elegido = esOficial ? !!lista.colorHex
                                : !lista.colorHex && Number(s.dataset.indice) === lista.color;
      s.setAttribute("aria-pressed", elegido ? "true" : "false");
    });
  }

  if (lista.colorHex) {
    const boton = el("button", {
      type: "button", class: "swatch",
      style: "background:" + ajustarParaFondo(lista.colorHex, modoOscuro()),
      title: "Color oficial de la boleta (" + lista.colorHex + ")",
      "aria-label": "Color oficial de la boleta",
      onclick: function () { lista.colorHex = normalizarHex(lista.colorHex); marcar(); },
    });
    boton.dataset.oficial = "1";
    contenedor.appendChild(boton);
    contenedor.appendChild(el("span", {
      style: "width:1px; align-self:stretch; background:var(--border-strong); margin:0 4px",
    }));
  }

  const oficialOriginal = lista.colorHex;
  PALETA.forEach(function (p, i) {
    const boton = el("button", {
      type: "button", class: "swatch",
      style: "background:" + (modoOscuro() ? p.oscuro : p.claro),
      title: p.nombre, "aria-label": "Color " + p.nombre,
      onclick: function () {
        lista.color = i;
        lista.colorHex = null;   // elegir de la paleta descarta el color oficial
        marcar();
      },
    });
    boton.dataset.indice = String(i);
    contenedor.appendChild(boton);
  });

  // el botón "oficial" tiene que poder recuperar el hex después de descartarlo
  if (oficialOriginal) {
    const oficial = contenedor.querySelector('.swatch[data-oficial="1"]');
    oficial.addEventListener("click", function () { lista.colorHex = oficialOriginal; marcar(); });
  }

  marcar();
}

/* ============================================== importar / exportar JSON */
function exportarJSON(nombreArchivo) {
  const copia = JSON.parse(JSON.stringify(estado));
  copia.listas.forEach(function (l) { delete l.id; delete l.abierta; });
  const blob = new Blob([JSON.stringify(copia, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: nombreArchivo || "dhondt-asuncion.json" });
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

      sel.textContent = "";
      // Marcador para cuando lo cargado no sale de un archivo del índice:
      // los datos embebidos, o algo que el usuario importó.
      sel.appendChild(el("option", { value: VALOR_SIN_ARCHIVO, text: "— datos cargados —" }));
      elecciones.forEach(function (e) {
        sel.appendChild(el("option", {
          value: e.archivo,
          text: e.nombre,
          title: e.detalle || "",
        }));
      });

      const recordada = eleccionRecordada();
      sel.value = elecciones.some(function (e) { return e.archivo === recordada; })
        ? recordada : VALOR_SIN_ARCHIVO;

      sel.addEventListener("change", function () {
        const archivo = sel.value;
        if (!archivo) return;   // el marcador no carga nada
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
      /* Sin índice —file://, o el archivo no está— el selector no aparece y
         se sigue con los datos embebidos. Importar JSON sigue disponible. */
    });
}

function cargarEleccion(archivo) {
  return fetch(RUTA_DATOS + archivo, { cache: "no-cache" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (bruto) {
      estado = normalizar(bruto);
      recordarEleccion(archivo);
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
        recordarEleccion(null);   // ya no corresponde a ningún archivo del índice
        const sel = document.getElementById("cfg-eleccion");
        if (sel) sel.value = VALOR_SIN_ARCHIVO;
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
    datosPorDefecto, PALETA, normalizarHex, ajustarParaFondo, contraste,
    FONDO_CLARO, FONDO_OSCURO, CONTRASTE_MINIMO,
  };
}
