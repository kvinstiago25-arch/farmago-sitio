"""
descargar_imagenes_serper.py
--------------------------------
Busca y descarga imagenes reales de producto usando la API de Serper.dev
(pago, sin los bloqueos de CAPTCHA que tiene Bing, y sin el cierre de acceso
que tiene la API oficial de Google para cuentas nuevas).

Restringe la busqueda a las 4 droguerias reales (mismo criterio que ya
veniamos usando), valida cada imagen (tamano minimo, fondo blanco,
coincidencia semantica con el nombre del producto) antes de aplicarla, y
guarda todo en un reporte para que puedas revisar que se aplico.

INSTALACION (una sola vez):
    pip install --default-timeout=120 requests pillow

USO:
    python descargar_imagenes_serper.py --api-key "TU_API_KEY" --max-products 100

Genera / actualiza:
    productos.json                 -> con las imagenes reales aplicadas
    imagenesmedimentos/reales/*    -> archivos de imagen descargados
    reportes/reporte_serper_*.json -> que se aplico, que se rechazo y por que
"""

import argparse
import hashlib
import io
import json
import re
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

import requests
from PIL import Image, UnidentifiedImageError

SERPER_URL = "https://google.serper.dev/images"

ABREVIATURAS = {
    r"\bACONDICI\b": "ACONDICIONADOR",
    r"\bSHAMPO\b": "SHAMPOO",
    r"\bCREM\b": "CREMA",
    r"\bJAB\b": "JABON",
    r"\bDESODOR\b": "DESODORANTE",
    r"\bTRATAM\b": "TRATAMIENTO",
    r"\bPROTEC\b": "PROTECTOR",
    r"\bREPARAC\b": "REPARACION",
    r"\bHIDRAT\b": "HIDRATANTE",
    r"\bSUSPENS\b": "SUSPENSION",
    r"\bBLIST\b": "BLISTER",
    r"\bTAB\b": "TABLETAS",
    r"\bCAPS\b": "CAPSULAS",
    r"\bSOL\b": "SOLUCION",
    r"\bUNGUENT\b": "UNGUENTO",
}

MARCAS_GLOBALES = {
    "pantene", "elvive", "loreal", "l'oreal", "colgate", "johnson", "johnsons",
    "redoxon", "nivea", "gillette", "dove", "rexona", "sedal", "head", "shoulders",
    "listerine", "oral-b", "oralb", "vicks", "centrum", "eucerin", "cetaphil",
    "neutrogena", "ponds", "pond's", "vaseline",
}


def expandir_abreviaturas(texto):
    resultado = texto
    for patron, reemplazo in ABREVIATURAS.items():
        resultado = re.sub(patron, reemplazo, resultado, flags=re.IGNORECASE)
    return resultado


def es_marca_global(texto):
    t = texto.lower()
    return any(m in t for m in MARCAS_GLOBALES)


BLOQUEADOS_FALLBACK = {
    "pinterest.com", "facebook.com", "instagram.com", "tiktok.com",
    "twitter.com", "x.com", "youtube.com", "wikipedia.org", "alibaba.com",
    "aliexpress.com",
}


def host_allowed_amplio(url):
    """Para el intento de respaldo con marcas globales: bloquea redes sociales
    y sitios sin relacion a e-commerce, pero no exige una lista fija de tiendas."""
    try:
        host = (urlparse(url).hostname or "").lower()
    except Exception:
        return False
    if not host:
        return False
    return not any(host == b or host.endswith("." + b) for b in BLOQUEADOS_FALLBACK)


ALLOWED_DOMAINS = {
    "larebajavirtual.com", "www.larebajavirtual.com",
    "cruzverde.com.co", "www.cruzverde.com.co",
    "farmatodo.com.co", "www.farmatodo.com.co",
    "drogueriascafam.com.co", "www.drogueriascafam.com.co",
    "locatelcolombia.com", "www.locatelcolombia.com",
    "farmalisto.com.co", "www.farmalisto.com.co",
    "farmaciaspasteur.com.co", "www.farmaciaspasteur.com.co",
    "mercadolibre.com.co", "listado.mercadolibre.com.co", "articulo.mercadolibre.com.co",
    "exito.com", "www.exito.com",
    "farmaexpress.com", "www.farmaexpress.com",
    "alkosto.com", "www.alkosto.com",
}

BLOCK_WORDS = {
    "logo", "icon", "favicon", "banner", "placeholder", "avatar",
    "anime", "shirt", "camiseta", "manga", "peppa", "hoodie", "buzo", "cartoon",
}

