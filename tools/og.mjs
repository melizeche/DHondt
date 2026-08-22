/* Genera og.png, la imagen que se ve al compartir el enlace.
 *
 *   npm i -D playwright && node tools/og.mjs
 *
 * Playwright no es dependencia del proyecto: esto se corre a mano cuando
 * cambia el diseño. Con CHROMIUM=<ruta> se le indica un navegador ya
 * instalado en vez del que baja Playwright.
 *
 * Dibuja el ejemplo de datos/ejemplo.json (listas A, B y C) y no una elección
 * real: la herramienta sirve para cualquiera, así que la vista previa no tiene
 * por qué mostrar partidos concretos con sus colores. El reparto que se ve es
 * el que calcula el propio js/core.js con esos votos, no números inventados.
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { normalizar, calcularDHondt, ajustarParaFondo, PALETA } = require("../js/core.js");

const datos = JSON.parse(readFileSync(new URL("../datos/ejemplo.json", import.meta.url), "utf8"));
const estado = normalizar(datos);
const res = calcularDHondt(estado.listas, estado.bancas, estado.umbral);

// colorDe() del sitio necesita el navegador; acá se resuelve igual pero a mano
function colorClaro(lista) {
  if (lista.colorHex) return ajustarParaFondo(lista.colorHex, false);
  return (PALETA[lista.color] || PALETA[0]).claro;
}

const segmentos = estado.listas
  .map(function (l) { return { sigla: l.sigla, color: colorClaro(l), b: res.ganadas.get(l.id) || 0 }; })
  .filter(function (s) { return s.b > 0; });

const totalBancas = segmentos.reduce(function (a, s) { return a + s.b; }, 0);
console.log("reparto dibujado: " +
  segmentos.map(function (s) { return s.sigla + " " + s.b; }).join(", ") +
  "  (" + totalBancas + " de " + estado.bancas + " bancas)");

const html = `<!doctype html><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; background: #fcfcfb; color: #0b0b0b;
         font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
         padding: 72px 80px; display: flex; flex-direction: column; justify-content: space-between; }
  h1 { font-size: 76px; font-weight: 650; letter-spacing: -0.02em; line-height: 1.05; }
  p  { font-size: 30px; color: #52514e; margin-top: 20px; max-width: 34ch; line-height: 1.35; }
  .ribbon { display: flex; gap: 4px; height: 92px; }
  .seg { border-radius: 6px; display: flex; align-items: center; justify-content: center;
         color: #fff; font-weight: 700; font-size: 26px; white-space: nowrap;
         text-shadow: 0 1px 3px rgba(0,0,0,.45); }
  .pie { display: flex; align-items: baseline; justify-content: space-between;
         font-size: 24px; color: #76756f; margin-top: 26px; }
  .marca { font-weight: 650; color: #1c5cab; }
  .dots { display: flex; gap: 7px; margin-top: 22px; }
  .dot { width: 20px; height: 20px; border-radius: 50%; }
</style>
<body>
  <div>
    <h1>Calculadora D'Hondt</h1>
    <p>Cargá los votos y mirá cómo se reparten las bancas.</p>
  </div>
  <div>
    <div class="ribbon">
      ${segmentos.map(function (s) {
        // sólo lleva sigla el segmento que da el ancho; si no, el número solo
        const etiqueta = s.b / totalBancas >= 0.2 ? s.sigla + " " + s.b : String(s.b);
        return `<div class="seg" style="flex:${s.b}; background:${s.color}">${etiqueta}</div>`;
      }).join("")}
    </div>
    <div class="dots">
      ${segmentos.flatMap(function (s) {
        return Array(s.b).fill(`<div class="dot" style="background:${s.color}"></div>`);
      }).join("")}
    </div>
    <div class="pie"><span>Reparto proporcional · Artículo 258 del Código Electoral</span><span class="marca">bancas.melizeche.com</span></div>
  </div>
</body>`;

const browser = await chromium.launch(
  process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 } })).newPage();
await page.setContent(html);
await page.waitForTimeout(300);
await page.screenshot({ path: fileURLToPath(new URL("../og.png", import.meta.url)) });
await browser.close();
console.log("og.png generado");
