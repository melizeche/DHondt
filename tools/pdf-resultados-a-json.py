#!/usr/bin/env python3
"""Convierte un PDF de resultados oficiales del TSJE al JSON de la calculadora.

    pip install pdfplumber
    python3 tools/pdf-resultados-a-json.py SENADORES_2023.pdf \
        --bancas 45 \
        --eleccion "Elecciones Generales 2023 — Senadores (resultados oficiales)" \
        --salida datos/senadores-2023.json

pdfplumber no es dependencia del proyecto: esto se corre a mano cuando hay un
PDF nuevo que convertir, no para usar el sitio.

El PDF tiene dos partes. La primera página es el resumen —una fila por lista con
su total, más nulos, blancos y el total general—. Las siguientes traen los votos
preferentes de cada candidato, en tres columnas por página, ordenados de mayor a
menor voto; la columna «Opcion» es el lugar que ocupaba en la nómina.

Como el JSON de la calculadora espera los candidatos en el orden de la nómina
—el voto preferente los reordena después—, acá se los devuelve ordenados por
«Opcion», no por votos.

El script no escribe nada si las cuentas no cierran: los preferentes de cada
lista tienen que sumar su total, las opciones ir de 1 a N sin huecos, y la suma
de listas más blancos y nulos dar el total que declara el PDF.
"""
import argparse
import json
import re
import sys

import pdfplumber

# Las tres columnas de las páginas de preferentes, en coordenadas del PDF. El
# recorte tiene que caer entre el último dígito de una columna y el primer
# número de la siguiente: si parte una cifra al medio, los totales no cierran.
COLUMNAS = [(35, 215), (216, 393), (394, 578)]
# Debajo del encabezado «Opcion / Votos»: más arriba está el título, que
# termina en «…30 DE ABRIL 2023» y se colaría como una fila más.
DESDE_Y = 104

FILA = re.compile(r"^(\d+)\s+(.+?)\s+([\d,]+)$")
ESPECIALES = ("VOTOS NULOS", "VOTOS EN BLANCO", "TOTAL DE VOTOS", "ELECTORES HABILITADOS")


def entero(texto):
    return int(texto.replace(",", ""))


def leer_resumen(texto):
    listas, extras = [], {}
    for linea in texto.split("\n"):
        linea = linea.strip()
        for clave in ESPECIALES:
            if linea.startswith(clave):
                resto = linea[len(clave):].strip()
                if resto.replace(",", "").isdigit():
                    extras[clave] = entero(resto)
                break
        else:
            m = FILA.match(linea)
            if m:
                listas.append({"numero": int(m.group(1)),
                               "partido": m.group(2).strip(),
                               "votos": entero(m.group(3))})
    return listas, extras


def leer_columna(encabezado, cuerpo):
    m = re.search(r"Lista\s+(\d+)", encabezado)
    if not m:
        return None, []
    filas = []
    for linea in cuerpo.split("\n"):
        f = FILA.match(linea.strip())
        if f:
            filas.append({"opcion": int(f.group(1)),
                          "nombre": f.group(2).strip(),
                          "pref": entero(f.group(3))})
    return int(m.group(1)), filas


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pdf")
    ap.add_argument("--bancas", type=int, required=True)
    ap.add_argument("--eleccion", required=True)
    ap.add_argument("--salida", required=True)
    ap.add_argument("--fuente", default="resultados oficiales del TSJE")
    args = ap.parse_args()

    with pdfplumber.open(args.pdf) as pdf:
        resumen, extras = leer_resumen(pdf.pages[0].extract_text() or "")
        por_lista = {}
        for pagina in pdf.pages[1:]:
            for x0, x1 in COLUMNAS:
                encabezado = pagina.crop((x0, 0, x1, DESDE_Y)).extract_text() or ""
                cuerpo = pagina.crop((x0, DESDE_Y, x1, pagina.height)).extract_text() or ""
                numero, filas = leer_columna(encabezado, cuerpo)
                if numero is not None:
                    por_lista.setdefault(numero, []).extend(filas)

    problemas = []
    if not resumen:
        problemas.append("no se encontró el resumen en la primera página")

    listas = []
    for l in sorted(resumen, key=lambda x: x["numero"]):
        filas = sorted(por_lista.get(l["numero"], []), key=lambda f: f["opcion"])
        opciones = [f["opcion"] for f in filas]
        if opciones != list(range(1, len(filas) + 1)):
            problemas.append(f'lista {l["numero"]}: las opciones no van de 1 a {len(filas)}')
        suma = sum(f["pref"] for f in filas)
        if suma != l["votos"]:
            problemas.append(
                f'lista {l["numero"]}: los preferentes suman {suma:,} y el total dice {l["votos"]:,}')
        listas.append({"numero": l["numero"], "partido": l["partido"],
                       "votos": l["votos"], "filas": filas})

    validos = sum(l["votos"] for l in listas)
    blancos = extras.get("VOTOS EN BLANCO", 0)
    nulos = extras.get("VOTOS NULOS", 0)
    if "TOTAL DE VOTOS" in extras and validos + blancos + nulos != extras["TOTAL DE VOTOS"]:
        problemas.append(f'válidos + blancos + nulos = {validos + blancos + nulos:,}, '
                         f'y el PDF declara {extras["TOTAL DE VOTOS"]:,}')

    if problemas:
        print("No se escribió nada. Las cuentas no cierran:", file=sys.stderr)
        for p in problemas:
            print("  " + p, file=sys.stderr)
        sys.exit(1)

    # El PDF no trae los colores de la boleta. Los índices de paleta se reparten
    # por caudal de votos, así las listas que sacan bancas —las que se ven en la
    # cinta— quedan con colores distintos entre sí, y las que repiten color son
    # las que no sacaron ninguna.
    rango = {l["numero"]: i for i, l in enumerate(sorted(listas, key=lambda x: -x["votos"]))}

    salida = {
        "$schema": "schema.json",
        "eleccion": args.eleccion,
        "fuente": {"nombre": args.fuente},
        "bancas": args.bancas,
        "umbral": 0,
        "modo": "desbloqueada",
        "blancos": blancos,
        "nulos": nulos,
        "listas": [{
            "numero": l["numero"],
            "partido": l["partido"],
            "sigla": l["partido"][:12],
            "color": rango[l["numero"]] % 8,
            "votos": l["votos"],
            "soloLista": 0,
            "candidatos": [{"nombre": f["nombre"], "pref": f["pref"]} for f in l["filas"]],
        } for l in listas],
    }

    with open(args.salida, "w", encoding="utf-8") as fh:
        json.dump(salida, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    candidatos = sum(len(l["filas"]) for l in listas)
    print(f"{len(listas)} listas, {candidatos} candidatos, {validos:,} votos válidos → {args.salida}",
          file=sys.stderr)
    print("Las siglas salen recortadas del nombre del partido: conviene repasarlas.", file=sys.stderr)


if __name__ == "__main__":
    main()
