import argparse
import io
import json
import re
import time
from pathlib import Path
from urllib.parse import quote_plus, urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from PIL import Image, UnidentifiedImageError

BLOCKED_WORDS = {"logo", "icon", "vector", "symbol", "banner", "brand"}
ALLOWED_EXTS = {".jpg", ".jpeg", ".png"}
MIN_WIDTH = 200
MIN_HEIGHT = 200

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
    )
}


def is_blocked_text(text: str) -> bool:
    t = (text or "").lower()
    return any(word in t for word in BLOCKED_WORDS)


def clean_candidate(url: str, base_url: str = "") -> str:
    if not url:
        return ""
    u = url.strip()
    if u.startswith("//"):
        u = "https:" + u
    if base_url:
        u = urljoin(base_url, u)
    if u.startswith("data:"):
        return ""
    return u


def ext_from_url(url: str) -> str:
    path = urlparse(url).path.lower()
    for ext in ALLOWED_EXTS:
        if path.endswith(ext):
            return ext
    return ""


def ext_from_content_type(content_type: str) -> str:
    c = (content_type or "").lower()
    if "image/jpeg" in c or "image/jpg" in c:
        return ".jpg"
    if "image/png" in c:
        return ".png"
    return ""


def is_allowed_image_url(url: str) -> bool:
    if not url:
        return False
    if not url.startswith("http://") and not url.startswith("https://"):
        return False
    low = url.lower()
    if is_blocked_text(low):
        return False
    if low.endswith(".svg") or low.endswith(".ico"):
        return False
    return True


def get_search_result_pages(session: requests.Session, query: str, max_results: int = 8) -> list[str]:
    # DuckDuckGo HTML endpoint: simple and parseable without browser automation.
    search_url = "https://duckduckgo.com/html/?q=" + quote_plus(query)
    resp = session.get(search_url, headers=HEADERS, timeout=25)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")
    links = []
    for a in soup.select("a.result__a, a[data-testid='result-title-a']"):
        href = a.get("href", "")
        href = clean_candidate(href)
        if not href:
            continue
        if href not in links:
            links.append(href)
        if len(links) >= max_results:
            break
    return links


def extract_image_candidates_from_page(session: requests.Session, page_url: str, max_images: int = 20) -> list[str]:
    try:
        resp = session.get(page_url, headers=HEADERS, timeout=20)
        resp.raise_for_status()
    except Exception:
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    candidates = []

    # Priority meta images
    for meta in soup.select("meta[property='og:image'], meta[name='twitter:image']"):
        content = clean_candidate(meta.get("content", ""), page_url)
        if is_allowed_image_url(content):
            candidates.append(content)

    # Generic img tags
    for img in soup.find_all("img"):
        for attr in ("src", "data-src", "data-original", "data-lazy-src"):
            src = clean_candidate(img.get(attr, ""), page_url)
            if not is_allowed_image_url(src):
                continue
            candidates.append(src)

    # Deduplicate preserving order.
    deduped = []
    seen = set()
    for c in candidates:
        if c in seen:
            continue
        seen.add(c)
        deduped.append(c)
        if len(deduped) >= max_images:
            break
    return deduped


def download_and_validate_image(session: requests.Session, image_url: str) -> tuple[bytes, str] | tuple[None, None]:
    try:
        resp = session.get(image_url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
    except Exception:
        return None, None

    content_type = resp.headers.get("Content-Type", "")
    ct_ext = ext_from_content_type(content_type)
    if not ct_ext:
        # If content type is unknown, allow only if URL extension is valid.
        uext = ext_from_url(image_url)
        if uext not in ALLOWED_EXTS:
            return None, None
        ct_ext = ".jpg" if uext == ".jpeg" else uext

    if "svg" in content_type.lower() or "icon" in content_type.lower():
        return None, None

    data = resp.content
    if not data:
        return None, None

    try:
        with Image.open(io.BytesIO(data)) as im:
            w, h = im.size
            if w < MIN_WIDTH or h < MIN_HEIGHT:
                return None, None
    except UnidentifiedImageError:
        return None, None
    except Exception:
        return None, None

    return data, ct_ext


def infer_query(product: dict) -> str:
    nombre = str(product.get("nombre", "")).strip()
    categoria = str(product.get("categoria", "")).strip()
    descripcion = str(product.get("descripcion", "")).strip()
    query = f"{nombre} caja empaque real drogueria colombia {categoria} {descripcion}".strip()
    # Avoid over-long queries.
    return re.sub(r"\s+", " ", query)[:220]


def looks_local_real_image(path_value: str) -> bool:
    if not path_value:
        return False
    p = path_value.replace("\\", "/").lower()
    if p.startswith("imagenesmedimentos/reales/"):
        return True
    if p.startswith("imagenesmedimentos/") and "/genericas/" not in p and any(p.endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".webp"]):
        return True
    return False


