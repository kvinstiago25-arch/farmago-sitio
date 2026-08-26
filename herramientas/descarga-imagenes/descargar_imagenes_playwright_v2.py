"""
descargar_imagenes_playwright_v2.py
-------------------------------------
Reemplaza a descargar_imagenes_comerciales_playwright.py (que a pesar del
nombre NO usaba un navegador real -- usaba `requests`, y por eso Bing
bloqueaba la busqueda y siempre daba 0 resultados).

Esta version SI usa un navegador Chromium real (Playwright) para:
  1. Buscar en Bing (mas dificil de bloquear con trafico de navegador real).
  2. Entrar a la pagina de producto en el sitio permitido y leer su
     meta og:image / JSON-LD (confirmado que estos sitios SI la traen en
     el HTML servido, ej. Farmatodo).
  3. Descargar la imagen y validarla (tamano minimo, fondo blanco,
     coincidencia semantica con el nombre del producto) -- misma logica
     que ya tenias, que esta bien disenada.

INSTALACION (una sola vez):
    pip install --default-timeout=120 playwright beautifulsoup4 pillow
    python -m playwright install chromium

USO (ejemplo, igual que antes):
    python descargar_imagenes_playwright_v2.py --max-products 30 --target-nonreal

RECOMENDACION IMPORTANTE:
    Corre en LOTES PEQUENOS (--max-products 20-30) y no en paralelo.
    Bing igual puede bloquear tras muchas busquedas seguidas; si ves que
    empiezan a fallar todas de golpe despues de varias exitosas, para el
    script, espera 15-20 minutos, y sigue con --target-nonreal (retoma
    donde quedo, no repite lo ya conseguido).
"""

import argparse
import hashlib
import io
import json
import random
import re
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import quote_plus, urljoin, urlparse

from bs4 import BeautifulSoup
from PIL import Image, UnidentifiedImageError
from playwright.sync_api import sync_playwright

ALLOWED_SOURCE_DOMAINS = {
    "larebajavirtual.com", "www.larebajavirtual.com",
    "cruzverde.com.co", "www.cruzverde.com.co",
    "farmatodo.com.co", "www.farmatodo.com.co",
    "drogueriascafam.com.co", "www.drogueriascafam.com.co",
}

BLOCK_IMAGE_URL_WORDS = {
    "logo", "icon", "favicon", "banner", "placeholder", "avatar",
    "anime", "shirt", "camiseta", "manga", "argentina", "peppa",
    "hoodie", "buzo", "cartoon",
}

