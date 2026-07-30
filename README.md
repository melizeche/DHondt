# Calculadora D'Hondt — Junta Municipal de Asunción

Sitio estático para repartir las bancas de la Junta Municipal de Asunción por el
método D'Hondt y ver **qué candidatos resultan electos concejales**.

No necesita servidor ni build: abrí `index.html` en el navegador.

Son dos páginas sobre los mismos datos, y se puede saltar de una a la otra sin
perder nada:

| Página | Se carga | Sirve para |
|---|---|---|
| `index.html` — **votos por lista** | el total de cada lista | el escenario rápido: cuántas bancas saca cada partido |
| `candidatos.html` — **votos por candidato** | los votos de cada candidato | el cálculo completo, incluido el orden interno de cada lista |

## Página por lista (`index.html`)

- **Listas con su nómina completa.** Cada lista se despliega y muestra a sus
  candidatos en orden; los que entran quedan marcados como electos.
- **Reparto D'Hondt.** Se recalcula en vivo mientras se escriben los votos.
- **Tabla de cocientes.** Votos ÷ 1, 2, 3… con las celdas ganadoras resaltadas y
  numeradas según el orden en que se adjudicó cada banca.
- **Empates señalados, no resueltos.** Cuando dos listas comparten el cociente de
  la última banca en disputa, la página lo avisa: el Código Electoral resuelve
  esos casos por sorteo, así que la herramienta no puede decidirlo.
- **Bancas configurables** (24 por defecto, que es como se integra la Junta de
  Asunción) y **umbral opcional** (en 0, que es lo que corresponde: no hay
  barrera legal para el reparto municipal).
- **Votos en blanco y nulos** para las estadísticas, sin entrar al reparto.

## Página por candidato (`candidatos.html`)

Acá se carga voto por voto de cada candidato y el total de la lista sale solo.
La página muestra el cálculo entero, en cuatro pasos:

1. **Total de votos de cada lista** — votos de sola lista + votos preferentes de
   sus candidatos, con el desglose a la vista.
2. **Reparto D'Hondt entre listas** — la misma tabla de cocientes, con la banca
   que ganó cada celda.
3. **Orden interno de cada lista** — la nómina reordenada por voto preferente,
   mostrando para cada candidato sus votos, su porcentaje dentro de la lista, la
   posición en la que quedó, de qué posición venía y cuántos lugares subió o
   bajó. Arranca mostrando a los que entran más los tres siguientes; con
   «Mostrar nóminas completas» se ve todo.
4. **Concejales electos** — los electos en el orden en que se adjudicó cada
   banca, con sus votos propios y su posición original.

Además: **«Pegar votos»** carga una lista entera de una vez (acepta
`Nombre <tab> votos`, `Nombre; votos`, `Nombre, votos`, o sólo el número, con
puntos de miles), y el selector **«Orden dentro de la lista»** permite comparar
el resultado con voto preferente contra el de la lista cerrada y bloqueada.

## En las dos

Nóminas, números de lista, siglas y colores editables, importación y exportación
en JSON, guardado automático en el navegador e impresión.

## Las candidaturas

Las dos páginas arrancan con las **9 listas y los 216 candidatos** que se
presentan a la Junta Municipal de Asunción, tomados del
[simulador oficial del TSJE](https://simuladoroficial.tsje.gov.py/) (datos
`59.0.0`, que es el código de Asunción). Vienen con el número de lista de la
boleta, el nombre y la sigla del partido o alianza, el color oficial y la nómina
completa en su orden.

Los **votos los pone quien usa la herramienta**: el archivo de datos trae todos
los totales en cero. Esto no publica ni pronostica resultados, calcula el
reparto de los números que uno cargue.

Todo es editable igual: «Editar lista» cambia número, nombre, sigla y color;
«Editar candidatos» (o «Pegar votos» en la página por candidato) reemplaza la
nómina; «Importar JSON» carga otro conjunto entero. Si alguna nómina queda con
nombres de relleno («Candidato/a 1»…), la página lo avisa arriba.

