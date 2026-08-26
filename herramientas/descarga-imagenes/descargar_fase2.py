"""
descargar_fase2.py
-------------------
Fase 2 de la auditoria de imagenes: busca reemplazo para los productos
marcados como "faltante" o "sospechosa" en auditoria_imagenes.csv, usando
EXACTAMENTE la misma logica de busqueda/validacion que
descargar_imagenes_serper.py (mismos 7 dominios permitidos, misma validacion
de tamano/fondo/semantica), pero:
  - ignora el flag "solo si falta imagen real" y fuerza el reintento en la
    lista de SKUs objetivo (incluye las 'sospechosa', que ya tienen una foto
    real pero incorrecta),
  - si encuentra reemplazo bueno, borra el/los archivo(s) viejo(s) de ese SKU
    en reales/ (cualquier extension) antes de guardar el nuevo,
  - si NO encuentra reemplazo confiable, mueve el archivo viejo (si existia)
    a reales/_revisar_manual/ en vez de borrarlo, y asigna el icono generico
    de la categoria,
  - nunca toca imagenesmedimentos/reales_backup/.

USO:
    python descargar_fase2.py --api-key "KEY"
"""

import argparse
import csv
import hashlib
import json
import shutil
import time
from datetime import datetime
from pathlib import Path

import truststore
truststore.inject_into_ssl()

import requests

from descargar_imagenes_serper import (
    buscar_serper,
    descargar_y_validar,
    generic_for,
    host_allowed,
)

RAIZ = Path(__file__).parent
CSV_PATH = RAIZ / "auditoria_imagenes.csv"
PRODUCTOS_JSON = RAIZ / "productos.json"
OUT_DIR = RAIZ / "imagenesmedimentos" / "reales"
REVISAR_DIR = OUT_DIR / "_revisar_manual"
REPORT_DIR = RAIZ / "reportes"


def cargar_objetivo():
    filas = list(csv.DictReader(open(CSV_PATH, encoding="utf-8-sig")))
    objetivo = [f for f in filas if f["estado_actual"] in ("faltante", "sospechosa")]
    return filas, objetivo


