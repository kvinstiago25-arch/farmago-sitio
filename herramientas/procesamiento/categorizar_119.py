import csv
import json

productos = {p["id"]: p for p in json.load(open("productos.json", encoding="utf-8"))}
filas = {f["sku"]: f for f in csv.DictReader(open("auditoria_imagenes.csv", encoding="utf-8-sig"))}

objetivo = [l.strip() for l in open("reportes/orden_prioridad_retry3.txt", encoding="utf-8") if l.strip()]
pendientes = [s for s in objetivo if filas[s]["estado_actual"] == "sin_resolver"]

print(f"Total pendientes: {len(pendientes)}\n")

out = []
for s in pendientes:
    p = productos[s]
    out.append({
        "sku": s,
        "nombre": p.get("nombre", ""),
        "descripcion": p.get("descripcion", ""),
        "categoria": p.get("categoria", ""),
        "precio": p.get("precio", ""),
    })
    print(f"{s} | nombre='{p.get('nombre','')}' | desc='{p.get('descripcion','')}' | cat='{p.get('categoria','')}'")

json.dump(out, open("reportes/pendientes_119_detalle.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
