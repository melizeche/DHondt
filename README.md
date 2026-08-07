# Calculadora D'Hondt — Junta Municipal de Asunción

Sitio estático para repartir las bancas de la Junta Municipal de Asunción por el
método D'Hondt y ver **qué candidatos resultan electos concejales**.

No necesita servidor ni build: abrí `index.html` en el navegador.

Sirve para **cualquier elección proporcional por listas**: las bancas, las
listas, las nóminas y el modo se cargan desde un JSON. Viene con la Junta
Municipal de Asunción porque es para lo que se hizo, pero no está atada a ella.

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

## Elegir otra elección

El desplegable **Elección** lista los conjuntos de datos de `datos/`, según
[`datos/indice.json`](datos/indice.json). Para agregar uno: se deja el JSON en
`datos/` y se le suma una entrada al índice.

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

Un detalle de cómo funciona: el desplegable trae los archivos con `fetch`, que
es del mismo origen y no necesita nada del otro lado… pero sí necesita **un**
servidor. Abriendo el HTML con doble clic (`file://`) el navegador bloquea esos
pedidos por CORS, así que ahí el desplegable no aparece: se ve la elección que
viene embebida en `js/datos-asuncion.js` y se puede cambiar con «Importar JSON»,
que lee del disco y funciona siempre. Servido —Cloudflare Pages, GitHub Pages,
`python3 -m http.server`— aparece y anda.

Cuál quedó elegida se recuerda en el navegador y vale para las dos páginas.
Importar un archivo suelto deja el desplegable en «— datos cargados —», porque
lo que hay no sale del índice.

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

### Esquema

El formato está descrito en [`datos/esquema.json`](datos/esquema.json)
(JSON Schema, draft 2020-12). Los archivos de `datos/` lo referencian con
`"$schema": "esquema.json"`, así que un editor con soporte de JSON Schema
—VS Code y varios más— autocompleta los campos y marca los errores mientras se
escribe.

Lo único obligatorio es `listas` con al menos una lista; todo lo demás tiene
valor por defecto, al punto de que `{"listas": [{}]}` es válido. El esquema es
un poco **más estricto que el cargador** en un solo aspecto: no admite
propiedades que no conozca. El cargador las ignora sin decir nada, y así un
`bankas` mal escrito se pierde en silencio; validando contra el esquema salta.

Los archivos que exporta la app no llevan `$schema`, porque la referencia es
relativa a `datos/` y no resolvería desde la carpeta de descargas. Para
validarlos, se los mueve al lado del esquema o se le pasa la ruta al validador.

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