def borrar_archivos_viejos(sku, mover_a_revisar=False):
    movidos = []
    for f in OUT_DIR.glob(f"{sku}.*"):
        if f.is_file():
            if mover_a_revisar:
                REVISAR_DIR.mkdir(parents=True, exist_ok=True)
                destino = REVISAR_DIR / f.name
                shutil.move(str(f), str(destino))
                movidos.append(str(destino))
            else:
                f.unlink()
    return movidos


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--api-key", required=True)
    ap.add_argument("--delay", type=float, default=0.4)
    ap.add_argument("--checkpoint-every", type=int, default=10)
    ap.add_argument("--debug", action="store_true")
    args = ap.parse_args()

    productos = json.loads(PRODUCTOS_JSON.read_text(encoding="utf-8-sig"))
    productos_por_id = {p["id"]: p for p in productos}

    filas_csv, objetivo = cargar_objetivo()
    print(f"Objetivo Fase 2: {len(objetivo)} productos (faltante + sospechosa)")

    session = requests.Session()
    used_hashes = set()
    for f in OUT_DIR.glob("*"):
        if f.is_file():
            try:
                used_hashes.add(hashlib.sha256(f.read_bytes()).hexdigest())
            except Exception:
                pass

    corregidos_ids, sin_resolver_ids = [], []
    procesados = 0

    for fila in objetivo:
        sku = fila["sku"]
        prod = productos_por_id.get(sku)
        if prod is None:
            print(f"  [!] {sku} no existe en productos.json, se omite")
            continue

        procesados += 1
        nombre = str(prod.get("nombre", "")).strip()
        query = (
            f"{nombre} (site:larebajavirtual.com OR site:cruzverde.com.co OR "
            f"site:farmatodo.com.co OR site:drogueriascafam.com.co OR "
            f"site:locatelcolombia.com OR site:farmalisto.com.co OR "
            f"site:farmaciaspasteur.com.co OR site:drogueriascolsubsidio.com OR "
            f"site:olimpica.com OR site:drogueriasanjorge.com OR site:exito.com)"
        )
        if args.debug:
            print(f"[{procesados}/{len(objetivo)}] {sku}: {query}")

        items = buscar_serper(args.api_key, query, session, debug=args.debug)
        time.sleep(args.delay)

        exito = False
        for item in items:
            link = item.get("imageUrl") or item.get("link") or ""
            source_page = item.get("link") or item.get("source") or ""
            if not link or not host_allowed(source_page or link):
                continue
            texto = f"{item.get('title', '')} {source_page}"
            data, ext = descargar_y_validar(session, link, prod, texto)
            if data is None:
                continue
            sha = hashlib.sha256(data).hexdigest()
            if sha in used_hashes:
                continue
            used_hashes.add(sha)

            borrar_archivos_viejos(sku, mover_a_revisar=False)
            file_path = OUT_DIR / f"{sku}{ext}"
            file_path.write_bytes(data)
            prod["imagen"] = f"imagenesmedimentos/reales/{file_path.name}"
            corregidos_ids.append(sku)
            fila["_nueva_ruta"] = prod["imagen"]
            fila["_fuente"] = source_page
            exito = True
            if args.checkpoint_every and len(corregidos_ids) % args.checkpoint_every == 0:
                PRODUCTOS_JSON.write_text(json.dumps(productos, ensure_ascii=False, indent=2), encoding="utf-8")
                print(f"  [checkpoint: {len(corregidos_ids)} corregidas hasta ahora]")
            break

        if not exito:
            movidos = borrar_archivos_viejos(sku, mover_a_revisar=True)
            prod["imagen"] = generic_for(str(prod.get("categoria", "")))
            sin_resolver_ids.append(sku)
            fila["_movido_a"] = "; ".join(movidos)

        if procesados % 10 == 0:
            print(f"progreso: procesados={procesados}, corregidos={len(corregidos_ids)}, sin_resolver={len(sin_resolver_ids)}")

    PRODUCTOS_JSON.write_text(json.dumps(productos, ensure_ascii=False, indent=2), encoding="utf-8")

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    reporte = REPORT_DIR / f"reporte_serper_{ts}.json"
    reporte.write_text(json.dumps({
        "fase": "fase2_faltantes_y_sospechosas",
        "procesados": procesados,
        "actualizados_reales": len(corregidos_ids),
        "fallidos": len(sin_resolver_ids),
        "actualizados_ids": corregidos_ids,
        "fallidos_ids": sin_resolver_ids,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    # Actualizar el CSV de auditoria
    for fila in filas_csv:
        sku = fila["sku"]
        if sku in corregidos_ids:
            obj_fila = next(f for f in objetivo if f["sku"] == sku)
            fila["estado_actual"] = "corregida"
            fila["ruta_imagen_actual"] = obj_fila.get("_nueva_ruta", fila["ruta_imagen_actual"])
            fila["ubicacion"] = "reales"
            fuente = obj_fila.get("_fuente", "")
            nota = f"Fase 2: reemplazada desde fuente permitida ({fuente})" if fuente else "Fase 2: reemplazada"
            fila["notas"] = f"{fila['notas']}; {nota}" if fila["notas"] else nota
        elif sku in sin_resolver_ids:
            obj_fila = next(f for f in objetivo if f["sku"] == sku)
            fila["estado_actual"] = "sin_resolver"
            fila["ruta_imagen_actual"] = productos_por_id[sku]["imagen"]
            fila["ubicacion"] = "genericas"
            movido = obj_fila.get("_movido_a", "")
            nota = f"Fase 2: sin coincidencia confiable en fuentes permitidas; archivo viejo movido a {movido}" if movido else "Fase 2: sin coincidencia confiable en fuentes permitidas"
            fila["notas"] = f"{fila['notas']}; {nota}" if fila["notas"] else nota

    with open(CSV_PATH, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["sku", "nombre", "estado_actual", "ruta_imagen_actual", "ubicacion", "notas"],
            extrasaction="ignore",
        )
        writer.writeheader()
        for fila in filas_csv:
            writer.writerow(fila)

    print(f"\nprocesados={procesados}")
    print(f"corregidos={len(corregidos_ids)}")
    print(f"sin_resolver={len(sin_resolver_ids)}")
    print(f"reporte={reporte}")
    print(f"CSV actualizado: {CSV_PATH}")
    print("SIN_RESOLVER_IDS=" + ",".join(sin_resolver_ids))


if __name__ == "__main__":
    main()
