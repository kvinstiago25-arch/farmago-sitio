"""
revertir_qa2.py
----------------
Segunda pasada de QA visual (post-descarga Fase 2) encontro que 66 de las
91 imagenes "corregidas" seguian sin coincidir con claridad (sobre todo
mismatch de marca en productos de marcas regionales que las 7 cadenas
permitidas no venden). Este script las revierte a icono generico de
categoria, archiva el archivo descargado incorrecto (no lo borra), y
actualiza productos.json + auditoria_imagenes.csv.
"""

import csv
import json
import shutil
from pathlib import Path

RAIZ = Path(__file__).parent
PRODUCTOS_JSON = RAIZ / "productos.json"
CSV_PATH = RAIZ / "auditoria_imagenes.csv"
REALES_DIR = RAIZ / "imagenesmedimentos" / "reales"
DESCARTADAS_DIR = REALES_DIR / "_descartadas_qa2"
QA2_TXT = RAIZ / "reportes" / "qa2_sospechosas.txt"

try:
    from descargar_imagenes_serper import generic_for
except ImportError:
    CATEGORY_TO_GENERIC = {}

sospechosas = {}
for linea in QA2_TXT.read_text(encoding="utf-8").splitlines():
    linea = linea.strip()
    if not linea:
        continue
    sku, nota = linea.split("|", 1)
    sospechosas[sku.strip()] = nota.strip()

print(f"SKUs a revertir: {len(sospechosas)}")

productos = json.loads(PRODUCTOS_JSON.read_text(encoding="utf-8-sig"))
productos_por_id = {p["id"]: p for p in productos}

DESCARTADAS_DIR.mkdir(parents=True, exist_ok=True)
movidos = 0
for sku in sospechosas:
    prod = productos_por_id.get(sku)
    if prod is None:
        print(f"  [!] {sku} no encontrado en productos.json")
        continue
    for f in REALES_DIR.glob(f"{sku}.*"):
        if f.is_file():
            shutil.move(str(f), str(DESCARTADAS_DIR / f.name))
            movidos += 1
    prod["imagen"] = generic_for(str(prod.get("categoria", "")))

print(f"Archivos movidos a {DESCARTADAS_DIR}: {movidos}")

PRODUCTOS_JSON.write_text(json.dumps(productos, ensure_ascii=False, indent=2), encoding="utf-8")
print("productos.json actualizado.")

filas = list(csv.DictReader(open(CSV_PATH, encoding="utf-8-sig")))
for fila in filas:
    sku = fila["sku"]
    if sku in sospechosas:
        fila["estado_actual"] = "sin_resolver"
        fila["ruta_imagen_actual"] = productos_por_id[sku]["imagen"]
        fila["ubicacion"] = "genericas"
        nota_qa2 = f"QA2 tras Fase 2: sigue sin coincidir ({sospechosas[sku]}); imagen descartada movida a _descartadas_qa2/"
        fila["notas"] = f"{fila['notas']}; {nota_qa2}" if fila["notas"] else nota_qa2

with open(CSV_PATH, "w", newline="", encoding="utf-8-sig") as f:
    writer = csv.DictWriter(f, fieldnames=["sku", "nombre", "estado_actual", "ruta_imagen_actual", "ubicacion", "notas"], extrasaction="ignore")
    writer.writeheader()
    for fila in filas:
        writer.writerow(fila)

from collections import defaultdict
resumen = defaultdict(int)
for fila in filas:
    resumen[fila["estado_actual"]] += 1
print("\n=== RESUMEN FINAL (tras QA2) ===")
for k, v in sorted(resumen.items()):
    print(f"  {k}: {v}")
print(f"Total filas: {len(filas)}")
