"""
Agrega el campo "imagenTransparente" (true/false) a cada producto de
productos.json, usando el resultado mas reciente de
reportes/transparencia_productos.json (generado por
detectar_transparencia_productos.py).
"""
import json

with open("reportes/transparencia_productos.json", encoding="utf-8") as f:
    reporte = json.load(f)

with open("productos.json", encoding="utf-8") as f:
    productos = json.load(f)

marcados_true = 0
for p in productos:
    info = reporte.get(p["id"])
    es_transparente = bool(info and info.get("transparente"))
    p["imagenTransparente"] = es_transparente
    if es_transparente:
        marcados_true += 1

with open("productos.json", "w", encoding="utf-8") as f:
    json.dump(productos, f, ensure_ascii=False, indent=2)

print(f"Total productos: {len(productos)}")
print(f"Marcados imagenTransparente=true: {marcados_true}")
