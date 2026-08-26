import argparse
import base64
import hashlib
import io
import json
import re
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import parse_qs, quote_plus, urljoin, urlparse

import truststore
truststore.inject_into_ssl()

import requests
from bs4 import BeautifulSoup
from PIL import Image, UnidentifiedImageError

ALLOWED_SOURCE_DOMAINS = {
    "larebajavirtual.com",
    "www.larebajavirtual.com",
    "cruzverde.com.co",
    "www.cruzverde.com.co",
    "farmatodo.com.co",
    "www.farmatodo.com.co",
    "drogueriascafam.com.co",
    "www.drogueriascafam.com.co",
}

# Dominios adicionales solo habilitados con --modo-final (ultimo intento ampliado)
MARKETPLACE_DOMAINS_FINAL = {
    "mercadolibre.com.co",
    "listado.mercadolibre.com.co",
    "articulo.mercadolibre.com.co",
    "www.mercadolibre.com.co",
    "rappi.com.co",
    "www.rappi.com.co",
}

# Bancos de fotos / redes sociales: nunca se aceptan aunque este activo --modo-final,
# porque el "match" de marca en su texto suele ser casual, no del producto real.
STOCK_PHOTO_BLOCKLIST_FINAL = {
    "pinimg.com",
    "pinterest.com",
    "shutterstock.com",
    "istockphoto.com",
    "gettyimages.com",
    "alamy.com",
    "freepik.com",
    "depositphotos.com",
    "dreamstime.com",
    "facebook.com",
    "instagram.com",
    "twitter.com",
    "x.com",
    "youtube.com",
    "tiktok.com",
    "wikipedia.org",
    "amazon.com",
    "ebay.com",
    "aliexpress.com",
}

# SKUs que no son productos fisicos (servicios/cargos) - nunca se buscan.
# Ver reportes/exclusiones_no_producto.json
EXCLUDED_NON_PRODUCT_IDS = {"prod-00843", "prod-00608"}

BLOCK_IMAGE_URL_WORDS = {
    "logo",
    "icon",
    "favicon",
    "banner",
    "placeholder",
    "avatar",
    "anime",
    "shirt",
    "camiseta",
    "manga",
    "argentina",
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
    "mg",
    "ml",
    "gr",
    "tab",
    "tabletas",
    "caps",
    "capsulas",
    "jarabe",
    "suspension",
    "crema",
    "gel",
    "solucion",
    "adulto",
    "ninos",
    "nino",
    "blister",
    "sobre",
    "frasco",
    "caja",
    "empaque",
}

# Palabras genericas de material/tipo de producto: nunca deben tratarse como "marca"
# porque coinciden por casualidad con dominios institucionales/gremiales no comerciales
# (ej. "algodon" -> conalgodon.com.co, que es un gremio, no una tienda).
GENERIC_PRODUCT_TERMS = {
    "algodon",
    "algodones",
    "alcohol",
    "gasa",
    "gasas",
    "venda",
    "vendas",
    "esparadrapo",
    "microporo",
    "micropore",
    "jeringa",
    "jeringas",
    "termometro",
    "mascarilla",
    "mascarillas",
    "guante",
    "guantes",
    "talco",
    "shampoo",
    "champu",
    "jabon",
    "desodorante",
    "acondicionador",
    "protector",
    "vitamina",
    "vitaminas",
    "agua",
    "aceite",
    "miel",
    "papel",
    "cinta",
    "panal",
    "panales",
    "toalla",
    "toallas",
    "comprimido",
    "comprimidos",
    "generico",
    "generica",
    "producto",
    "farmacia",
    "droga",
    "drogueria",
    "medicamento",
    "complejo",
    "servicio",
    "cuidado",
    "personal",
    "natural",
    "naturales",
    "extracto",
    "polvo",
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
    )
}

MIN_W = 320
MIN_H = 320
MIN_WHITE_RATIO = 0.22


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Descarga imagenes comerciales reales desde e-commerce farmaceutico y actualiza productos.json"
    )
    parser.add_argument("--json", default="productos.json")
    parser.add_argument("--out", default="imagenesmedimentos/reales")
    parser.add_argument("--report-dir", default="reportes")
    parser.add_argument("--max-products", type=int, default=50)
    parser.add_argument("--delay", type=float, default=0.15)
    parser.add_argument("--checkpoint-every", type=int, default=5)
    parser.add_argument("--target-nonreal", action="store_true")
    parser.add_argument(
        "--modo-final",
        action="store_true",
        help="Ultimo intento ampliado: suma MercadoLibre/Rappi y dominios oficiales de marca detectados, y relaja el filtro de fondo blanco. No relaja la validacion semantica.",
    )
    parser.add_argument(
        "--min-white-ratio",
        type=float,
        default=None,
        help="Umbral minimo de fondo blanco (0-1). Por defecto 0.22, o 0.05 si --modo-final.",
    )
    return parser.parse_args()


