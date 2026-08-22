#!/usr/bin/env python3
"""Convierte la planilla de votos preferentes de las Municipales 2021 al JSON de
la calculadora.

    python3 tools/xlsx-preferentes-a-json.py 1VotosPref_Dep_Distrito_JuMu2021_da.xlsx \
        --departamento 0 --distrito 0 --bancas 24 \
        --eleccion "Elecciones Municipales 2021 · Junta Municipal de Asunción" \
        --salida datos/asuncion-junta-municipal-2021.json

La planilla sale de datos.gov.py y trae una fila por candidato de cada Junta
Municipal del país, con sus votos preferentes:

    AÑO  CANDIDATURA  DEPART  DESDEP  DISTRITO  DESDIS  NRO_LISTA  SIGLA
    DESCRIPCION  ORDEN_LISTA  ELECTO-NO  ORDEN FINAL EN LA LISTA
    NOMBRE Y APELLIDO  EDAD  RANGO  SEXO  Total general

Para saber qué código tiene cada ciudad:

    python3 tools/xlsx-preferentes-a-json.py <archivo.xlsx> --listar

No usa openpyxl ni pandas: un .xlsx es un zip de XML y para una planilla de una
sola hoja alcanza con `zipfile` y `xml.etree`, que vienen con Python. Así el
conversor se corre sin instalar nada.

Dos cosas que la planilla no trae y el JSON deja en cero: los votos en blanco y
los nulos. Los totales de cada lista son votos válidos.

El script no escribe nada si las cuentas no cierran: cada lista tiene que tener
su ORDEN_LISTA de 1 a N sin huecos ni repetidos, y la cantidad de filas marcadas
ELECTO tiene que coincidir con las bancas en juego.
"""
import argparse
import json
import sys
import xml.etree.ElementTree as ET
import zipfile

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

# Nombres de columna tal como vienen en la primera fila de la planilla.
DEPART, DESDEP, DISTRITO, DESDIS = "DEPART", "DESDEP", "DISTRITO", "DESDIS"
LISTA, SIGLA, PARTIDO = "NRO_LISTA", "SIGLA", "DESCRIPCION"
ORDEN, ELECTO, NOMBRE, VOTOS = "ORDEN_LISTA", "ELECTO-NO", "NOMBRE Y APELLIDO", "Total general"
CANDIDATURA = "CANDIDATURA"


def indice_columna(ref):
    """A1 → 0, B7 → 1, AA3 → 26."""
    letras = ""
    for ch in ref:
        if not ch.isalpha():
            break
        letras += ch
    n = 0
    for ch in letras:
        n = n * 26 + (ord(ch.upper()) - 64)
    return n - 1


def leer_filas(ruta):
    """Devuelve la hoja como lista de dicts {encabezado: valor}."""
    with zipfile.ZipFile(ruta) as z:
        compartidas = [
            "".join(t.text or "" for t in si.iter(NS + "t"))
            for si in ET.fromstring(z.read("xl/sharedStrings.xml"))
        ]
        encabezados, filas = None, []
        with z.open("xl/worksheets/sheet1.xml") as hoja:
            for _, fila in ET.iterparse(hoja, events=("end",)):
                if fila.tag != NS + "row":
                    continue
                celdas = {}
                for c in fila:
                    v = c.find(NS + "v")
                    if v is None or v.text is None:
                        continue
                    # t="s" es un índice a la tabla de cadenas compartidas.
                    celdas[indice_columna(c.get("r"))] = (
                        compartidas[int(v.text)] if c.get("t") == "s" else v.text)
                if encabezados is None:
                    encabezados = celdas
                else:
                    filas.append({encabezados[i]: v for i, v in celdas.items()
                                  if i in encabezados})
                fila.clear()
    # La planilla termina con una fila de total general y una vacía: se van con
    # el filtro, porque no dicen de qué candidatura son.
    return [f for f in filas if f.get(CANDIDATURA)]