La norma es el **Artículo 258 del Código Electoral**
([Ley N° 834/96](https://www.bacn.gov.py/leyes-paraguayas/2346/ley-n-834-establece-el-codigo-electoral-paraguayo)),
con el texto vigente de la
[Ley N° 6918/2022](https://www.bacn.gov.py/leyes-paraguayas/10452/ley-n-6918-modifica-los-articulos-170-246-247-248-y-258-de-la-ley-n-8341996-que-establece-el-codigo-electoral-paraguayo-y-sus-modificatorias-leyes-ns-31662007-y-63182019).
Las listas desbloqueadas con voto preferente vienen de la
[Ley N° 6318/2019](https://www.bacn.gov.py/leyes-paraguayas/8850/ley-n-6318-modifica-la-ley-n-83496-que-establece-el-codigo-electoral-paraguayo-modificado-por-la-ley-n-316607-que-modifica-los-articulos-106-170-246-247-248-y-258-de-la-ley-n-83496-que-establece-el-codigo-electoral-paraguayo-e-incorpora-el-sistema-de-listas-cerradas-desbloqueadas-y-de-representacion-proporcional-para-cargos-pluripersonales).

**Entre listas.** Para cada lista se divide su total de votos por 1, 2, 3… y se
ordenan todos los cocientes de mayor a menor: las bancas van a los más altos. Se
adjudica banca por banca, comparando los cocientes con productos cruzados de
enteros (`vᵢ · dⱼ` contra `vⱼ · dᵢ`) en vez de dividir, para que un empate exacto
se detecte como tal y no quede escondido detrás de un error de redondeo.

**Empates de cocientes.** El Artículo 258 los resuelve en dos pasos: a igual
cociente la banca va a la lista **con más votos**, y sólo si el empate persiste
se define **por sorteo**. El primer paso hace trabajo de verdad, porque dos
listas con distinto total pueden empatar en un cociente (100 ÷ 1 y 200 ÷ 2 dan
lo mismo); ese caso lo resuelve el cálculo. El segundo no lo puede resolver una
herramienta, así que cuando aparece queda señalado en pantalla: la banca se
muestra adjudicada a la primera por orden de lista y se aclara que esa parte la
define el sorteo.

**Dentro de cada lista.** Las bancas se asignan por orden de la nómina, o por
votos preferentes de mayor a menor si la lista está desbloqueada. El Artículo
258 agrega dos reglas que la herramienta sigue:

- **Empate de votos preferentes** entre candidatos de una misma lista: se define
  «en favor del orden inicial propuesto» por el partido.
- **Si los electos por preferencia no llenan las bancas ganadas**, los lugares
  faltantes se completan «con los nombres propuestos por la lista original,
  según el orden en ella establecido, excluyendo los de aquellos que hayan
  obtenido votos preferenciales». En la práctica: primero van los que sacaron
  votos preferentes, de mayor a menor; después los que no sacaron ninguno, en el
  orden original de la nómina; y nadie aparece dos veces.

### Un detalle sobre el total de cada lista

El artículo dice que «los votos preferenciales totales de cada lista» establecen
la cantidad de escaños. Bajo esa lectura estricta cada voto va a un candidato y
el total de la lista es la suma de sus preferentes: para eso, se deja
`soloLista` en 0 y la herramienta hace exactamente eso.

Se admite igual un voto de sola lista —el que elige la lista sin nombrar
candidato— porque el total de la lista puede venir informado aparte del detalle
por candidato. Es un supuesto más general: si no existen esos votos, queda en 0
y no cambia nada.

### Lo que la herramienta no hace

El artículo también dice que el voto preferencial «se computará también para la
lista de candidatos suplentes». Acá no se modelan suplentes: se calculan las
bancas y quiénes las ocupan como titulares.

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
favicon.svg                         ícono
og.png                              imagen de la vista previa al compartir (generada)
.nojekyll                           que GitHub Pages publique los archivos tal cual
_headers                            cabeceras de seguridad para Cloudflare Pages
datos/indice.json                   qué elecciones ofrece el desplegable
js/core.js                          estado, cálculo D'Hondt, orden interno, color, formato
js/datos-asuncion.js                candidaturas que las páginas traen cargadas (generado)
css/base.css                        estilos compartidos
datos/asuncion-junta-municipal.json las mismas candidaturas, para importar (generado)
datos/esquema.json                  JSON Schema del formato
datos/ejemplo.json                  ejemplo mínimo del formato
datos/ejemplo-star-wars.json        ejemplo chico: 3 listas, 10 bancas, voto preferente
tools/tsje-a-json.mjs               conversor de los datos del TSJE
tests/dhondt.test.mjs               cálculo
tests/datos.test.mjs                datos generados
tests/esquema.test.mjs              los datos contra el esquema
```

Las dos páginas comparten `js/core.js`, así que el cálculo está escrito una sola
vez. Son scripts clásicos, no módulos, justamente para que las páginas también
funcionen abiertas con `file://`.

## Tests

Sin dependencias: cargan `js/core.js` tal cual lo usa el navegador.

```sh
node tests/dhondt.test.mjs
node tests/datos.test.mjs
node tests/esquema.test.mjs
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

`esquema.test.mjs` valida los tres archivos de `datos/` contra el esquema y
prueba una veintena de casos que tiene que rechazar, para que el esquema no
termine aceptando cualquier cosa. Trae un validador propio que cubre sólo las
palabras clave que el esquema usa —hay una prueba que falla si aparece alguna
sin implementar—; el esquema además se verificó aparte con
[ajv](https://ajv.js.org/) en modo estricto, que coincidió en todos los casos.

## Publicar

Es un sitio estático sin build: HTML, CSS, JS y JSON servidos tal cual. Anda en
cualquier hosting estático y también abriendo `index.html` con doble clic.

### GitHub Pages

No hace falta ningún workflow. Una vez que esto esté en la rama principal:

1. *Settings → Pages*
2. **Source**: «Deploy from a branch»
3. **Branch**: la rama principal, carpeta `/ (root)` → *Save*

Queda en `https://<usuario>.github.io/DHondt/`. El sitio está pensado para
funcionar bajo ese subdirectorio: todas las rutas son relativas, no hay ninguna
que arranque con `/`, y no se usa `fetch`, así que no hay nada que romper ni
ninguna base URL que configurar.

El `.nojekyll` de la raíz le dice a Pages que publique los archivos tal cual en
vez de pasarlos por Jekyll. Con este contenido Jekyll no rompería nada, pero
saltearlo es más rápido y evita sorpresas si mañana se agrega algún archivo que
empiece con guion bajo.

### Cloudflare Pages (sirve con el repositorio privado)

GitHub Pages sólo publica desde repositorios privados en los planes pagos.
Cloudflare Pages lo hace en el plan gratuito, así que es la opción si el
repositorio tiene que seguir privado.

En el panel de Cloudflare: *Workers & Pages → Create → Pages → Connect to Git*,
se elige el repositorio y:

| Ajuste | Valor |
|---|---|
| Framework preset | None |
| Build command | *(vacío)* |
| Build output directory | `/` |
| Root directory | *(vacío)* |

No hay build: se publican los archivos tal cual. Queda en
`https://<proyecto>.pages.dev`, y cada push a la rama elegida vuelve a
desplegar.

**Repositorio privado no es lo mismo que sitio privado.** El código queda
privado, pero lo publicado en `pages.dev` es visible para cualquiera que tenga
el enlace. Si lo que hace falta es que el sitio tampoco sea público, se le pone
adelante **Cloudflare Access** (Zero Trust, gratis hasta 50 usuarios): se
protege con una política por correo o dominio y recién ahí el sitio deja de ser
abierto.

`_headers` es de Cloudflare (Netlify usa el mismo formato) y agrega unas
cabeceras de seguridad. GitHub Pages lo ignora, así que no molesta.

### Vista previa al compartir

Las dos páginas traen etiquetas Open Graph y Twitter Card, así que un enlace
pegado en WhatsApp, X o Slack muestra título, descripción e imagen en vez de una
URL pelada. La imagen es `og.png` (1200×630).

El sitio vive en **`https://bancas.melizeche.com`**. Ese dominio aparece siete
veces entre las dos páginas: `og:url`, `og:image` y `twitter:image` en cada una,
más el `<link rel="canonical">`. Tienen que ser **absolutas**, porque los
scrapers no ejecutan JavaScript y varios no resuelven rutas relativas; si alguna
vez el sitio se muda, son esas líneas las que hay que cambiar.

El `canonical` está porque Cloudflare Pages sirve el mismo contenido también en
`<proyecto>.pages.dev`: sin él, los buscadores ven dos sitios idénticos en dos
dominios.

`og.png` se genera con `tools/og.mjs`: arma la cinta de bancas en HTML y la
fotografía con un navegador headless. Necesita Playwright, que no es dependencia
del proyecto —es para regenerar la imagen si cambia el diseño, no para usar el
sitio— y acepta `CHROMIUM=<ruta>` para usar un navegador ya instalado.

Dibuja **el ejemplo de `datos/ejemplo.json`, no una elección real**: listas A, B
y C con los colores de la paleta. La herramienta sirve para cualquier elección,
así que la vista previa no muestra partidos concretos con sus colores. El
reparto que se ve (7-4-1 sobre 12 bancas) lo calcula el mismo `js/core.js` con
esos votos, así que la imagen no puede quedar mostrando un reparto que el código
no daría.

### Otros

Cualquier hosting estático sirve igual, sin cambios: Netlify, Vercel, Firebase
Hosting o un bucket de Cloud Storage o S3. Nada de esto tiene servidor: los
datos que se cargan quedan en el `localStorage` del navegador y no se envían a
ningún lado.

---

Herramienta de cálculo no oficial, sin relación con el TSJE ni con ningún
partido. Los datos que se cargan quedan solamente en el navegador.
