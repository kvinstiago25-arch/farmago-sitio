"""
auditoria_script.py
--------------------
Auditoria estructural (Fase 1) del catalogo de imagenes de FarmaGo.
No descarga ni mueve nada. Solo lee productos.json, el filesystem de
imagenesmedimentos/ y los reportes/ existentes, y genera
auditoria_imagenes.csv + un resumen impreso.
"""

import csv
import json
import re
from collections import defaultdict
from pathlib import Path

RAIZ = Path(__file__).parent
PRODUCTOS_JSON = RAIZ / "productos.json"
IMG_DIR = RAIZ / "imagenesmedimentos"
REALES_DIR = IMG_DIR / "reales"
GENERICAS_DIR = IMG_DIR / "genericas"
REPORTES_DIR = RAIZ / "reportes"
CSV_OUT = RAIZ / "auditoria_imagenes.csv"

# --- 1. IDs auto-descargados por Serper (fuentes permitidas), segun reportes ---
auto_serper_ids = set()
serper_reports = sorted(REPORTES_DIR.glob("reporte_serper_*.json"))
for f in serper_reports:
    try:
        data = json.loads(f.read_text(encoding="utf-8"))
        auto_serper_ids.update(data.get("actualizados_ids", []))
    except Exception as e:
        print(f"  [!] no pude leer {f.name}: {e}")

print(f"IDs auto-descargados via Serper (fuentes permitidas), segun reportes: {len(auto_serper_ids)}")
print(sorted(auto_serper_ids))

# --- 2. Inventario de archivos en disco ---
reales_files = {f.name: f for f in REALES_DIR.iterdir() if f.is_file()} if REALES_DIR.exists() else {}
reales_stems = {f.stem: f.name for f in REALES_DIR.iterdir() if f.is_file()} if REALES_DIR.exists() else {}
sueltos_files = {f.name: f for f in IMG_DIR.iterdir() if f.is_file()} if IMG_DIR.exists() else {}
genericas_files = {f.name: f for f in GENERICAS_DIR.iterdir() if f.is_file()} if GENERICAS_DIR.exists() else {}

print(f"\nArchivos en reales/: {len(reales_files)}")
print(f"Archivos sueltos en imagenesmedimentos/: {len(sueltos_files)}")
print(f"Archivos en genericas/: {len(genericas_files)}")

# --- 3. Cargar productos.json ---
productos = json.loads(PRODUCTOS_JSON.read_text(encoding="utf-8"))
print(f"\nProductos en productos.json: {len(productos)}")

# Chequeo de IDs duplicados en el propio catalogo
id_counts = defaultdict(int)
for p in productos:
    id_counts[p.get("id")] += 1
dup_catalog_ids = {k: v for k, v in id_counts.items() if v > 1}
if dup_catalog_ids:
    print(f"[!] IDs de producto repetidos dentro de productos.json: {dup_catalog_ids}")

# --- 4. Recorrer productos y clasificar ---
filas = []
imagen_a_skus = defaultdict(list)  # ruta_imagen (normalizada) -> [sku, ...]

for p in productos:
    sku = p.get("id", "")
    nombre = p.get("nombre", "")
    categoria = p.get("categoria", "")
    imagen = (p.get("imagen") or "").strip()

    estado = ""
    ubicacion = ""
    notas = []

    if not imagen:
        estado = "faltante"
        ubicacion = "sin_ruta"
        notas.append("El producto no tiene campo 'imagen' en productos.json")
    elif "/genericas/" in imagen.replace("\\", "/"):
        estado = "faltante"
        ubicacion = "genericas"
        fname = imagen.replace("\\", "/").split("/")[-1]
        if fname not in genericas_files:
            notas.append(f"Icono generico referenciado no existe en disco: {fname}")
    elif re.search(r"/reales/", imagen.replace("\\", "/")):
        fname = imagen.replace("\\", "/").split("/")[-1]
        ubicacion = "reales"
        if fname in reales_files:
            estado = "ok"  # pendiente de validacion visual
            if sku not in auto_serper_ids:
                notas.append("Posible imagen MANUAL (no aparece en reportes de Serper) - no tocar sin confirmar")
        else:
            estado = "faltante"
            notas.append(f"Ruta rota: {imagen} no existe en disco (enlace roto)")
    else:
        # ruta "suelta" tipo imagenesmedimentos/dolex.jpg (convencion legacy por nombre)
        fname = imagen.replace("\\", "/").split("/")[-1]
        ubicacion = "suelto"
        if fname in sueltos_files:
            estado = "ok"  # pendiente de validacion visual
            notas.append("Archivo legacy suelto (convencion por nombre, no por SKU) - validar antes de dar por bueno")
        else:
            estado = "faltante"
            notas.append(f"Ruta rota: {imagen} no existe en disco (enlace roto)")

    ruta_norm = imagen.replace("\\", "/")
    if ubicacion != "genericas" and ruta_norm:
        imagen_a_skus[ruta_norm].append(sku)

    filas.append({
        "sku": sku,
        "nombre": nombre,
        "estado_actual": estado,
        "ruta_imagen_actual": imagen,
        "ubicacion": ubicacion,
        "notas": "; ".join(notas),
    })