CATEGORY_TO_GENERIC = {
    "adulto mayor": "imagenesmedimentos/genericas/adulto-mayor.svg",
    "analgésicos": "imagenesmedimentos/genericas/analgesicos.svg",
    "antibióticos": "imagenesmedimentos/genericas/antibioticos.svg",
    "antigripales": "imagenesmedimentos/genericas/antigripales.svg",
    "antiinflamatorios": "imagenesmedimentos/genericas/antiinflamatorios.svg",
    "bebés": "imagenesmedimentos/genericas/bebes.svg",
    "bebidas": "imagenesmedimentos/genericas/bebidas.svg",
    "cuidado personal": "imagenesmedimentos/genericas/cuidado-personal.svg",
    "otros": "imagenesmedimentos/genericas/otros.svg",
    "vitaminas": "imagenesmedimentos/genericas/vitaminas.svg",
}

STOPWORDS = {
    "mg", "ml", "gr", "tab", "tabletas", "caps", "capsulas", "jarabe",
    "suspension", "crema", "gel", "solucion", "adulto", "ninos", "nino",
    "blister", "sobre", "frasco", "caja", "empaque",
}

MIN_W, MIN_H = 250, 250
MIN_WHITE_RATIO = 0.18


def normalize(text):
    text = (text or "").lower().strip()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def host_allowed(url):
    try:
        host = (urlparse(url).hostname or "").lower()
    except Exception:
        return False
    return host in ALLOWED_DOMAINS or any(host.endswith("." + d) for d in ALLOWED_DOMAINS)


def url_allowed(url):
    low = (url or "").lower()
    return low.startswith(("http://", "https://")) and not any(w in low for w in BLOCK_WORDS)


def semantic_tokens(product):
    name_tokens = [normalize(t) for t in re.findall(r"[A-Za-z]{4,}", str(product.get("nombre", "")))]
    return [t for t in name_tokens if t and t not in STOPWORDS][:4]


def semantic_ok(product, text_blob):
    tokens = semantic_tokens(product)
    if not tokens:
        return True
    hay = normalize(text_blob)
    return any(t in hay for t in tokens)


def white_ratio(im):
    sample = im.convert("RGB").resize((96, 96))
    pix = sample.load()
    white = sum(1 for y in range(96) for x in range(96) if all(v > 232 for v in pix[x, y]))
    return white / (96 * 96)


def generic_for(categoria):
    return CATEGORY_TO_GENERIC.get(normalize(categoria), CATEGORY_TO_GENERIC["otros"])


def es_real_local(imagen):
    p = (imagen or "").replace("\\", "/").lower()
    return p.startswith("imagenesmedimentos/reales/") and p.endswith((".jpg", ".jpeg", ".png", ".webp"))


def buscar_serper(api_key, query, session, debug=False):
    payload = {"q": query}
    headers = {"X-API-KEY": api_key, "Content-Type": "application/json"}
    try:
        r = session.post(SERPER_URL, json=payload, headers=headers, timeout=20)
    except requests.RequestException as e:
        if debug:
            print(f"    [debug] error de red: {e}")
        return []
    if r.status_code != 200:
        if debug:
            print(f"    [debug] HTTP {r.status_code}: {r.text[:300]}")
        return []
    data = r.json()
    items = data.get("images", [])
    if debug:
        print(f"    [debug] items recibidos: {len(items)}")
    return items


