"""
auditoria_aggregate.py
-----------------------
Toma los resultados de QA visual (reportes/qa_visual_resultado_*.txt) generados
por los subagentes y los fusiona con auditoria_imagenes.csv (que ya tenia el
resultado estructural), actualizando estado_actual y notas para los SKUs
marcados como "sospechosa" tras la inspeccion visual.
"""

import csv
import re
from pathlib import Path

RAIZ = Path(__file__).parent
CSV_PATH = RAIZ / "auditoria_imagenes.csv"
REPORTES_DIR = RAIZ / "reportes"

qa_resultados = {}
lote_files = sorted(REPORTES_DIR.glob("qa_visual_resultado_*.txt"))
for f in lote_files:
    for linea in f.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if not linea or linea.lower().startswith("sku|estado"):
            continue
        partes = linea.split("|")
        if len(partes) < 2:
            continue
        sku, estado = partes[0].strip(), partes[1].strip().lower()
        nota = partes[2].strip() if len(partes) > 2 else ""
        qa_resultados[sku] = (estado, nota)

print(f"Total SKUs con resultado de QA visual: {len(qa_resultados)}")
n_ok = sum(1 for e, _ in qa_resultados.values() if e == "ok")
n_sosp = sum(1 for e, _ in qa_resultados.values() if e == "sospechosa")
print(f"  ok: {n_ok}")
print(f"  sospechosa: {n_sosp}")

filas = list(csv.DictReader(open(CSV_PATH, encoding="utf-8-sig")))
skus_csv = {f["sku"] for f in filas}
faltan_qa = [f["sku"] for f in filas if f["ubicacion"] == "reales" and f["sku"] not in qa_resultados]
print(f"\nSKUs en reales/ SIN resultado de QA visual (deberian ser 0): {len(faltan_qa)}")
if faltan_qa:
    print(faltan_qa)

sobrantes_qa = [sku for sku in qa_resultados if sku not in skus_csv]
if sobrantes_qa:
    print(f"\nSKUs en resultados QA que no existen en el CSV (raro): {sobrantes_qa}")

for fila in filas:
    sku = fila["sku"]
    if sku in qa_resultados:
        estado_qa, nota_qa = qa_resultados[sku]
        if estado_qa == "sospechosa":
            fila["estado_actual"] = "sospechosa"
            nota_previa = fila["notas"]
            nota_nueva = f"QA visual: {nota_qa}" if nota_qa else "QA visual: no coincide con claridad"
            fila["notas"] = f"{nota_previa}; {nota_nueva}" if nota_previa else nota_nueva

with open(CSV_PATH, "w", newline="", encoding="utf-8-sig") as f:
    writer = csv.DictWriter(f, fieldnames=["sku", "nombre", "estado_actual", "ruta_imagen_actual", "ubicacion", "notas"])
    writer.writeheader()
    for fila in filas:
        writer.writerow(fila)

from collections import defaultdict
resumen = defaultdict(int)
for f in filas:
    resumen[f["estado_actual"]] += 1
print("\n=== RESUMEN FINAL estado_actual (Fase 1 completa) ===")
for k, v in sorted(resumen.items()):
    print(f"  {k}: {v}")
print(f"\nTotal filas: {len(filas)}")
print(f"CSV actualizado: {CSV_PATH}")
