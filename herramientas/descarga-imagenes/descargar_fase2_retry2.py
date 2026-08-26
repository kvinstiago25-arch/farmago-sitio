"""
descargar_fase2_retry2.py
---------------------------
Segundo reintento (con las 4 fuentes nuevas: drogueriascolsubsidio.com,
olimpica.com, drogueriasanjorge.com, exito.com) para los SKUs que siguen
"sin_resolver". A diferencia de descargar_fase2_retry.py (que probaba hasta
8 consultas por producto y se comio muchos creditos), este usa SOLO 1
consulta combinada por producto (los 11 dominios permitidos en un solo OR),
para estirar el presupuesto de Serper.

Procesa los SKUs en el orden en que vienen en --orden-file (un .txt con un
sku por linea, ya priorizado por quien llama al script), y se detiene solo
si se agota la lista o si --max-calls se alcanza (seguro de presupuesto).

Solo descarga CANDIDATOS a imagenesmedimentos/reales/ y anota en
reportes/retry2_candidatos.json - NO toca productos.json ni el CSV. Eso se
hace despues de una verificacion visual, igual que las veces anteriores.
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
    buscar_serper,
    descargar_y_validar,
    host_allowed,
)

RAIZ = Path(__file__).parent
PRODUCTOS_JSON = RAIZ / "productos.json"
OUT_DIR = RAIZ / "imagenesmedimentos" / "reales"

DOMINIOS = [
    "larebajavirtual.com", "cruzverde.com.co", "farmatodo.com.co",
    "drogueriascafam.com.co", "locatelcolombia.com", "farmalisto.com.co",
    "farmaciaspasteur.com.co", "drogueriascolsubsidio.com", "olimpica.com",
    "drogueriasanjorge.com", "exito.com", "tudrogueriavirtual.com",
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
    ap.add_argument("--orden-file", required=True)
    ap.add_argument("--delay", type=float, default=0.4)
    ap.add_argument("--max-calls", type=int, default=450)
    ap.add_argument("--debug", action="store_true")
    args = ap.parse_args()

    productos = json.loads(PRODUCTOS_JSON.read_text(encoding="utf-8-sig"))
    productos_por_id = {p["id"]: p for p in productos}

    orden = [l.strip() for l in Path(args.orden_file).read_text(encoding="utf-8").splitlines() if l.strip()]
    print(f"Objetivo reintento 2: {len(orden)} productos (tope de llamadas: {args.max_calls})")

    session = requests.Session()
    used_hashes = set()
    for f in OUT_DIR.glob("*"):
        if f.is_file():
            try:
                used_hashes.add(hashlib.sha256(f.read_bytes()).hexdigest())
            except Exception:
                pass

    dominios_or = " OR ".join(f"site:{d}" for d in DOMINIOS)
    candidatos = []
    llamadas = 0
    procesados = 0

    for sku in orden:
        if llamadas >= args.max_calls:
            print(f"[!] Tope de {args.max_calls} llamadas alcanzado, me detengo aqui.")
            break
        prod = productos_por_id.get(sku)
        if prod is None:
            continue
        procesados += 1
        nombre_original = str(prod.get("nombre", "")).strip()
        nombre_limpio = limpiar_nombre(nombre_original)
        query = f"{nombre_limpio} ({dominios_or})"

        if args.debug:
            print(f"[{procesados}/{len(orden)}] {sku}: {query}")

        items = buscar_serper(args.api_key, query, session, debug=args.debug)
        llamadas += 1
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
            candidatos.append({"sku": sku, "fuente": source_page, "archivo": file_path.name})
            break

        if procesados % 20 == 0:
            print(f"progreso: procesados={procesados}, llamadas={llamadas}, candidatos={len(candidatos)}")

    Path("reportes/retry2_candidatos.json").write_text(json.dumps(candidatos, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nprocesados={procesados}")
    print(f"llamadas usadas={llamadas}")
    print(f"candidatos encontrados (a verificar visualmente): {len(candidatos)}")


if __name__ == "__main__":
    main()
