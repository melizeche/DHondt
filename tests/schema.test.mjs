/* Valida los archivos de datos contra datos/schema.json:
 *   node tests/schema.test.mjs
 *
 * Trae un validador propio en vez de una dependencia, porque el resto de los
 * tests tampoco tiene ninguna. Cubre sólo lo que el esquema usa —type, enum,
 * minimum, maximum, minItems, pattern, required, properties,
 * additionalProperties, items, oneOf y $ref— y no pretende ser un validador
 * de JSON Schema completo. Si el esquema crece, esto tiene que crecer con él:
 * la última prueba se asegura de que no queden palabras clave sin implementar.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { normalizar } = require("../js/core.js");

const esquema = JSON.parse(readFileSync(new URL("../datos/schema.json", import.meta.url), "utf8"));

const CLAVES_SOPORTADAS = new Set([
  "$schema", "$defs", "$ref", "title", "description", "default", "examples", "format",
  "type", "enum", "minimum", "maximum", "minItems", "pattern",
  "required", "properties", "additionalProperties", "items", "oneOf",
]);

function resolverRef(ref, raiz) {
  if (ref.slice(0, 2) !== "#/") throw new Error("sólo se resuelven $ref locales: " + ref);
  return ref.slice(2).split("/").reduce(function (nodo, parte) {
    return nodo[parte.replace(/~1/g, "/").replace(/~0/g, "~")];
  }, raiz);
}

function tipoDe(valor) {
  if (valor === null) return "null";
  if (Array.isArray(valor)) return "array";
  if (Number.isInteger(valor)) return "integer";
  return typeof valor;   // string | number | boolean | object
}

function coincideTipo(esperado, valor) {
  const t = tipoDe(valor);
  if (esperado === "number") return t === "number" || t === "integer";
  return esperado === t;
}

function validar(esq, valor, raiz, ruta) {
  ruta = ruta || "(raíz)";
  if (esq.$ref) return validar(resolverRef(esq.$ref, raiz), valor, raiz, ruta);

  const errores = [];

  if (esq.type !== undefined) {
    const tipos = Array.isArray(esq.type) ? esq.type : [esq.type];
    if (!tipos.some(function (t) { return coincideTipo(t, valor); })) {
      errores.push(ruta + ": se esperaba " + tipos.join(" o ") + " y vino " + tipoDe(valor));
      return errores;   // sin el tipo correcto, el resto no tiene sentido
    }
  }

  if (esq.enum && esq.enum.indexOf(valor) === -1) {
    errores.push(ruta + ": " + JSON.stringify(valor) + " no está entre " + JSON.stringify(esq.enum));
  }
  if (esq.minimum !== undefined && typeof valor === "number" && valor < esq.minimum) {
    errores.push(ruta + ": " + valor + " es menor que el mínimo " + esq.minimum);
  }
  if (esq.maximum !== undefined && typeof valor === "number" && valor > esq.maximum) {
    errores.push(ruta + ": " + valor + " supera el máximo " + esq.maximum);
  }
  if (esq.pattern !== undefined && typeof valor === "string" && !new RegExp(esq.pattern).test(valor)) {
    errores.push(ruta + ": «" + valor + "» no coincide con " + esq.pattern);
  }
  if (esq.minItems !== undefined && Array.isArray(valor) && valor.length < esq.minItems) {
    errores.push(ruta + ": tiene " + valor.length + " elementos y el mínimo es " + esq.minItems);
  }

  if (Array.isArray(valor) && esq.items) {
    valor.forEach(function (v, i) {
      errores.push.apply(errores, validar(esq.items, v, raiz, ruta + "[" + i + "]"));
    });
  }

  if (valor && typeof valor === "object" && !Array.isArray(valor)) {
    (esq.required || []).forEach(function (clave) {
      if (!(clave in valor)) errores.push(ruta + ": falta la propiedad obligatoria «" + clave + "»");
    });
    const conocidas = esq.properties || {};
    Object.keys(valor).forEach(function (clave) {
      const sub = ruta + "." + clave;
      if (conocidas[clave]) {
        errores.push.apply(errores, validar(conocidas[clave], valor[clave], raiz, sub));
      } else if (esq.additionalProperties === false) {
        errores.push(sub + ": propiedad no reconocida");
      }
    });
  }

  if (esq.oneOf) {
    const validos = esq.oneOf.filter(function (alt) {
      return validar(alt, valor, raiz, ruta).length === 0;
    });
    if (validos.length !== 1) {
      errores.push(ruta + ": debía cumplir exactamente una de las " + esq.oneOf.length +
        " alternativas y cumplió " + validos.length);
    }
  }

  return errores;
}

/* ------------------------------------------------------------------ pruebas */
let fallos = 0;

function check(nombre, ok, detalle) {
  if (!ok) fallos++;
  console.log((ok ? "  ok   " : "  FALLA") + "  " + nombre +
    (ok || !detalle ? "" : "\n           " + [].concat(detalle).join("\n           ")));
}

function valida(nombre, archivo) {
  const dato = JSON.parse(readFileSync(new URL("../" + archivo, import.meta.url), "utf8"));
  const errores = validar(esquema, dato, esquema);
  check(nombre, errores.length === 0, errores);
}

console.log("\nLos archivos del repositorio cumplen el esquema");
valida("datos/asuncion-junta-municipal.json", "datos/asuncion-junta-municipal.json");
valida("datos/ejemplo.json", "datos/ejemplo.json");
valida("datos/ejemplo-star-wars.json", "datos/ejemplo-star-wars.json");