def normalize_text(value: str) -> str:
    text = (value or "").lower().strip()
    repl = (
        ("a", "a"),
        ("e", "e"),
        ("i", "i"),
        ("o", "o"),
        ("u", "u"),
    )
    for a, b in repl:
        text = text.replace(a, b)
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def generic_for_category(category: str) -> str:
    key = normalize_text(category)
    return CATEGORY_TO_GENERIC.get(key, "imagenesmedimentos/genericas/otros.svg")


def looks_local_real_image(path_value: str) -> bool:
    p = (path_value or "").replace("\\", "/").lower().strip()
    return p.startswith("imagenesmedimentos/reales/") and p.endswith((".jpg", ".jpeg", ".png", ".webp"))


def extract_brand(product: dict) -> str:
    text = f"{product.get('nombre', '')} {product.get('descripcion', '')}"
    for token in re.findall(r"[A-Za-z]{3,}", text):
        t = normalize_text(token)
        if t and t not in STOPWORDS and t not in GENERIC_PRODUCT_TERMS and not t.isdigit():
            return token
    return ""


def semantic_tokens(product: dict) -> list[str]:
    brand = normalize_text(extract_brand(product))
    name_tokens = [normalize_text(t) for t in re.findall(r"[A-Za-z]{4,}", str(product.get("nombre", "")))]
    name_tokens = [t for t in name_tokens if t and t not in STOPWORDS]
    out = []
    if brand:
        out.append(brand)
    out.extend(name_tokens[:3])
    dedup = []
    seen = set()
    for t in out:
        if t and t not in seen:
            seen.add(t)
            dedup.append(t)
    return dedup


def resolve_bing_redirect(href: str) -> str:
    """Bing envuelve los resultados en enlaces de tracking bing.com/ck/a?...&u=<b64>.
    Decodifica el parametro u para obtener la URL real del resultado."""
    try:
        parsed = urlparse(href)
    except Exception:
        return href
    if "bing.com" not in (parsed.hostname or ""):
        return href
    qs = parse_qs(parsed.query)
    u = (qs.get("u") or [""])[0]
    if not u:
        return href
    payload = u[2:] if u.startswith("a1") else u
    padding = "=" * (-len(payload) % 4)
    try:
        decoded = base64.urlsafe_b64decode(payload + padding).decode("utf-8", errors="ignore")
        if decoded.startswith("http"):
            return decoded
    except Exception:
        pass
    return href


def host_allowed(url: str, product: dict | None = None, final_mode: bool = False) -> bool:
    try:
        host = (urlparse(url).hostname or "").lower()
    except Exception:
        return False
    if not host:
        return False

    if host in ALLOWED_SOURCE_DOMAINS or any(host.endswith("." + d) for d in ALLOWED_SOURCE_DOMAINS):
        return True

    if not final_mode:
        return False

    if host in STOCK_PHOTO_BLOCKLIST_FINAL or any(host.endswith("." + d) for d in STOCK_PHOTO_BLOCKLIST_FINAL):
        return False

    if host in MARKETPLACE_DOMAINS_FINAL or any(host.endswith("." + d) for d in MARKETPLACE_DOMAINS_FINAL):
        return True

    # Dominio propio de la marca/laboratorio: se acepta solo si el nombre de marca
    # (>=5 caracteres, para evitar falsos positivos) aparece en el host.
    if product is not None:
        brand = normalize_text(extract_brand(product))
        if len(brand) >= 6 and brand not in GENERIC_PRODUCT_TERMS and brand in host.replace("-", ""):
            return True

    return False


def image_url_allowed(url: str) -> bool:
    low = (url or "").lower().strip()
    if not (low.startswith("http://") or low.startswith("https://")):
        return False
    return not any(w in low for w in BLOCK_IMAGE_URL_WORDS)