### Regenerar los datos

Los datos vienen de tres archivos del simulador. Se bajan del navegador —el
sitio del TSJE no siempre responde a `curl`— y se convierten con:

```sh
# los tres archivos van en una carpeta:
#   Categorias.json  Agrupaciones.json  Candidaturas.json
# de https://simuladoroficial.tsje.gov.py/datos/59.0.0/

node tools/tsje-a-json.mjs --datos ./descargas \
  --eleccion "Elecciones Municipales — Junta Municipal de Asunción" \
  --salida datos/asuncion-junta-municipal.json \
  --js js/datos-asuncion.js
```

`--salida` escribe el JSON importable y `--js` el script que las páginas cargan
de entrada; conviene generar los dos juntos para que no se desincronicen (hay un
test que lo comprueba).

El conversor toma la categoría `JUN` (Junta Municipal) por defecto; con
`--categoria INT` saca la de intendente. Descarta las entradas especiales de
`Candidaturas.json` —voto en blanco, nulos y no computados— que no son
candidatos, y avisa si alguna nómina tiene huecos en su numeración.

### Otras ciudades

`ubicaciones.json` mapea cada municipio a su código, que es la carpeta de donde
salen sus datos:

```sh
node tools/tsje-a-json.mjs --ciudades ubicaciones.json
```

Con ese código se bajan los tres archivos de
`https://simuladoroficial.tsje.gov.py/datos/<codigo>/` y se corre el conversor
igual. Ojo con `--bancas`: cada Junta Municipal tiene la suya, y por defecto el
conversor usa el largo de la nómina más larga.

## Formato del JSON

`Exportar JSON` genera este formato y `Importar JSON` lo acepta. También acepta
una versión abreviada escrita a mano: `candidatos` puede ser una lista de textos
en lugar de objetos, y todo lo que falte toma su valor por defecto.

```jsonc
{
  "eleccion": "Elecciones Municipales — Asunción",
  "fuente": {                     // opcional: de dónde salieron las nóminas
    "nombre": "simulador oficial del TSJE",
    "url": "https://simuladoroficial.tsje.gov.py/"
  },
  "bancas": 24,
  "umbral": 0,                    // % de votos válidos; 0 = sin umbral
  "modo": "bloqueada",            // o "desbloqueada"
  "blancos": 0,
  "nulos": 0,
  "listas": [
    {
      "numero": 1,
      "partido": "Nombre del partido, movimiento o alianza",
      "sigla": "SIGLA",
      "color": 0,                 // índice 0–7 de la paleta (respaldo)
      "colorHex": "#ff0000",      // color oficial de la boleta; tiene prioridad
      "votos": 92000,             // total de la lista
      "soloLista": 50601,         // opcional: votos sin candidato nombrado
      "candidatos": [
        "Nombre Apellido",                        // forma corta
        { "nombre": "Otro Nombre", "pref": 1234 } // con voto preferente
      ]
    }
  ]
}
```

`soloLista` se puede omitir: si falta, se deduce restándole al total los votos
preferentes, así un archivo escrito para la página por lista también abre bien
en la de candidatos.

Sobre `colorHex`: se usa el color oficial de la boleta, que es el que reconoce
quien vota, salvo que no se distinga del fondo —el Partido Demócrata Cristiano
es blanco— en cuyo caso se le corrige la luminosidad hasta llegar a 3:1,
conservando el tono. El hex original nunca se pisa: queda en los datos y se
muestra al editar la lista. Elegir un color de la paleta descarta el oficial.

`fuente` es la línea de procedencia que la página muestra arriba. Sólo aparece
si el archivo la trae: las nóminas que uno cargue no quedan acreditadas a nadie
por defecto.

Hay dos ejemplos para importar:

- [`datos/ejemplo.json`](datos/ejemplo.json) — mínimo, para ver el formato.
- [`datos/ejemplo-star-wars.json`](datos/ejemplo-star-wars.json) — 3 listas,
  10 bancas y voto preferente. Sirve para probar la herramienta con algo chico:
  el Imperio saca 5 bancas, la Rebelión 4 y los Separatistas 1, y el voto
  preferente da vuelta las dos listas grandes (Vader pasa a Palpatine, Luke a
  Leia) sin que ninguno de los cuatro se quede afuera. Mon Mothma cae del
  segundo lugar al cuarto y entra por la última banca; Jyn Erso queda primera
  suplente.

## Cómo se calcula

**Entre listas.** Para cada lista se divide su total de votos por 1, 2, 3… y se
ordenan todos los cocientes de mayor a menor: las bancas van a los más altos. Se
adjudica banca por banca, comparando los cocientes con productos cruzados de
enteros (`vᵢ · dⱼ` contra `vⱼ · dᵢ`) en vez de dividir, para que un empate exacto
se detecte como tal y no quede escondido detrás de un error de redondeo.

**Dentro de cada lista.** Las bancas se asignan por orden de la nómina, o por
votos preferentes de mayor a menor si la lista está desbloqueada; los empates de
votos preferentes se resuelven a favor del orden original de la nómina.

**El total de una lista** son los votos que la eligieron sin nombrar candidato
(«sola lista») más los que además nombraron a uno. Las dos páginas trabajan sobre
ese mismo par de números desde puntas distintas: en la página por lista se
escribe el total y los votos preferentes lo reparten; en la de candidatos se
cargan los votos de cada uno y el total se recalcula. Ir y volver entre las dos
no cambia ningún total.

## Estructura

```
index.html                          página por lista
candidatos.html                     página por candidato
js/core.js                          estado, cálculo D'Hondt, orden interno, color, formato
js/datos-asuncion.js                candidaturas que las páginas traen cargadas (generado)
css/base.css                        estilos compartidos
datos/asuncion-junta-municipal.json las mismas candidaturas, para importar (generado)
datos/ejemplo.json                  ejemplo mínimo del formato
datos/ejemplo-star-wars.json        ejemplo chico: 3 listas, 10 bancas, voto preferente
tools/tsje-a-json.mjs               conversor de los datos del TSJE
tests/dhondt.test.mjs               cálculo
tests/datos.test.mjs                datos generados
```

Las dos páginas comparten `js/core.js`, así que el cálculo está escrito una sola
vez. Son scripts clásicos, no módulos, justamente para que las páginas también
funcionen abiertas con `file://`.

## Tests

Sin dependencias: cargan `js/core.js` tal cual lo usa el navegador.

```sh
node tests/dhondt.test.mjs
node tests/datos.test.mjs
```

`dhondt.test.mjs` verifica el reparto contra el ejemplo canónico del método,
contra una implementación por fuerza bruta de los mayores cocientes y en unos
cuantos miles de casos aleatorios (que la suma de bancas cierre, que más votos
nunca den menos bancas), además del umbral, los empates, el reordenamiento por
voto preferente, la ida y vuelta entre las dos vistas y la lectura de JSON.

`datos.test.mjs` comprueba las candidaturas generadas: que estén las 9 listas
con sus 24 candidatos, sin nombres de relleno ni votos precargados, que los
números de lista y las siglas no se repitan, que el JSON y el script embebido
digan lo mismo, y que los 9 colores oficiales lleguen a 3:1 contra el fondo y
sigan siendo distinguibles entre sí en los dos modos.

## Publicar

Es un sitio estático: sirve cualquier hosting. Para GitHub Pages, en
*Settings → Pages* se elige la rama y la carpeta raíz.

---

Herramienta de cálculo no oficial, sin relación con el TSJE ni con ningún
partido. Los datos que se cargan quedan solamente en el navegador.