def save_image(output_dir: Path, product_id: str, data: bytes, ext: str) -> str:
    ext = ".jpg" if ext == ".jpeg" else ext
    out_name = f"{product_id}{ext}"
    out_path = output_dir / out_name
    out_path.write_bytes(data)
    return f"imagenesmedimentos/reales/{out_name}".replace("\\", "/")


def main() -> None:
    parser = argparse.ArgumentParser(description="Descarga imágenes de productos y actualiza productos.json")
    parser.add_argument("--json", default="productos.json", help="Ruta a productos.json")
    parser.add_argument("--out", default="imagenesmedimentos/reales", help="Carpeta de salida para fotos reales")
    parser.add_argument("--max-products", type=int, default=0, help="Límite de productos a procesar (0=sin límite)")
    parser.add_argument("--only-missing", action="store_true", help="Solo buscar para productos sin foto real local")
    parser.add_argument("--delay", type=float, default=0.25, help="Pausa entre productos para evitar bloqueo")
    args = parser.parse_args()

    json_path = Path(args.json)
    out_dir = Path(args.out)

    if not json_path.exists():
        raise FileNotFoundError(f"No existe: {json_path}")
    out_dir.mkdir(parents=True, exist_ok=True)

    products = json.loads(json_path.read_text(encoding="utf-8-sig"))

    session = requests.Session()
    updated = 0
    kept = 0
    failed = 0
    scanned = 0
    targeted = 0

    for p in products:
        scanned += 1

        product_id = str(p.get("id", "")).strip()
        if not product_id:
            failed += 1
            continue

        current_img = str(p.get("imagen", "")).strip()
        if args.only_missing and looks_local_real_image(current_img):
            kept += 1
            continue

        if args.max_products and targeted >= args.max_products:
            break

        targeted += 1

        if targeted % 25 == 0:
            print(f"progreso: objetivo={targeted}, actualizados={updated}, fallidos={failed}", flush=True)

        query = infer_query(p)
        page_urls = []
        try:
            page_urls = get_search_result_pages(session, query, max_results=8)
        except Exception:
            page_urls = []

        success = False
        for page in page_urls:
            if is_blocked_text(page):
                continue

            candidates = extract_image_candidates_from_page(session, page, max_images=20)
            for cand in candidates:
                if not is_allowed_image_url(cand):
                    continue
                img_data, ext = download_and_validate_image(session, cand)
                if img_data is None:
                    continue
                rel = save_image(out_dir, product_id, img_data, ext)
                p["imagen"] = rel
                updated += 1
                success = True
                break
            if success:
                break

        if not success:
            # Mantiene la imagen actual (placeholder/genérica) sin frenar el proceso.
            failed += 1

        if args.delay > 0:
            time.sleep(args.delay)

    json_path.write_text(json.dumps(products, ensure_ascii=False, indent=4), encoding="utf-8-sig")

    print(f"escaneados={scanned}")
    print(f"procesados_objetivo={targeted}")
    print(f"actualizados={updated}")
    print(f"conservados={kept}")
    print(f"fallidos={failed}")
    print(f"json={json_path}")
    print(f"salida={out_dir}")


if __name__ == "__main__":
    main()