def build_query(product: dict, final_mode: bool = False) -> str:
    name = str(product.get("nombre", "")).strip()
    brand = extract_brand(product)
    sites = ["larebajavirtual.com", "cruzverde.com.co", "farmatodo.com.co", "drogueriascafam.com.co"]
    if final_mode:
        sites += ["mercadolibre.com.co", "rappi.com.co"]
    pharm_sites = "(" + " OR ".join(f"site:{s}" for s in sites) + ")"
    query = f"{name} {brand} caja empaque producto farmacia colombia {pharm_sites}"
    return re.sub(r"\s+", " ", query).strip()[:260]


def build_query_open(product: dict) -> str:
    # Sin site: restringido, para dar oportunidad al dominio propio de la marca/laboratorio.
    name = str(product.get("nombre", "")).strip()
    brand = extract_brand(product)
    query = f"{name} {brand} colombia comprar producto"
    return re.sub(r"\s+", " ", query).strip()[:260]


def search_pages(
    session: requests.Session,
    queries: list[str],
    product: dict,
    final_mode: bool = False,
    limit: int = 12,
) -> list[str]:
    out = []
    for query in queries:
        url = "https://www.bing.com/search?q=" + quote_plus(query)
        try:
            resp = session.get(url, headers=HEADERS, timeout=30)
            resp.raise_for_status()
        except Exception:
            continue

        soup = BeautifulSoup(resp.text, "html.parser")
        for a in soup.select("li.b_algo h2 a"):
            href = (a.get("href") or "").strip()
            if not href:
                continue
            href = resolve_bing_redirect(href)
            if not host_allowed(href, product, final_mode):
                continue
            if href not in out:
                out.append(href)
            if len(out) >= limit:
                return out
    return out


def extract_candidates_from_product_page(session: requests.Session, page_url: str, limit: int = 16) -> tuple[list[str], str]:
    try:
        resp = session.get(page_url, headers=HEADERS, timeout=25)
        resp.raise_for_status()
    except Exception:
        return [], ""

    soup = BeautifulSoup(resp.text, "html.parser")
    title = soup.title.get_text(" ", strip=True) if soup.title else ""

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
                for img in image_val:
                    if isinstance(img, str):
                        candidates.append(urljoin(page_url, img))

    for img in soup.select("img"):
        for attr in ("src", "data-src", "data-original", "data-lazy-src"):
            src = (img.get(attr) or "").strip()
            if not src:
                continue
            candidates.append(urljoin(page_url, src))

    dedup = []
    seen = set()
    for c in candidates:
        if c in seen:
            continue
        seen.add(c)
        if image_url_allowed(c):
            dedup.append(c)
        if len(dedup) >= limit:
            break

    return dedup, title


def white_background_ratio(im: Image.Image) -> float:
    sample = im.convert("RGB").resize((96, 96))
    pix = sample.load()
    white = 0
    total = 96 * 96
    for y in range(96):
        for x in range(96):
            r, g, b = pix[x, y]
            if r > 236 and g > 236 and b > 236:
                white += 1
    return white / total


def semantic_match_ok(product: dict, text_blob: str) -> bool:
    tokens = semantic_tokens(product)
    if not tokens:
        return True
    hay = normalize_text(text_blob)
    hits = sum(1 for t in tokens if t in hay)
    if len(tokens) >= 2:
        return hits >= 1
    return hits >= 1


def download_and_validate(
    session: requests.Session,
    image_url: str,
    product: dict,
    semantic_text: str,
    min_white_ratio: float = MIN_WHITE_RATIO,
) -> tuple[bytes, str, str] | tuple[None, None, None]:
    if not image_url_allowed(image_url):
        return None, None, None

    try:
        resp = session.get(image_url, headers=HEADERS, timeout=25)
    except Exception:
        return None, None, None

    if resp.status_code != 200 or not resp.content:
        return None, None, None

    ctype = (resp.headers.get("content-type") or "").lower()
    if "jpeg" in ctype or "jpg" in ctype:
        ext = ".jpg"
    elif "png" in ctype:
        ext = ".png"
    elif "webp" in ctype:
        ext = ".webp"
    else:
        return None, None, None

    data = resp.content
    try:
        with Image.open(io.BytesIO(data)) as im:
            if im.width < MIN_W or im.height < MIN_H:
                return None, None, None
            if white_background_ratio(im) < min_white_ratio:
                return None, None, None
    except UnidentifiedImageError:
        return None, None, None
    except Exception:
        return None, None, None

    if not semantic_match_ok(product, semantic_text):
        return None, None, None

    sha = hashlib.sha256(data).hexdigest()
    return data, ext, sha