console.log("\nEl índice del desplegable apunta a archivos que existen y valen");
{
  const indice = JSON.parse(readFileSync(new URL("../datos/indice.json", import.meta.url), "utf8"));
  const elecciones = indice.elecciones || [];
  check("el índice trae al menos una elección", elecciones.length > 0, elecciones.length);

  elecciones.forEach(function (e) {
    check("«" + e.nombre + "» tiene archivo y nombre",
      typeof e.archivo === "string" && typeof e.nombre === "string", e);
    let dato = null;
    try {
      dato = JSON.parse(readFileSync(new URL("../datos/" + e.archivo, import.meta.url), "utf8"));
    } catch (err) {
      check("existe datos/" + e.archivo, false, err.message);
      return;
    }
    check("datos/" + e.archivo + " cumple el esquema", validar(esquema, dato, esquema).length === 0,
      validar(esquema, dato, esquema));
  });

  const archivos = elecciones.map(function (e) { return e.archivo; });
  check("no hay archivos repetidos en el índice", new Set(archivos).size, archivos.length);
}

console.log("\nLo mínimo alcanza");
{
  const errores = validar(esquema, { listas: [{ partido: "P", candidatos: ["Ana"] }] }, esquema);
  check("una lista con un candidato es válida", errores.length === 0, errores);
}
{
  const errores = validar(esquema, { listas: [{}] }, esquema);
  check("una lista vacía también (todo tiene valor por defecto)", errores.length === 0, errores);
}

console.log("\nLos «default» del esquema dicen lo que hace el cargador");
{
  const aplicado = normalizar({ listas: [{}] });
  const declarados = {};
  Object.keys(esquema.properties).forEach(function (clave) {
    if ("default" in esquema.properties[clave]) {
      declarados[clave] = esquema.properties[clave].default;
    }
  });
  const malos = Object.keys(declarados).filter(function (clave) {
    return JSON.stringify(aplicado[clave]) !== JSON.stringify(declarados[clave]);
  });
  check("los defaults de la raíz coinciden con los del cargador", malos.length === 0,
    malos.map(function (clave) {
      return clave + ": el esquema dice " + JSON.stringify(declarados[clave]) +
        ", el cargador aplica " + JSON.stringify(aplicado[clave]);
    }));
}

console.log("\nY el esquema rechaza lo que tiene que rechazar");

function rechaza(nombre, dato) {
  const errores = validar(esquema, dato, esquema);
  check(nombre, errores.length > 0, errores.length ? null : "lo aceptó y no debía");
}

rechaza("sin listas", { eleccion: "X" });
rechaza("listas vacío", { listas: [] });
rechaza("listas que no es arreglo", { listas: { partido: "P" } });
rechaza("bancas en 0", { bancas: 0, listas: [{}] });
rechaza("bancas por encima de 99", { bancas: 100, listas: [{}] });
rechaza("bancas con decimales", { bancas: 2.5, listas: [{}] });
rechaza("umbral negativo", { umbral: -1, listas: [{}] });
rechaza("modo inventado", { modo: "semiabierta", listas: [{}] });
rechaza("votos negativos", { listas: [{ votos: -1 }] });
rechaza("color fuera de la paleta", { listas: [{ color: 8 }] });
rechaza("colorHex de tres dígitos", { listas: [{ colorHex: "#f00" }] });
rechaza("colorHex que no es hex", { listas: [{ colorHex: "rojo" }] });
rechaza("preferentes negativos", { listas: [{ candidatos: [{ nombre: "Ana", pref: -5 }] }] });
rechaza("candidato objeto sin nombre", { listas: [{ candidatos: [{ pref: 10 }] }] });
rechaza("candidato que es un número", { listas: [{ candidatos: [42] }] });
rechaza("propiedad mal escrita en la raíz", { bankas: 24, listas: [{}] });
rechaza("propiedad mal escrita en una lista", { listas: [{ sigal: "ANR" }] });
rechaza("propiedad mal escrita en un candidato", { listas: [{ candidatos: [{ nombre: "Ana", prefs: 3 }] }] });
rechaza("fuente sin nombre", { fuente: { url: "https://x.test/" }, listas: [{}] });

console.log("\nEl validador de este archivo cubre todo lo que usa el esquema");
{
  const usadas = new Set();
  (function recorrer(nodo) {
    if (!nodo || typeof nodo !== "object") return;
    if (Array.isArray(nodo)) return nodo.forEach(recorrer);
    Object.keys(nodo).forEach(function (clave) {
      // dentro de `properties` las claves son nombres de campo, no palabras clave
      if (clave === "properties" || clave === "$defs") {
        Object.values(nodo[clave]).forEach(recorrer);
        usadas.add(clave === "$defs" ? "$defs" : "properties");
        return;
      }
      usadas.add(clave);
      recorrer(nodo[clave]);
    });
  })(esquema);

  const sinCubrir = [...usadas].filter(function (c) { return !CLAVES_SOPORTADAS.has(c); });
  check("no hay palabras clave sin implementar", sinCubrir.length === 0,
    sinCubrir.length ? "sin cubrir: " + sinCubrir.join(", ") : null);
}

console.log(fallos === 0 ? "\nTodo en orden.\n" : `\n${fallos} fallo(s).\n`);
process.exit(fallos === 0 ? 0 : 1);
