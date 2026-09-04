# Calculadora D'Hondt

Sitio estático para repartir bancas por el método D'Hondt y ver quiénes resultan electos.

No necesita servidor ni build: abrí `index.html` en el navegador.

Sirve para cualquier elección proporcional por listas: las bancas, las listas, las nóminas y el modo se cargan desde un JSON. Viene con las Juntas Municipales de Asunción, Encarnación y Ciudad del Este, pero no está atada a ellas.

## Contenido

- [Usar ahora](#usar-ahora)
- [Página por lista](#página-por-lista-indexhtml) y [página por candidato](#página-por-candidato-candidatoshtml)
- [Elegir otra elección](#elegir-otra-elección)
  - [Regenerar los datos](#regenerar-los-datos)
- [Resultados de elecciones que ya pasaron](#resultados-de-elecciones-que-ya-pasaron)
- [Formato del JSON](#formato-del-json)
- [Cómo se calcula](#cómo-se-calcula)
- [Estructura](#estructura) y [tests](#tests)
- [Licencia](#licencia)

## Usar ahora

La versión publicada está en [bancas.melizeche.com](https://bancas.melizeche.com).

- Con doble clic en `index.html` funcionan la calculadora y «Importar JSON»; el selector **Elección** queda oculto.
- Con un servidor local también funciona el selector:

  ```sh
  python3 -m http.server
  ```

  Después se abre [localhost:8000](http://localhost:8000).

Son dos páginas sobre los mismos datos. Se puede pasar de una a la otra sin perder nada:

| Página | Se carga | Sirve para |
|---|---|---|
| `index.html`: **votos por lista** | el total de cada lista | ver rápido cuántas bancas saca cada partido |
| `candidatos.html`: **votos por candidato** | los votos de cada candidato | el cálculo completo, incluido el orden interno de cada lista |

## Página por lista (`index.html`)

- **Listas con su nómina completa.** Cada lista se despliega y muestra a sus candidatos en orden; los que entran quedan marcados como electos.
- **Reparto D'Hondt.** Se recalcula mientras se escriben los votos.
- **Tabla de cocientes.** Votos ÷ 1, 2, 3… con las celdas ganadoras resaltadas y numeradas según el orden en que se adjudicó cada banca.
- **Empates señalados, no resueltos.** Cuando dos listas comparten el cociente de la última banca en disputa, la página lo avisa. El Código Electoral resuelve esos casos por sorteo, así que la herramienta no lo decide.
- **Bancas configurables** y **umbral opcional**. En Paraguay va en 0: el Artículo 258 reparte entre todas las listas que sacaron votos, sin mínimo. El campo está para probar qué pasaría con una barrera. Otros países que usan D'Hondt la tienen: España pide 3 % de los votos válidos de la circunscripción, Argentina 3 % del padrón del distrito, Polonia 5 %. La página lo aclara al lado del campo.
- **Votos en blanco y nulos** para las estadísticas, sin entrar al reparto.
- **Los votos se escriben con separador de miles.** Se van punteando solos mientras se tipea (1.319.617), y se leen sólo los dígitos: da igual si el separador que se pega es punto, coma o espacio.

## Página por candidato (`candidatos.html`)

Acá se cargan los votos de cada candidato y el total de la lista sale solo. La página muestra el cálculo entero, en cuatro pasos:

1. **Total de votos de cada lista**: votos de sola lista + votos preferentes de sus candidatos, con el desglose.
2. **Reparto D'Hondt entre listas**: la misma tabla de cocientes, con la banca que ganó cada celda.
3. **Orden interno de cada lista**: la nómina reordenada por voto preferente. Para cada candidato, sus votos, su porcentaje dentro de la lista, la posición en la que quedó, de qué posición venía y cuántos lugares subió o bajó. Arranca mostrando a los que entran más los tres siguientes; con «Mostrar nóminas completas» se ve todo.
4. **Electos**: en el orden en que se adjudicó cada banca, con sus votos propios y su posición original.

Además, **«Pegar votos»** carga una lista entera de una vez (acepta `Nombre <tab> votos`, `Nombre; votos`, `Nombre, votos`, o sólo el número, con puntos de miles), y el selector **«Orden dentro de la lista»** permite comparar el resultado con voto preferente contra el de la lista cerrada y bloqueada.

## En las dos

Nóminas, números de lista, siglas y colores editables, importación y exportación en JSON, guardado automático en el navegador e impresión.

## Elegir otra elección

El desplegable **Elección** lista los conjuntos de datos de `datos/`, según [`datos/indice.json`](datos/indice.json). Para agregar una elección:

1. Generá o importá su JSON.
2. Dejalo en `datos/`.
3. Sumale una entrada a `datos/indice.json`.
4. Corré `node tests/schema.test.mjs`.

```jsonc
{
  "elecciones": [
    {
      "archivo": "concepcion-junta-municipal.json",
      "nombre": "Junta Municipal de Concepción",
      "detalle": "7 listas · 12 bancas"        // opcional, sale como tooltip
    }
  ]
}
```

El desplegable trae los archivos con `fetch`, y eso necesita un servidor. Abriendo el HTML con doble clic (`file://`) el navegador bloquea esos pedidos por CORS, así que ahí el desplegable no aparece: queda la elección de ejemplo y se cambia con «Importar JSON», que lee del disco. Servido (Cloudflare Pages, GitHub Pages, `python3 -m http.server`) el desplegable aparece.

Cuál quedó elegida se recuerda en el navegador y vale para las dos páginas. Al importar un archivo suelto, el desplegable muestra el nombre que trae aunque no figure en el índice.

## Las candidaturas

Vienen cargadas tres Juntas Municipales, tomadas del [simulador oficial del TSJE](https://simuladoroficial.tsje.gov.py/), con el número de lista de la boleta, el nombre y la sigla del partido o alianza, el color oficial y la nómina completa en su orden:

| Elección | Código | Listas | Candidatos | Bancas |
|---|---|---|---|---|
| Junta Municipal de Asunción | `59.0.0` | 9 | 216 | 24 |
| Junta Municipal de Encarnación | `59.7.0` | 7 | 84 | 12 |
| Junta Municipal de Ciudad del Este | `59.10.0` | 8 | 96 | 12 |

Las tres se eligen en el desplegable. Ninguna viene cargada de entrada: la página se abre con una elección de ejemplo (tres listas llamadas A, B y C, 12 bancas, todo en cero). Con varios conjuntos de datos, arrancar siempre en una ciudad no tiene sentido.

Los votos los pone quien usa la herramienta: los archivos de candidaturas traen todos los totales en cero. Esto no publica ni pronostica resultados, calcula el reparto de los números que uno cargue.

Para tener algo que repartir sin cargar nada, «Votos al azar» sortea un resultado y se puede volver a tirar las veces que uno quiera. Los números son inventados, pero la forma no: se sortea un electorado desparejo (una o dos listas grandes y una cola larga), porque con totales parejos D'Hondt se vería proporcional, que es justo lo que no hace. Tirando varias veces se ve lo mismo: la lista más votada se lleva un porcentaje de bancas mayor que su porcentaje de votos, la cola queda afuera y la última banca se define por poco. Si lo que hay cargado no salió de un sorteo (los resultados reales de 2023, o votos puestos a mano) pregunta antes de pisarlos.

Todo es editable: «Editar lista» cambia número, nombre, sigla y color; «Editar candidatos» (o «Pegar votos» en la página por candidato) reemplaza la nómina; «Importar JSON» carga otro conjunto entero. Si alguna nómina queda con nombres de relleno («Candidato/a 1»…), la página lo avisa arriba.

### Regenerar los datos

Los datos vienen de tres archivos del simulador. Se bajan del navegador (el sitio del TSJE no siempre responde a `curl`) y se convierten con:

```sh
# los tres archivos van en una carpeta:
#   Categorias.json  Agrupaciones.json  Candidaturas.json
# de https://simuladoroficial.tsje.gov.py/datos/59.0.0/

node tools/tsje-a-json.mjs --datos ./descargas \
  --eleccion "Elecciones Municipales · Junta Municipal de Asunción" \
  --salida datos/asuncion-junta-municipal.json
```

Sin `--salida` el JSON sale por la salida estándar. El archivo va a `datos/` y se agrega al índice.

El conversor toma la categoría `JUN` (Junta Municipal) por defecto; con `--categoria INT` saca la de intendente. Descarta las entradas especiales de `Candidaturas.json` (voto en blanco, nulos y no computados) que no son candidatos, y avisa si alguna nómina tiene huecos en su numeración.

### Otras ciudades

`ubicaciones.json` mapea cada municipio a su código, que es la carpeta de donde salen sus datos:

```sh
node tools/tsje-a-json.mjs --ciudades ubicaciones.json
```

Con ese código se bajan los tres archivos de `https://simuladoroficial.tsje.gov.py/datos/<codigo>/` y se corre el conversor igual. Cada Junta Municipal tiene su cantidad de bancas; por defecto el conversor usa el largo de la nómina más larga, y con `--bancas` se fija a mano.

## Resultados de elecciones que ya pasaron

Vienen cargados dos resultados reales.

### Senadores 2023

`datos/senadores-2023.json`: 18 listas, 45 bancas, 810 candidatos y los votos ya puestos, tomados del PDF de resultados oficiales del TSJE.

El reparto que da es ANR 23, Alianza 12, Cruzada Nacional 5, Encuentro Nacional 2, y una banca para Patria Querida, Frente Guasu y Yo Creo: la composición proclamada para el período 2023-2028. La banca 45 se definió por poco: Yo Creo entró con un cociente de 56.386 y el sexto del Cruzada Nacional quedó afuera con 55.324.

Es la comprobación real de la herramienta contra un resultado oficial: ~2,9 millones de votos, 18 listas y 45 bancas, partiendo sólo de los votos del PDF. El test verifica además los 45 nombres, cada uno con su lista y su voto preferente, en el mismo orden de adjudicación que la lista de electos del TSJE. Si algún cambio en el cálculo rompiera esa coincidencia, se nota.

El PDF se convierte con:

```sh
pip install pdfplumber
python3 tools/pdf-resultados-a-json.py SENADORES_2023.pdf \
  --bancas 45 \
  --eleccion "Elecciones Generales 2023 · Senadores (resultados oficiales)" \
  --salida datos/senadores-2023.json
```

El script no escribe nada si las cuentas no cierran: los votos preferentes de cada lista tienen que sumar su total, las opciones ir de 1 a N sin huecos, y la suma de listas más blancos y nulos dar el total que declara el PDF (2.885.656 + 120.825 + 13.706 = 3.020.187). Las siglas las recorta del nombre del partido; conviene repasarlas a mano, que es lo único que se editó acá.

### Junta Municipal de Asunción 2021

`datos/asuncion-junta-municipal-2021.json` trae las Municipales 2021 de Asunción con los votos preferentes de cada uno de los 552 candidatos, no sólo el total de cada lista. 23 listas, 24 bancas, 246.844 votos válidos.

El reparto da ANR 15, PLRA 5, Patria Querida 3 y Encuentro Ciudadano 1, que es la Junta que asumió. Como están los votos de cada candidato, también se comprueba quiénes ocuparon esas bancas: los 24 nombres que calcula la herramienta son los 24 concejales que asumieron, en el orden en que el voto preferente los dejó.

La planilla sale de [datos.gov.py](https://www.datos.gov.py/dataset/elecciones-municipales-2021-votos-preferentes-por-mesa) y trae las 261 Juntas Municipales del país, así que sirve para cualquier ciudad:

```sh
# qué código tiene cada ciudad
python3 tools/xlsx-preferentes-a-json.py 1VotosPref_Dep_Distrito_JuMu2021_da.xlsx --listar

python3 tools/xlsx-preferentes-a-json.py 1VotosPref_Dep_Distrito_JuMu2021_da.xlsx \
  --departamento 0 --distrito 0 --bancas 24 \
  --eleccion "Elecciones Municipales 2021 · Junta Municipal de Asunción" \
  --salida datos/asuncion-junta-municipal-2021.json
```

No necesita instalar nada: un `.xlsx` es un zip de XML y el conversor lo abre con `zipfile` y `xml.etree`, que vienen con Python. Sin `--bancas` toma la cantidad de filas marcadas `ELECTO` en la planilla, y no escribe nada si el `ORDEN_LISTA` de alguna lista tiene huecos o si las filas `ELECTO` no coinciden con las bancas pedidas.

La planilla es sólo de votos preferentes y no trae los votos en blanco ni los nulos, así que quedan en cero. Los totales por lista son votos válidos y el reparto no usa blancos ni nulos, pero la estadística de «emitidos» queda corta.

## Formato del JSON

`Exportar JSON` genera este formato y `Importar JSON` lo acepta. También acepta una versión abreviada escrita a mano: `candidatos` puede ser una lista de textos en lugar de objetos, y todo lo que falte toma su valor por defecto.

Los comentarios son explicativos: un archivo para importar debe quitarlos.

```jsonc
{
  "eleccion": "Elecciones Municipales · Asunción",
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

`soloLista` se puede omitir: si falta, se deduce restándole al total los votos preferentes, así un archivo escrito para la página por lista también abre bien en la de candidatos.

`colorHex` es el color oficial de la boleta y es el que se usa, salvo que no se distinga del fondo (el Partido Demócrata Cristiano es blanco): en ese caso se le corrige la luminosidad hasta llegar a 3:1, conservando el tono. El hex original no se pisa: queda en los datos y se muestra al editar la lista. Elegir un color de la paleta descarta el oficial.

Dos listas con colores casi iguales se dejan casi iguales. La boleta de Encarnación trae tres amarillos a ΔE 1,8 entre sí. Cambiarlos por colores más distintos sería perder lo que hace útil al color, que el votante lo reconozca, y no hace falta: acá nada se identifica sólo por color. Cada segmento de la cinta lleva su sigla y su cantidad de bancas, la leyenda repite sigla por sigla y las tablas son de texto. El conversor avisa cuando encuentra colores parecidos, pero no los toca.

`fuente` es la línea de procedencia que la página muestra arriba. Sólo aparece si el archivo la trae: las nóminas que uno cargue no quedan acreditadas a nadie por defecto. La `url` tiene que ser http o https; cualquier otra cosa se descarta.

### Esquema

El formato está descrito en [`datos/schema.json`](datos/schema.json) (JSON Schema, draft 2020-12). Los archivos de `datos/` lo referencian con `"$schema": "schema.json"`, así que un editor con soporte de JSON Schema (VS Code y varios más) autocompleta los campos y marca los errores.

Lo único obligatorio es `listas` con al menos una lista; todo lo demás tiene valor por defecto, y `{"listas": [{}]}` es válido. El esquema es más estricto que el cargador en un solo aspecto: no admite propiedades que no conozca. El cargador las ignora sin avisar, así que un `bankas` mal escrito se pierde en silencio; validando contra el esquema salta.

Los archivos que exporta la app no llevan `$schema`, porque la referencia es relativa a `datos/` y no resolvería desde la carpeta de descargas. Para validarlos, se los mueve al lado del esquema o se le pasa la ruta al validador.

Hay dos ejemplos para importar:

- [`datos/ejemplo.json`](datos/ejemplo.json): mínimo, para ver el formato.
- [`datos/ejemplo-star-wars.json`](datos/ejemplo-star-wars.json): 3 listas, 10 bancas y voto preferente. El Imperio saca 5 bancas, la Rebelión 4 y los Separatistas 1.

  Está armado para mostrar que las bancas las gana la lista, no el candidato. En el Imperio sólo dos nombres juntaron votos: Vader 96.000 y Palpatine 63.000, y Vader pasa a Palpatine aunque el partido lo puso segundo. Los otros diez son stormtroopers con un voto cada uno, salvo TD-9091, que tiene dos.

  Los 452.000 votos de la lista alcanzan para 5 bancas, así que después de Vader y Palpatine quedan tres. La tercera se la lleva TD-9091, que iba último de los doce: con un voto más que el resto sube nueve lugares y entra. Las otras dos van a TK-421 y TK-422, con un voto cada uno; como empatan, el orden lo decide la nómina del partido, que es lo que manda el Artículo 258 para los empates de preferencias.

  La Rebelión queda de contraste, con votos repartidos como en una lista normal: Luke pasa a Leia, Mon Mothma cae del segundo lugar al cuarto y entra por la última banca, Jyn Erso queda primera suplente.

## Cómo se calcula

La norma es el Artículo 258 del Código Electoral ([Ley N° 834/96](https://www.bacn.gov.py/leyes-paraguayas/2346/ley-n-834-establece-el-codigo-electoral-paraguayo)), con el texto vigente de la [Ley N° 6918/2022](https://www.bacn.gov.py/leyes-paraguayas/10452/ley-n-6918-modifica-los-articulos-170-246-247-248-y-258-de-la-ley-n-8341996-que-establece-el-codigo-electoral-paraguayo-y-sus-modificatorias-leyes-ns-31662007-y-63182019). Las listas desbloqueadas con voto preferente vienen de la [Ley N° 6318/2019](https://www.bacn.gov.py/leyes-paraguayas/8850/ley-n-6318-modifica-la-ley-n-83496-que-establece-el-codigo-electoral-paraguayo-modificado-por-la-ley-n-316607-que-modifica-los-articulos-106-170-246-247-248-y-258-de-la-ley-n-83496-que-establece-el-codigo-electoral-paraguayo-e-incorpora-el-sistema-de-listas-cerradas-desbloqueadas-y-de-representacion-proporcional-para-cargos-pluripersonales).

**Entre listas.** Para cada lista se divide su total de votos por 1, 2, 3… y se ordenan todos los cocientes de mayor a menor: las bancas van a los más altos. Se adjudica banca por banca, comparando los cocientes con productos cruzados de enteros (`vᵢ · dⱼ` contra `vⱼ · dᵢ`) en vez de dividir, para que un empate exacto se detecte como tal y no quede escondido detrás de un error de redondeo.

**Empates de cocientes.** El Artículo 258 los resuelve en dos pasos: a igual cociente la banca va a la lista con más votos, y sólo si el empate persiste se define por sorteo. El primer paso se aplica seguido, porque dos listas con distinto total pueden empatar en un cociente (100 ÷ 1 y 200 ÷ 2 dan lo mismo); ese caso lo resuelve el cálculo. El segundo no lo puede resolver una herramienta, así que cuando aparece queda señalado en pantalla: la banca se muestra adjudicada a la primera por orden de lista y se aclara que esa parte la define el sorteo.

**Dentro de cada lista.** Las bancas se asignan por orden de la nómina, o por votos preferentes de mayor a menor si la lista está desbloqueada. El Artículo 258 agrega dos reglas que la herramienta sigue:

- **Empate de votos preferentes** entre candidatos de una misma lista: se define «en favor del orden inicial propuesto» por el partido.
- **Si los electos por preferencia no llenan las bancas ganadas**, los lugares faltantes se completan «con los nombres propuestos por la lista original, según el orden en ella establecido, excluyendo los de aquellos que hayan obtenido votos preferenciales». En la práctica: primero van los que sacaron votos preferentes, de mayor a menor; después los que no sacaron ninguno, en el orden original de la nómina; y nadie aparece dos veces.

### El total de cada lista

El artículo dice que «los votos preferenciales totales de cada lista» establecen la cantidad de escaños. Bajo esa lectura cada voto va a un candidato y el total de la lista es la suma de sus preferentes: para eso se deja `soloLista` en 0.

Se admite igual un voto de sola lista (el que elige la lista sin nombrar candidato) porque el total de la lista puede venir informado aparte del detalle por candidato. Si no existen esos votos, queda en 0 y no cambia nada.

En Paraguay no existen: la Ley N° 6318/2019 sólo contempla el voto que nombra al candidato dentro de la casilla de su lista, así que con listas desbloqueadas todo voto entra al total por la vía de un candidato.

Las dos páginas trabajan sobre el mismo par de números desde puntas distintas: en la página por lista se escribe el total y los votos preferentes lo reparten; en la de candidatos se cargan los votos de cada uno y el total se recalcula. Ir y volver entre las dos no cambia ningún total.

### Lo que la herramienta no hace

El artículo también dice que el voto preferencial «se computará también para la lista de candidatos suplentes». Acá no se modelan suplentes: se calculan las bancas y quiénes las ocupan como titulares.

## Estructura

```
index.html                          página por lista
candidatos.html                     página por candidato
ayuda.html                          guía breve para usar la calculadora
favicon.svg                         ícono
og.png                              imagen de la vista previa al compartir (generada)
LICENSE                             GNU AGPL versión 3
CLAUDE.md                           lo que conviene saber antes de tocar el código
.nojekyll                           que GitHub Pages publique los archivos tal cual
_headers                            cabeceras de seguridad para Cloudflare Pages
.github/workflows/tests.yml         corre los tres tests en cada push
datos/indice.json                   qué elecciones ofrece el desplegable
js/core.js                          estado, cálculo D'Hondt, orden interno, color, formato
css/base.css                        estilos compartidos
datos/asuncion-junta-municipal.json candidaturas de Asunción (generado)
datos/encarnacion-junta-municipal.json   candidaturas de Encarnación (generado)
datos/ciudad-del-este-junta-municipal.json  candidaturas de Ciudad del Este (generado)
datos/senadores-2023.json           resultados reales de los Senadores 2023 (generado)
datos/asuncion-junta-municipal-2021.json  resultados reales de Asunción 2021 (generado)
datos/schema.json                   JSON Schema del formato
datos/ejemplo.json                  ejemplo mínimo del formato
datos/ejemplo-star-wars.json        ejemplo chico: electos con un solo voto preferente
tools/tsje-a-json.mjs               conversor de las candidaturas del TSJE
tools/pdf-resultados-a-json.py      conversor de los PDF de resultados oficiales
tools/xlsx-preferentes-a-json.py    conversor de la planilla de preferentes 2021
tools/og.mjs                        genera og.png con un navegador headless
tests/dhondt.test.mjs               cálculo
tests/datos.test.mjs                datos generados
tests/schema.test.mjs               los datos contra el esquema
```

Las dos páginas comparten `js/core.js`, así que el cálculo está escrito una sola vez. Son scripts clásicos, no módulos, para que las páginas también funcionen abiertas con `file://`.

## Tests

Sin dependencias: cargan `js/core.js` tal cual lo usa el navegador.

```sh
node tests/dhondt.test.mjs
node tests/datos.test.mjs
node tests/schema.test.mjs
```

`dhondt.test.mjs` verifica el reparto contra el ejemplo canónico del método, contra una implementación por fuerza bruta de los mayores cocientes y en unos miles de casos aleatorios (que la suma de bancas cierre, que más votos nunca den menos bancas), además del umbral, los empates, el reordenamiento por voto preferente, la ida y vuelta entre las dos vistas y la lectura de JSON. Del sorteo de «Votos al azar» comprueba, en 300 tiradas, que ninguna lista quede en cero sea cual sea la cantidad, que las sumas cierren, que el resultado salga desparejo, que la ganadora caiga en cualquier posición de la boleta y que el voto preferente reordene siempre algo.

`datos.test.mjs` comprueba los tres conjuntos municipales generados: cantidad de listas, bancas y candidatos; nóminas completas, sin nombres de relleno ni votos precargados; números de lista y siglas sin repetir; y que cada color oficial alcance 3:1 contra el fondo en los dos modos. También comprueba los dos resultados oficiales, el ejemplo de Star Wars y la elección con la que se abre la página (toda en cero, sin fuente, sin nombres que se confundan con algo real).

Los dos resultados oficiales se verifican hasta los nombres: los 45 senadores de 2023 en el orden en que se adjudicó cada banca, y los 24 concejales de Asunción 2021. En los dos casos el voto preferente reordenó casi todas las nóminas, así que no alcanza con repartir bien entre listas. El caso de Asunción fija además cuánto las movió: si eso diera cero, la nómina y el resultado coincidirían y el caso pasaría sin probar nada.

`schema.test.mjs` valida contra el esquema todos los archivos del índice y prueba una veintena de casos que tiene que rechazar. Trae un validador propio que cubre sólo las palabras clave que el esquema usa (hay una prueba que falla si aparece alguna sin implementar); el esquema además se verificó aparte con [ajv](https://ajv.js.org/) en modo estricto, que coincidió en todos los casos.

## Licencia

Copyright (C) 2026 Marcelo Elizeche Landó.

Software libre bajo la [Licencia Pública General Affero de GNU, versión 3](LICENSE) o posterior (AGPL-3.0-or-later), sin ninguna garantía. Se puede usar, estudiar, copiar y modificar; lo que se distribuya a partir de esto tiene que quedar también bajo la AGPL, con su código disponible.

Lo que agrega la AGPL sobre la GPL común es la sección 13: si alguien corre una versión modificada como sitio web, tiene que ofrecerles el código a las personas que la usan, aunque nunca les entregue un archivo. Un calculador electoral se usa por la red y casi nunca se descarga, así que es el caso que esa cláusula cubre. Por eso las dos páginas llevan al pie un enlace al repositorio, que es la forma que la propia licencia sugiere de cumplirlo.

Las candidaturas y los resultados de `datos/` son información pública del [TSJE](https://tsje.gov.py/) y no son obra de este proyecto: la licencia cubre el programa, no los datos oficiales que convierte.

---

Herramienta de cálculo no oficial, sin relación con el TSJE ni con ningún partido.
