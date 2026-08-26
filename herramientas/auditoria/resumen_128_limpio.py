import csv
import re

objetivo = [l.strip() for l in open("reportes/orden_prioridad_retry3.txt", encoding="utf-8") if l.strip()]
filas = {f["sku"]: f for f in csv.DictReader(open("auditoria_imagenes.csv", encoding="utf-8-sig"))}
resueltos = [s for s in objetivo if filas[s]["estado_actual"] == "corregida"]
pendientes = [s for s in objetivo if filas[s]["estado_actual"] == "sin_resolver"]

print(f"Objetivo: {len(objetivo)} | Resueltos: {len(resueltos)} | Sin resolver: {len(pendientes)}\n")


def razon_limpia(notas):
    partes = [p.strip() for p in notas.split(";")]
    especificas = []
    for p in partes:
        m = re.search(r"QA visual:\s*(.+)", p)
        if m and "candidato pre-nuevos-dominios" not in p:
            especificas.append(m.group(1))
            continue
        m = re.search(r"sigue sin coincidir \((.+)\)", p)
        if m:
            especificas.append(m.group(1))
            continue
        m = re.search(r"sospechosa\|(.+)", p)
        if m:
            especificas.append(m.group(1))
    if especificas:
        return especificas[-1]
    if "sin coincidencia confiable en fuentes permitidas" in notas:
        return "no se encontro ningun candidato en las fuentes permitidas"
    return "sin coincidencia confiable"


for s in pendientes:
    f = filas[s]
    print(f"{s} | {f['nombre']} | {razon_limpia(f['notas'])}")