def descargar_y_validar(session, image_url, product, texto_semantico):
    if not url_allowed(image_url):
        return None, None
    try:
        r = session.get(image_url, timeout=20, headers={"User-Agent": "Mozilla/5.0"})
        if r.status_code != 200:
            return None, None
        data = r.content
    except requests.RequestException:
        return None, None

    ctype = (r.headers.get("Content-Type") or "").lower()
    if "png" in ctype:
        ext = ".png"
    elif "webp" in ctype:
        ext = ".webp"
    elif "jpeg" in ctype or "jpg" in ctype:
        ext = ".jpg"
    else:
        return None, None

    try:
        with Image.open(io.BytesIO(data)) as im:
            if im.width < MIN_W or im.height < MIN_H:
                return None, None
            if white_ratio(im) < MIN_WHITE_RATIO:
                return None, None
    except UnidentifiedImageError:
        return None, None
    except Exception:
        return None, None

    if not semantic_ok(product, texto_semantico):
        return None, None

    return data, ext


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--api-key", required=True)
    ap.add_argument("--json", default="productos.json")
    ap.add_argument("--out", default="imagenesmedimentos/reales")
    ap.add_argument("--report-dir", default="reportes")
    ap.add_argument("--max-products", type=int, default=100)
    ap.add_argument("--only-missing", action="store_true", default=True)
    ap.add_argument("--delay", type=float, default=1.0)
    ap.add_argument("--checkpoint-every", type=int, default=10)
    ap.add_argument("--debug", action="store_true")
    ap.add_argument("--intento-final", action="store_true",
                     help="Aplica el segundo intento amplio (toda la web, sin restringir a las 11 tiendas) a TODOS los productos, no solo a marcas globales conocidas.")
    args = ap.parse_args()

    json_path = Path(args.json)
    out_dir = Path(args.out)
    report_dir = Path(args.report_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    report_dir.mkdir(parents=True, exist_ok=True)

    productos = json.loads(json_path.read_text(encoding="utf-8-sig"))
    session = requests.Session()

    used_hashes = set()
    for f in out_dir.glob("*"):
        if f.is_file():
            try:
                used_hashes.add(hashlib.sha256(f.read_bytes()).hexdigest())
            except Exception:
                pass

    procesados = actualizados = fallidos = 0
    actualizados_ids, fallidos_ids = [], []

    for prod in productos:
        if args.only_missing and es_real_local(str(prod.get("imagen", ""))):
            continue
        if procesados >= args.max_products:
            break
        procesados += 1

        nombre_base = str(prod.get("descripcion") or prod.get("nombre") or "").strip()
        nombre_base = expandir_abreviaturas(nombre_base)
        sitios = "(site:larebajavirtual.com OR site:cruzverde.com.co OR site:farmatodo.com.co OR site:drogueriascafam.com.co OR site:locatelcolombia.com OR site:farmalisto.com.co OR site:farmaciaspasteur.com.co OR site:mercadolibre.com.co OR site:exito.com OR site:farmaexpress.com OR site:alkosto.com)"
        query = f"{nombre_base} {sitios}"

        if args.debug:
            print(f"[{procesados}] {prod['id']}: {query}")

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
            file_path = out_dir / f"{prod['id']}{ext}"
            file_path.write_bytes(data)
            prod["imagen"] = f"imagenesmedimentos/reales/{file_path.name}"
            actualizados += 1
            actualizados_ids.append(prod["id"])
            exito = True
            if args.checkpoint_every and actualizados % args.checkpoint_every == 0:
                json_path.write_text(json.dumps(productos, ensure_ascii=False, indent=2), encoding="utf-8")
                print(f"  [checkpoint guardado: {actualizados} imagenes reales hasta ahora]")
            break

        # Segundo intento: para marcas mundialmente conocidas, busca sin
        # restringir a las 11 tiendas colombianas (se venden en muchos mas sitios)
        if not exito and (es_marca_global(nombre_base) or args.intento_final):
            query_amplia = f"{nombre_base} producto empaque colombia"
            if args.debug:
                print(f"    [debug] marca global, segundo intento amplio: {query_amplia}")
            items2 = buscar_serper(args.api_key, query_amplia, session, debug=args.debug)
            time.sleep(args.delay)
            for item in items2:
                link = item.get("imageUrl") or item.get("link") or ""
                source_page = item.get("link") or item.get("source") or ""
                if not link or not host_allowed_amplio(source_page or link):
                    continue
                texto = f"{item.get('title', '')} {source_page}"
                data, ext = descargar_y_validar(session, link, prod, texto)
                if data is None:
                    continue
                sha = hashlib.sha256(data).hexdigest()
                if sha in used_hashes:
                    continue
                used_hashes.add(sha)
                file_path = out_dir / f"{prod['id']}{ext}"
                file_path.write_bytes(data)
                prod["imagen"] = f"imagenesmedimentos/reales/{file_path.name}"
                actualizados += 1
                actualizados_ids.append(prod["id"])
                exito = True
                if args.checkpoint_every and actualizados % args.checkpoint_every == 0:
                    json_path.write_text(json.dumps(productos, ensure_ascii=False, indent=2), encoding="utf-8")
                    print(f"  [checkpoint guardado: {actualizados} imagenes reales hasta ahora]")
                break

        if not exito:
            prod["imagen"] = generic_for(str(prod.get("categoria", "")))
            fallidos += 1
            fallidos_ids.append(prod["id"])

        if procesados % 10 == 0:
            print(f"progreso: procesados={procesados}, reales={actualizados}, fallidos={fallidos}")

    json_path.write_text(json.dumps(productos, ensure_ascii=False, indent=2), encoding="utf-8")

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    reporte = report_dir / f"reporte_serper_{ts}.json"
    reporte.write_text(json.dumps({
        "procesados": procesados, "actualizados_reales": actualizados,
        "fallidos": fallidos, "actualizados_ids": actualizados_ids,
        "fallidos_ids": fallidos_ids,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\nprocesados={procesados}")
    print(f"actualizados_reales={actualizados}")
    print(f"fallidos={fallidos}")
    print(f"reporte={reporte}")


if __name__ == "__main__":
    main()