# --- 5. Detectar duplicados (misma imagen especifica para SKUs distintos) ---
duplicados_map = {ruta: skus for ruta, skus in imagen_a_skus.items() if len(skus) > 1}
print(f"\nRutas de imagen especificas (reales/suelto) compartidas por 2+ SKUs: {len(duplicados_map)}")
sku_a_fila = {f["sku"]: f for f in filas}
for ruta, skus in duplicados_map.items():
    nombres = [sku_a_fila[s]["nombre"] for s in skus]
    for s in skus:
        nota_dup = f"DUPLICADA: misma imagen que {', '.join(x for x in skus if x != s)} ({ruta})"
        if sku_a_fila[s]["notas"]:
            sku_a_fila[s]["notas"] += "; " + nota_dup
        else:
            sku_a_fila[s]["notas"] = nota_dup
        if sku_a_fila[s]["estado_actual"] == "ok":
            sku_a_fila[s]["estado_actual"] = "sospechosa"

# --- 6. Archivos sueltos en imagenesmedimentos/ que NO estan referenciados por ningun producto ---
referenciados_sueltos = {f["ruta_imagen_actual"].replace("\\", "/").split("/")[-1]
                         for f in filas if f["ubicacion"] == "suelto"}
huerfanos_sueltos = sorted(set(sueltos_files.keys()) - referenciados_sueltos)
print(f"\nArchivos sueltos en imagenesmedimentos/ (raiz) SIN ningun producto que los referencie: {len(huerfanos_sueltos)}")
print(huerfanos_sueltos)

# Archivos en reales/ que no estan referenciados por ningun producto.json (huerfanos)
referenciados_reales = {f["ruta_imagen_actual"].replace("\\", "/").split("/")[-1]
                         for f in filas if f["ubicacion"] == "reales"}
huerfanos_reales = sorted(set(reales_files.keys()) - referenciados_reales)
print(f"\nArchivos en reales/ SIN ningun producto que los referencie: {len(huerfanos_reales)}")
print(huerfanos_reales)

# --- 6b. SKUs con mas de un archivo candidato en reales/ (mismo stem, distinta extension) ---
stems_count = defaultdict(list)
for fname in reales_files:
    stems_count[Path(fname).stem].append(fname)
stems_duplicados = {stem: names for stem, names in stems_count.items() if len(names) > 1}
print(f"\nSKUs con mas de un archivo en reales/ (mismo stem, distinta extension): {len(stems_duplicados)}")
for stem, names in stems_duplicados.items():
    if stem in sku_a_fila:
        usados = sku_a_fila[stem]["ruta_imagen_actual"].replace("\\", "/").split("/")[-1]
        huerfanos = [n for n in names if n != usados]
        nota_h = f"Archivo(s) huerfano(s) en reales/ con mismo SKU y distinta extension, no referenciado(s): {', '.join(huerfanos)}"
        if sku_a_fila[stem]["notas"]:
            sku_a_fila[stem]["notas"] += "; " + nota_h
        else:
            sku_a_fila[stem]["notas"] = nota_h

# --- 7. Cruce con overrides hardcodeados en script.js (IMAGENES_COMERCIALES_VERIFICADAS) ---
script_js = (RAIZ / "script.js").read_text(encoding="utf-8")
overrides = dict(re.findall(r"'(prod-\d+)':\s*'([^']+)'", script_js.split("IMAGENES_COMERCIALES_VERIFICADAS")[1].split("};")[0])) if "IMAGENES_COMERCIALES_VERIFICADAS" in script_js else {}
print(f"\nOverrides hardcodeados en script.js (IMAGENES_COMERCIALES_VERIFICADAS): {len(overrides)}")
for sku, ruta in overrides.items():
    if sku in sku_a_fila:
        nota_ov = f"OJO: script.js fuerza la imagen '{ruta}' para este SKU sin importar productos.json"
        if sku_a_fila[sku]["notas"]:
            sku_a_fila[sku]["notas"] += "; " + nota_ov
        else:
            sku_a_fila[sku]["notas"] = nota_ov

# --- 8. Escribir CSV ---
with open(CSV_OUT, "w", newline="", encoding="utf-8-sig") as f:
    writer = csv.DictWriter(f, fieldnames=["sku", "nombre", "estado_actual", "ruta_imagen_actual", "ubicacion", "notas"])
    writer.writeheader()
    for fila in filas:
        writer.writerow(fila)

# --- 9. Resumen ---
resumen = defaultdict(int)
for f in filas:
    resumen[f["estado_actual"]] += 1
resumen_ubic = defaultdict(int)
for f in filas:
    resumen_ubic[f["ubicacion"]] += 1

print("\n=== RESUMEN estado_actual ===")
for k, v in sorted(resumen.items()):
    print(f"  {k}: {v}")
print("\n=== RESUMEN ubicacion ===")
for k, v in sorted(resumen_ubic.items()):
    print(f"  {k}: {v}")
print(f"\nTotal filas CSV: {len(filas)}")
print(f"CSV escrito en: {CSV_OUT}")
