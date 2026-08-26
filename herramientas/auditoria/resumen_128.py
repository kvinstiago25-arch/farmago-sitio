import csv

objetivo = [l.strip() for l in open("reportes/orden_prioridad_retry3.txt", encoding="utf-8") if l.strip()]
print("Objetivo de esta tarea (los 128 pendientes al empezar):", len(objetivo))

filas = {f["sku"]: f for f in csv.DictReader(open("auditoria_imagenes.csv", encoding="utf-8-sig"))}
resueltos = [s for s in objetivo if filas[s]["estado_actual"] == "corregida"]
pendientes = [s for s in objetivo if filas[s]["estado_actual"] == "sin_resolver"]

print("Resueltos con foto real:", len(resueltos))
print("Siguen sin resolver:", len(pendientes))
print()

for s in pendientes:
    f = filas[s]
    print(f"{s} | {f['nombre']} | {f['notas']}")
