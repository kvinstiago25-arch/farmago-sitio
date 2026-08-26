"""
procesar_qa_retry2.py
------------------------
Aplica el resultado del QA visual de los 103 candidatos del reintento 2
(dominios ampliados): "ok" -> registra en productos.json y marca
"corregida"; "sospechosa" -> mueve el archivo a
reales/_descartadas_qa2/ y deja "sin_resolver".
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

from descargar_imagenes_serper import generic_for

resultados = {}
for nombre_archivo in ("qa_retry2_a.txt", "qa_retry2_b.txt"):
    for linea in (RAIZ / "reportes" / nombre_archivo).read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if not linea:
            continue
        sku, estado = linea.split("|")
        resultados[sku.strip()] = estado.strip()

print(f"Total resultados QA retry2: {len(resultados)}")

productos = json.loads(PRODUCTOS_JSON.read_text(encoding="utf-8-sig"))
productos_por_id = {p["id"]: p for p in productos}

DESCARTADAS_DIR.mkdir(parents=True, exist_ok=True)
ok_ids, sospechosa_ids = [], []

for sku, estado in resultados.items():
    prod = productos_por_id.get(sku)
    if prod is None:
        print(f"  [!] {sku} no encontrado en productos.json")
        continue
    archivos = list(REALES_DIR.glob(f"{sku}.*"))
    archivo = archivos[0] if archivos else None

    if estado == "ok":
        if archivo is None:
            print(f"  [!] {sku} marcado ok pero no tiene archivo candidato en disco")
            continue
        prod["imagen"] = f"imagenesmedimentos/reales/{archivo.name}"
        ok_ids.append(sku)
    else:
        if archivo is not None:
            shutil.move(str(archivo), str(DESCARTADAS_DIR / archivo.name))
        prod["imagen"] = generic_for(str(prod.get("categoria", "")))
        sospechosa_ids.append(sku)

PRODUCTOS_JSON.write_text(json.dumps(productos, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"productos.json actualizado: {len(ok_ids)} corregidos, {len(sospechosa_ids)} vueltos a generico")

filas = list(csv.DictReader(open(CSV_PATH, encoding="utf-8-sig")))
for fila in filas:
    sku = fila["sku"]
    if sku in ok_ids:
        fila["estado_actual"] = "corregida"
        fila["ruta_imagen_actual"] = productos_por_id[sku]["imagen"]
        fila["ubicacion"] = "reales"
        nota = "Fase 2 reintento 2 (dominios ampliados: Colsubsidio/Olimpica/San Jorge/Exito): confirmada por QA visual"
        fila["notas"] = f"{fila['notas']}; {nota}" if fila["notas"] else nota
    elif sku in sospechosa_ids:
        fila["estado_actual"] = "sin_resolver"
        fila["ruta_imagen_actual"] = productos_por_id[sku]["imagen"]
        fila["ubicacion"] = "genericas"
        nota = "Fase 2 reintento 2 (dominios ampliados): candidato encontrado pero sigue sin coincidir tras QA visual"
        fila["notas"] = f"{fila['notas']}; {nota}" if fila["notas"] else nota

with open(CSV_PATH, "w", newline="", encoding="utf-8-sig") as f:
    writer = csv.DictWriter(f, fieldnames=["sku", "nombre", "estado_actual", "ruta_imagen_actual", "ubicacion", "notas"], extrasaction="ignore")
    writer.writeheader()
    for fila in filas:
        writer.writerow(fila)

from collections import defaultdict
resumen = defaultdict(int)
for fila in filas:
    resumen[fila["estado_actual"]] += 1
print("\n=== RESUMEN ===")
for k, v in sorted(resumen.items()):
    print(f"  {k}: {v}")
print(f"Total filas: {len(filas)}")
