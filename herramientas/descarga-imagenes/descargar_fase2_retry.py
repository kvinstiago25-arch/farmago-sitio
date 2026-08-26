"""
descargar_fase2_retry.py
--------------------------
Segundo intento para los SKUs que quedaron "sin_resolver" tras la Fase 2 +
QA2. Estrategia distinta a la primera pasada:
  1. Limpia el nombre del producto quitando ruido de dosis/empaque
     (numeros+mg/ml/g, "BLISTER", "TABLETAS", "CAPS", "SOBRE", "X<n>", etc.)
     antes de armar la consulta combinada a los 7 dominios permitidos.
  2. Si esa consulta no produce nada valido, prueba cada uno de los 7
     dominios por separado con el nombre completo original (a veces el
     OR combinado opaca resultados que si aparecen en una busqueda de un
     solo sitio).
No descarga nada de forma definitiva sin que despues se verifique
visualmente (ese paso lo hace un pase de QA aparte, igual que la vez
anterior) - este script solo descarga CANDIDATOS a
imagenesmedimentos/reales/, y escribe un listado de que sku consiguio
candidato para poder armar el lote de QA visual.
"""

import argparse
import csv
import hashlib
import json
import re
import time
from pathlib import Path

import truststore
truststore.inject_into_ssl()

import requests

from descargar_imagenes_serper import (
    ALLOWED_DOMAINS,
    buscar_serper,
    descargar_y_validar,
    host_allowed,
)

RAIZ = Path(__file__).parent
CSV_PATH = RAIZ / "auditoria_imagenes.csv"
PRODUCTOS_JSON = RAIZ / "productos.json"
OUT_DIR = RAIZ / "imagenesmedimentos" / "reales"

DOMINIOS = [
    "larebajavirtual.com", "cruzverde.com.co", "farmatodo.com.co",
    "drogueriascafam.com.co", "locatelcolombia.com", "farmalisto.com.co",
    "farmaciaspasteur.com.co",
]

RUIDO = re.compile(
    r"\b(\d+\s*(mg|ml|gr|g|mcg)|blister|tabletas|tabs?|caps?|capsulas|jarabe|"
    r"suspension|sobre|frasco|caja|comprimidos?|grageas|x\s*\d+|\d+\s*x)\b",
    re.IGNORECASE,
)


def limpiar_nombre(nombre):
    limpio = RUIDO.sub(" ", nombre)
    limpio = re.sub(r"\s+", " ", limpio).strip()
    return limpio if len(limpio) >= 4 else nombre


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--api-key", required=True)
    ap.add_argument("--delay", type=float, default=0.4)
    ap.add_argument("--debug", action="store_true")
    args = ap.parse_args()

    productos = json.loads(PRODUCTOS_JSON.read_text(encoding="utf-8-sig"))
    productos_por_id = {p["id"]: p for p in productos}

    filas = list(csv.DictReader(open(CSV_PATH, encoding="utf-8-sig")))
    objetivo = [f for f in filas if f["estado_actual"] == "sin_resolver"]
    print(f"Objetivo reintento: {len(objetivo)} productos")

    session = requests.Session()
    used_hashes = set()
    for f in OUT_DIR.glob("*"):
        if f.is_file():
            try:
                used_hashes.add(hashlib.sha256(f.read_bytes()).hexdigest())
            except Exception:
                pass

    candidatos_ids = []
    procesados = 0

    for fila in objetivo:
        sku = fila["sku"]
        prod = productos_por_id.get(sku)
        if prod is None:
            continue
        procesados += 1
        nombre_original = str(prod.get("nombre", "")).strip()
        nombre_limpio = limpiar_nombre(nombre_original)

        intentos = []
        dominios_or = " OR ".join(f"site:{d}" for d in DOMINIOS)
        intentos.append(f"{nombre_limpio} ({dominios_or})")

        encontrado = False
        for query in intentos:
            if args.debug:
                print(f"[{procesados}/{len(objetivo)}] {sku}: {query}")
            items = buscar_serper(args.api_key, query, session, debug=args.debug)
            time.sleep(args.delay)
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
                file_path = OUT_DIR / f"{sku}{ext}"
                file_path.write_bytes(data)
                candidatos_ids.append({"sku": sku, "fuente": source_page, "archivo": file_path.name})
                encontrado = True
                break
            if encontrado:
                break

        # Si la consulta combinada no dio nada, probar dominio por dominio
        if not encontrado:
            for dominio in DOMINIOS:
                query = f"{nombre_original} site:{dominio}"
                if args.debug:
                    print(f"    fallback dominio: {query}")
                items = buscar_serper(args.api_key, query, session, debug=args.debug)
                time.sleep(args.delay)
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
                    file_path = OUT_DIR / f"{sku}{ext}"
                    file_path.write_bytes(data)
                    candidatos_ids.append({"sku": sku, "fuente": source_page, "archivo": file_path.name})
                    encontrado = True
                    break
                if encontrado:
                    break

        if procesados % 15 == 0:
            print(f"progreso: procesados={procesados}, candidatos={len(candidatos_ids)}")

    Path("reportes/retry_candidatos.json").write_text(json.dumps(candidatos_ids, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nprocesados={procesados}")
    print(f"candidatos encontrados (a verificar visualmente): {len(candidatos_ids)}")


if __name__ == "__main__":
    main()