def listar(filas):
    # `--listar | head` o `| grep` cierran la salida antes de tiempo, y sin esto
    # Python lo informa como error. Buscar una ciudad en una lista de 261 es
    # justamente para lo que está.
    try:
        import signal
        signal.signal(signal.SIGPIPE, signal.SIG_DFL)
    except (ImportError, AttributeError, ValueError):
        pass   # en Windows no existe SIGPIPE

    ciudades = {}
    for f in filas:
        clave = (f[DEPART], f[DISTRITO])
        if clave not in ciudades:
            ciudades[clave] = [f[DESDEP], f[DESDIS], 0]
        ciudades[clave][2] += 1
    print(f"{len(ciudades)} distritos:\n")
    print(f"  {'--dep':>6} {'--dis':>6}  {'departamento':<22} {'distrito':<28} candidatos")
    for (dep, dis), (nomdep, nomdis, n) in sorted(
            ciudades.items(), key=lambda x: (x[1][0], x[1][1])):
        print(f"  {dep:>6} {dis:>6}  {nomdep:<22} {nomdis:<28} {n:>6}")


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("xlsx")
    ap.add_argument("--departamento", help="código DEPART de la planilla")
    ap.add_argument("--distrito", help="código DISTRITO de la planilla")
    ap.add_argument("--bancas", type=int,
                    help="bancas en juego (por defecto, las filas marcadas ELECTO)")
    ap.add_argument("--eleccion")
    ap.add_argument("--salida", help="por defecto, la salida estándar")
    ap.add_argument("--fuente", default="votos preferentes de las Municipales 2021, datos.gov.py")
    ap.add_argument("--url", default="https://www.datos.gov.py/dataset/resultados-electorales")
    ap.add_argument("--listar", action="store_true",
                    help="lista los distritos de la planilla con su código y sale")
    args = ap.parse_args()

    filas = leer_filas(args.xlsx)
    if not filas:
        sys.exit("La planilla no tiene filas de candidatos.")

    if args.listar:
        listar(filas)
        return

    if args.departamento is None or args.distrito is None:
        sys.exit("Faltan --departamento y --distrito. Con --listar se ven los códigos.")

    delDistrito = [f for f in filas
                   if f[DEPART] == args.departamento and f[DISTRITO] == args.distrito]
    if not delDistrito:
        sys.exit(f"No hay candidatos con DEPART={args.departamento} y "
                 f"DISTRITO={args.distrito}. Con --listar se ven los códigos.")

    porLista = {}
    for f in delDistrito:
        porLista.setdefault((int(f[LISTA]), f[SIGLA], f[PARTIDO]), []).append(f)

    problemas = []
    electos = sum(1 for f in delDistrito if f[ELECTO] == "ELECTO")
    bancas = args.bancas if args.bancas else electos
    if electos != bancas:
        problemas.append(f"la planilla marca {electos} candidatos como ELECTO "
                         f"y se piden {bancas} bancas")

    listas = []
    for (numero, sigla, partido), cs in sorted(porLista.items()):
        cs.sort(key=lambda c: int(c[ORDEN]))
        ordenes = [int(c[ORDEN]) for c in cs]
        if ordenes != list(range(1, len(cs) + 1)):
            problemas.append(f"lista {numero} ({sigla}): ORDEN_LISTA no va de 1 a {len(cs)}")
        listas.append({
            "numero": numero, "sigla": sigla, "partido": partido,
            "votos": sum(int(c[VOTOS]) for c in cs),
            "candidatos": [{"nombre": c[NOMBRE].strip(), "pref": int(c[VOTOS])} for c in cs],
        })

    if problemas:
        print("No se escribió nada. Las cuentas no cierran:", file=sys.stderr)
        for p in problemas:
            print("  " + p, file=sys.stderr)
        sys.exit(1)

    # La planilla no trae el color de la boleta. Los índices de la paleta se
    # reparten por caudal de votos, así las listas que sacan bancas quedan con
    # colores distintos entre sí y las que repiten son las que no sacaron
    # ninguna. Es el mismo criterio que usa el conversor de los PDF.
    rango = {l["numero"]: i for i, l in enumerate(sorted(listas, key=lambda x: -x["votos"]))}

    nombre = args.eleccion or (
        f"Elecciones Municipales 2021 · Junta Municipal de "
        f"{delDistrito[0][DESDIS].title()}")

    salida = {
        "$schema": "schema.json",
        "eleccion": nombre,
        "fuente": {"nombre": args.fuente, "url": args.url},
        "bancas": bancas,
        "umbral": 0,
        # Las Municipales 2021 se votaron con lista desbloqueada (Ley 6318/2019),
        # que es de donde salen estos votos preferentes.
        "modo": "desbloqueada",
        # La planilla es sólo de votos preferentes: no trae blancos ni nulos.
        "blancos": 0,
        "nulos": 0,
        "listas": [{
            "numero": l["numero"],
            "partido": l["partido"],
            "sigla": l["sigla"],
            "color": rango[l["numero"]] % 8,
            "votos": l["votos"],
            "soloLista": 0,
            "candidatos": l["candidatos"],
        } for l in listas],
    }

    texto = json.dumps(salida, ensure_ascii=False, indent=2) + "\n"
    if args.salida:
        with open(args.salida, "w", encoding="utf-8") as fh:
            fh.write(texto)
    else:
        sys.stdout.write(texto)

    validos = sum(l["votos"] for l in listas)
    print(f"{delDistrito[0][DESDIS]}: {len(listas)} listas, {len(delDistrito)} candidatos, "
          f"{validos:,} votos válidos, {bancas} bancas"
          f"{' → ' + args.salida if args.salida else ''}", file=sys.stderr)
    print("Los votos en blanco y los nulos quedan en cero: la planilla no los trae.",
          file=sys.stderr)


if __name__ == "__main__":
    main()