CATEGORY_TO_GENERIC = {
    "adulto mayor": "imagenesmedimentos/genericas/adulto-mayor.svg",
    "analgesicos": "imagenesmedimentos/genericas/analgesicos.svg",
    "antibioticos": "imagenesmedimentos/genericas/antibioticos.svg",
    "antigripales": "imagenesmedimentos/genericas/antigripales.svg",
    "antiinflamatorios": "imagenesmedimentos/genericas/antiinflamatorios.svg",
    "bebes": "imagenesmedimentos/genericas/bebes.svg",
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

MIN_W = 250
MIN_H = 250
MIN_WHITE_RATIO = 0.18  # un poco mas permisivo que el original (0.22 descartaba fotos validas con fondo casi-blanco)

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36")

DEBUG = False


def dbg(*a):
    if DEBUG:
        print("  [debug]", *a, flush=True)


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--json", default="productos.json")
    p.add_argument("--out", default="imagenesmedimentos/reales")
    p.add_argument("--report-dir", default="reportes")
    p.add_argument("--max-products", type=int, default=30)
    p.add_argument("--min-delay", type=float, default=2.0)
    p.add_argument("--max-delay", type=float, default=4.5)
    p.add_argument("--checkpoint-every", type=int, default=5)
    p.add_argument("--target-nonreal", action="store_true")
    p.add_argument("--headless", action="store_true", default=True)
    p.add_argument("--debug", action="store_true", default=False)
    return p.parse_args()


def normalize_text(value):
    text = (value or "").lower().strip()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def generic_for_category(category):
    return CATEGORY_TO_GENERIC.get(normalize_text(category), CATEGORY_TO_GENERIC["otros"])


def looks_local_real_image(path_value):
    p = (path_value or "").replace("\\", "/").lower().strip()
    return p.startswith("imagenesmedimentos/reales/") and p.endswith((".jpg", ".jpeg", ".png", ".webp"))


def extract_brand(product):
    text = f"{product.get('nombre', '')} {product.get('descripcion', '')}"
    for token in re.findall(r"[A-Za-z]{3,}", text):
        t = normalize_text(token)
        if t and t not in STOPWORDS:
            return token
    return ""


def semantic_tokens(product):
    brand = normalize_text(extract_brand(product))
    name_tokens = [normalize_text(t) for t in re.findall(r"[A-Za-z]{4,}", str(product.get("nombre", "")))]
    name_tokens = [t for t in name_tokens if t and t not in STOPWORDS]
    out = ([brand] if brand else []) + name_tokens[:3]
    seen, dedup = set(), []
    for t in out:
        if t and t not in seen:
            seen.add(t)
            dedup.append(t)
    return dedup


def host_allowed(url):
    try:
        host = (urlparse(url).hostname or "").lower()
    except Exception:
        return False
    return host in ALLOWED_SOURCE_DOMAINS or any(host.endswith("." + d) for d in ALLOWED_SOURCE_DOMAINS)


def image_url_allowed(url):
    low = (url or "").lower().strip()
    if not low.startswith(("http://", "https://")):
        return False
    return not any(w in low for w in BLOCK_IMAGE_URL_WORDS)


def build_query(product):
    name = str(product.get("nombre", "")).strip()
    brand = extract_brand(product)
    sites = "(site:larebajavirtual.com OR site:cruzverde.com.co OR site:farmatodo.com.co OR site:drogueriascafam.com.co)"
    return re.sub(r"\s+", " ", f"{name} {brand} caja producto farmacia colombia {sites}").strip()[:260]


def random_delay(lo, hi):
    time.sleep(random.uniform(lo, hi))


def search_allowed_pages(page, query, limit=10):
    """Usa el navegador real para buscar en Bing (mucho mas dificil de bloquear que requests crudo)."""
    url = "https://www.bing.com/search?q=" + quote_plus(query)
    try:
        page.goto(url, timeout=30000, wait_until="domcontentloaded")
        page.wait_for_timeout(800)
        # Acepta banner de cookies si aparece
        try:
            btn = page.locator("#bnp_btn_accept")
            if btn.is_visible(timeout=1500):
                btn.click()
                page.wait_for_timeout(400)
        except Exception:
            pass
        html = page.content()
    except Exception as e:
        dbg(f"Bing goto/content fallo: {e}")
        return []

    dbg(f"Bing query: {query}")
    dbg(f"Bing HTML length: {len(html)}")
    if any(w in html.lower() for w in ("captcha", "unusual traffic", "detect unusual")):
        dbg("Bing devolvio pagina de CAPTCHA / bloqueo de trafico automatizado")

    soup = BeautifulSoup(html, "html.parser")
    all_links = soup.select("li.b_algo h2 a, li.b_algo a")
    dbg(f"Enlaces b_algo encontrados en la pagina: {len(all_links)}")

    out = []
    for a in soup.select("li.b_algo h2 a, li.b_algo a"):
        href = (a.get("href") or "").strip()
        if not href:
            continue
        if not host_allowed(href):
            continue
        if href not in out:
            out.append(href)
        if len(out) >= limit:
            break

    dbg(f"De esos, en dominios permitidos: {len(out)} -> {out[:3]}")
    return out


def extract_candidates_from_product_page(page, page_url, limit=16):
    try:
        page.goto(page_url, timeout=25000, wait_until="domcontentloaded")
        page.wait_for_timeout(500)
        html = page.content()
        title = page.title()
    except Exception as e:
        dbg(f"Producto page goto fallo ({page_url}): {e}")
        return [], ""

    soup = BeautifulSoup(html, "html.parser")
    candidates = []

    for meta in soup.select("meta[property='og:image'], meta[name='twitter:image']"):
        c = (meta.get("content") or "").strip()
        if c:
            candidates.append(urljoin(page_url, c))

    for script in soup.select("script[type='application/ld+json']"):
        raw = script.get_text(strip=True)
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except Exception:
            continue
        nodes = data if isinstance(data, list) else [data]
        for node in nodes:
            if not isinstance(node, dict):
                continue
            image_val = node.get("image")
            if isinstance(image_val, str):
                candidates.append(urljoin(page_url, image_val))
            elif isinstance(image_val, list):
                candidates.extend(urljoin(page_url, i) for i in image_val if isinstance(i, str))

    dedup, seen = [], set()
    for c in candidates:
        if c in seen:
            continue
        seen.add(c)
        if image_url_allowed(c):
            dedup.append(c)
        if len(dedup) >= limit:
            break
    dbg(f"  Pagina {page_url} -> {len(candidates)} candidatos crudos, {len(dedup)} tras filtro")
    return dedup, title


def white_background_ratio(im):
    sample = im.convert("RGB").resize((96, 96))
    pix = sample.load()
    white = sum(1 for y in range(96) for x in range(96) if all(v > 232 for v in pix[x, y]))
    return white / (96 * 96)


def semantic_match_ok(product, text_blob):
    tokens = semantic_tokens(product)
    if not tokens:
        return True
    hay = normalize_text(text_blob)
    return any(t in hay for t in tokens)


def download_and_validate(context, image_url, product, semantic_text):
    if not image_url_allowed(image_url):
        return None, None, None
    try:
        resp = context.request.get(image_url, timeout=20000, headers={"User-Agent": UA})
        if resp.status != 200:
            dbg(f"    imagen {image_url[:80]} -> HTTP {resp.status}")
            return None, None, None
        data = resp.body()
    except Exception as e:
        dbg(f"    imagen {image_url[:80]} -> error descarga: {e}")
        return None, None, None

    ctype = (resp.headers.get("content-type") or "").lower()
    if "png" in ctype:
        ext = ".png"
    elif "webp" in ctype:
        ext = ".webp"
    elif "jpeg" in ctype or "jpg" in ctype:
        ext = ".jpg"
    else:
        dbg(f"    imagen {image_url[:80]} -> content-type no soportado: {ctype}")
        return None, None, None

    try:
        with Image.open(io.BytesIO(data)) as im:
            if im.width < MIN_W or im.height < MIN_H:
                dbg(f"    imagen {image_url[:80]} -> muy chica ({im.width}x{im.height})")
                return None, None, None
            wr = white_background_ratio(im)
            if wr < MIN_WHITE_RATIO:
                dbg(f"    imagen {image_url[:80]} -> fondo no blanco ({wr:.2f} < {MIN_WHITE_RATIO})")
                return None, None, None
    except UnidentifiedImageError:
        dbg(f"    imagen {image_url[:80]} -> no es una imagen valida")
        return None, None, None
    except Exception as e:
        dbg(f"    imagen {image_url[:80]} -> error procesando: {e}")
        return None, None, None

    if not semantic_match_ok(product, semantic_text):
        dbg(f"    imagen {image_url[:80]} -> no coincide semanticamente con '{product.get('nombre')}' (texto: '{semantic_text[:80]}')")
        return None, None, None

    return data, ext, hashlib.sha256(data).hexdigest()


def save_unique_image(output_dir, product_id, data, ext):
    ext = ".jpg" if ext == ".jpeg" else ext
    file_path = output_dir / f"{product_id}{ext}"
    file_path.write_bytes(data)
    return f"imagenesmedimentos/reales/{file_path.name}".replace("\\", "/")


def load_existing_hashes(out_dir):
    hashes = set()
    for f in out_dir.glob("*"):
        if f.is_file():
            try:
                hashes.add(hashlib.sha256(f.read_bytes()).hexdigest())
            except Exception:
                pass
    return hashes


def main():
    global DEBUG
    args = parse_args()
    DEBUG = args.debug
    json_path = Path(args.json)
    out_dir = Path(args.out)
    report_dir = Path(args.report_dir)
    if not json_path.exists():
        raise FileNotFoundError(f"No existe: {json_path}")
    out_dir.mkdir(parents=True, exist_ok=True)
    report_dir.mkdir(parents=True, exist_ok=True)

    products = json.loads(json_path.read_text(encoding="utf-8-sig"))
    used_hashes = load_existing_hashes(out_dir)
    used_paths = set()

    scanned = targeted = updated_real = fallback_generic = kept = failed = 0
    updated_ids, generic_ids, failed_ids = [], [], []

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=args.headless)
        context = browser.new_context(user_agent=UA, viewport={"width": 1366, "height": 900})
        page = context.new_page()

        for prod in products:
            scanned += 1
            product_id = str(prod.get("id", "")).strip()
            if not product_id:
                failed += 1
                failed_ids.append("<sin-id>")
                continue

            current_img = str(prod.get("imagen", "")).strip()
            if args.target_nonreal and looks_local_real_image(current_img):
                kept += 1
                continue
            if args.max_products and targeted >= args.max_products:
                break

            targeted += 1
            if targeted % 5 == 0:
                print(f"progreso: objetivo={targeted}, reales={updated_real}, genericas={fallback_generic}, fallidos={failed}", flush=True)

            query = build_query(prod)
            pages = search_allowed_pages(page, query)
            random_delay(args.min_delay, args.max_delay)

            success = False
            for page_url in pages:
                if not host_allowed(page_url):
                    continue
                candidates, title = extract_candidates_from_product_page(page, page_url)
                semantic_text = f"{title} {page_url}"
                random_delay(args.min_delay * 0.5, args.max_delay * 0.5)

                for image_url in candidates:
                    data, ext, sha = download_and_validate(context, image_url, prod, semantic_text)
                    if data is None or sha in used_hashes:
                        continue
                    rel = save_unique_image(out_dir, product_id, data, ext)
                    if rel in used_paths:
                        continue
                    used_hashes.add(sha)
                    used_paths.add(rel)
                    prod["imagen"] = rel
                    updated_real += 1
                    updated_ids.append(product_id)
                    if args.checkpoint_every > 0 and updated_real % args.checkpoint_every == 0:
                        json_path.write_text(json.dumps(products, ensure_ascii=False, indent=2), encoding="utf-8-sig")
                        print(f"  [checkpoint guardado, {updated_real} reales hasta ahora]", flush=True)
                    success = True
                    break
                if success:
                    break

            if not success:
                prod["imagen"] = generic_for_category(str(prod.get("categoria", "")))
                fallback_generic += 1
                generic_ids.append(product_id)
                failed += 1
                failed_ids.append(product_id)

        browser.close()

    json_path.write_text(json.dumps(products, ensure_ascii=False, indent=2), encoding="utf-8-sig")

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_path = report_dir / f"reporte_playwright_{ts}.json"
    report_path.write_text(json.dumps({
        "timestamp": ts, "escaneados": scanned, "procesados_objetivo": targeted,
        "actualizados_reales": updated_real, "reasignados_genericos": fallback_generic,
        "conservados": kept, "fallidos": failed, "updated_ids": updated_ids,
        "failed_ids": failed_ids,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"escaneados={scanned}")
    print(f"procesados_objetivo={targeted}")
    print(f"actualizados_reales={updated_real}")
    print(f"reasignados_genericos={fallback_generic}")
    print(f"conservados={kept}")
    print(f"fallidos={failed}")
    print(f"reporte={report_path}")


if __name__ == "__main__":
    main()