def save_unique_image(output_dir: Path, product_id: str, data: bytes, ext: str) -> str:
    ext = ".jpg" if ext == ".jpeg" else ext
    file_path = output_dir / f"{product_id}{ext}"
    file_path.write_bytes(data)
    return f"imagenesmedimentos/reales/{file_path.name}".replace("\\", "/")


def load_existing_hashes(out_dir: Path) -> set[str]:
    hashes = set()
    for f in out_dir.glob("*"):
        if not f.is_file():
            continue
        try:
            hashes.add(hashlib.sha256(f.read_bytes()).hexdigest())
        except Exception:
            continue
    return hashes


def main() -> None:
    args = parse_args()

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

    min_white_ratio = args.min_white_ratio
    if min_white_ratio is None:
        min_white_ratio = 0.05 if args.modo_final else MIN_WHITE_RATIO

    scanned = 0
    targeted = 0
    updated_real = 0
    fallback_generic = 0
    kept = 0
    failed = 0
    excluidos_no_producto = 0
    updated_ids = []
    generic_ids = []
    failed_ids = []
    excluidos_ids = []

    session = requests.Session()

    for prod in products:
        scanned += 1

        product_id = str(prod.get("id", "")).strip()
        if not product_id:
            failed += 1
            failed_ids.append("<sin-id>")
            continue

        if product_id in EXCLUDED_NON_PRODUCT_IDS:
            excluidos_no_producto += 1
            excluidos_ids.append(product_id)
            continue

        current_img = str(prod.get("imagen", "")).strip()
        if args.target_nonreal and looks_local_real_image(current_img):
            kept += 1
            continue

        if args.max_products and targeted >= args.max_products:
            break

        targeted += 1
        if targeted % 10 == 0:
            print(
                f"progreso: objetivo={targeted}, reales={updated_real}, genericas={fallback_generic}, fallidos={failed}",
                flush=True,
            )

        queries = [build_query(prod, final_mode=args.modo_final)]
        if args.modo_final:
            queries.append(build_query_open(prod))
        pages = search_pages(session, queries, prod, final_mode=args.modo_final)
        success = False

        for page_url in pages:
            image_candidates, page_title = extract_candidates_from_product_page(session, page_url)
            semantic_text = f"{page_title} {page_url}"

            for image_url in image_candidates:
                data, ext, sha = download_and_validate(session, image_url, prod, semantic_text, min_white_ratio)
                if data is None:
                    continue
                if sha in used_hashes:
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
                    json_path.write_text(json.dumps(products, ensure_ascii=False, indent=4), encoding="utf-8-sig")
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

        if args.delay > 0:
            time.sleep(args.delay)

    json_path.write_text(json.dumps(products, ensure_ascii=False, indent=4), encoding="utf-8-sig")

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_path = report_dir / f"reporte_lote_comercial_{ts}.json"
    report = {
        "timestamp": ts,
        "json": str(json_path),
        "output_dir": str(out_dir),
        "escaneados": scanned,
        "procesados_objetivo": targeted,
        "actualizados_reales": updated_real,
        "reasignados_genericos": fallback_generic,
        "conservados": kept,
        "fallidos": failed,
        "updated_ids": updated_ids,
        "generic_ids": generic_ids,
        "failed_ids": failed_ids,
        "excluidos_no_producto": excluidos_no_producto,
        "excluidos_no_producto_ids": excluidos_ids,
        "modo_final": args.modo_final,
        "min_white_ratio_usado": min_white_ratio,
        "allowed_sources": sorted(
            ALLOWED_SOURCE_DOMAINS | (MARKETPLACE_DOMAINS_FINAL if args.modo_final else set())
        ),
    }
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"escaneados={scanned}")
    print(f"procesados_objetivo={targeted}")
    print(f"actualizados_reales={updated_real}")
    print(f"reasignados_genericos={fallback_generic}")
    print(f"conservados={kept}")
    print(f"fallidos={failed}")
    print(f"excluidos_no_producto={excluidos_no_producto}")
    print(f"json={json_path}")
    print(f"salida={out_dir}")
    print(f"reporte={report_path}")


if __name__ == "__main__":
    main()
