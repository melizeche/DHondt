# CLAUDE.md

**`README.md` is the documentation**: what this is, how D'Hondt works, the JSON
data format, what the converters do. Read it first. This file only records what
is easy to get confidently wrong. Most of it is "don't do the obvious thing".

(In English, like the commit messages. Everything the project ships to readers
is in Spanish.)

## Checks

```sh
node tests/dhondt.test.mjs     # cálculo, empates, sorteo de votos
node tests/datos.test.mjs      # datos generados, elección por defecto
node tests/schema.test.mjs     # todos los datos contra datos/schema.json
```

Run all three after any change. No runner, no watch mode; the same three commands
run again on every push, via `.github/workflows/tests.yml`.

To look at the site: `python3 -m http.server`. Opening `index.html` from disk
also has to keep working (see below).

## No build, no dependencies

There is no `package.json` and there should not be one. The suites are plain
node scripts importing nothing outside `node:` builtins. Playwright, pdfplumber
and ajv are used by hand when regenerating assets or double-checking the schema;
none is a project dependency.

## Classic scripts, not ES modules

`js/core.js` loads via `<script src>` and exports through a guarded
`module.exports` so node can require it. Do not convert it to an ES module or
add `type="module"`: the site is meant to work opened from disk, and `file://`
blocks module imports as cross-origin.

Same constraint on `fetch`: the election dropdown needs a server, so it hides
itself under `file://`. Anything new that depends on `fetch` has to degrade the
same way instead of leaving a broken page.

## Language

- **Spanish**: UI text, code comments, identifiers, README, data files.
- **English**: commit messages, PR titles and bodies, this file.
- `datos/schema.json` is the one deliberately English filename, because editors
  resolve JSON Schema by that name. The vocabulary in the code still says
  *esquema*.

## Generated vs hand-written data

Re-run the converter, don't hand-edit:

- the three `*-junta-municipal.json` ← `tools/tsje-a-json.mjs`
- `senadores-2023.json` ← `tools/pdf-resultados-a-json.py`
- `og.png` ← `tools/og.mjs` (needs Playwright)

`ejemplo.json` and `ejemplo-star-wars.json` are hand-written and meant to be
edited by hand. Every file in `datos/` must stay valid against the schema and be
listed in `datos/indice.json`.

## Tests that are the point

A few assertions exist to catch reality drifting, not to describe the code. If
one of these fails, the calculation changed and that is the news. Do not
"fix a brittle test":

- the 2023 Senate allocation (ANR 23, Alianza 12, PCN 5, PEN 2, one each for
  PPQ, Frente Guasu and Yo Creo) is the officially proclaimed composition,
  computed from the PDF totals. It is the largest end-to-end check against a
  real election, down to the 45 names in the TSJE's order of adjudication. The
  official roll lives in the test, never in the data file: the JSON the
  calculator loads carries votes, not the answer.
- the 2021 Asunción council (ANR 15, PLRA 5, PPQ 3, EC 1) and the 24 names
  that took those seats, computed from every candidate's preferential votes.
  Both real elections check the internal ordering; this one also asserts how
  far the preferential vote moved the nóminas, so the case cannot pass with
  the lists left in their original order.
- the Star Wars example: the Empire's 5 seats go to Vader, Palpatine and three
  stormtroopers on **one preferential vote each**. The file exists to show that
  seats are won by the list, not by the candidate.
- the Article 258 quotient table is checked against the figures published in the
  article itself.

## Stances that look like bugs

- **Ties are signalled, never resolved.** Article 258 sends a real tie to a
  sorteo, so the pages mark it and stop. Do not implement a tiebreak.
- **Official ballot colours are kept as they are**, even when two are nearly
  identical. Encarnación ships three yellows at ΔE 1.8. Only luminosity is
  adjusted, at draw time, only to clear 3:1 against the background. Nothing in
  the UI identifies a list by colour alone, so near-identical colours are
  survivable and fidelity to the ballot wins.
- **`Candidato/a N` is a reserved pattern.** `RE_RELLENO` matches it to raise the
  incomplete-nómina warning. Placeholder names not meant to trigger it, like
  the default election's, must be worded differently.
- **The tool never predicts.** Generated data ships with zero votes, the default
  election is invented, and «Votos al azar» says it is a draw. Nothing should
  present computed numbers as a forecast.
- **The umbral field defaults to 0** because Paraguay has no legal threshold. It
  exists to answer "what if", and the UI says so where it sits.

## Licence

AGPL-3.0-or-later. Both pages carry a footer linking to the source; that is how
section 13 is met for a web app, so keep it there.
