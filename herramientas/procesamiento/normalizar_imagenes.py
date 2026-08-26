"""
normalizar_imagenes.py
--------------------------
Recorta el espacio en blanco sobrante alrededor del producto en cada imagen
de imagenesmedimentos/reales/, y la vuelve a centrar sobre un lienzo cuadrado
con un margen parejo. Esto hace que todas las fotos (las que ya tenias a
mano y las que trajo Serper) se vean del mismo tamano relativo en las
tarjetas del catalogo, sin tocar nada de HTML/CSS/JS.

Hace un respaldo de las imagenes originales antes de tocarlas, por si acaso.

USO:
    python normalizar_imagenes.py

Genera:
    imagenesmedimentos/reales/*         -> imagenes recortadas y centradas (sobrescribe)
    imagenesmedimentos/reales_backup/*  -> copia de las imagenes originales, sin tocar
"""

import json
import shutil
from pathlib import Path

from PIL import Image

CARPETA = Path("imagenesmedimentos/reales")
BACKUP = Path("imagenesmedimentos/reales_backup")
REPORTES_DIR = Path("reportes")
LIENZO = 900          # tamano final del cuadro (ancho = alto)
MARGEN_PORC = 0.08     # 8% de margen blanco alrededor del producto recortado
UMBRAL_BLANCO = 245    # un pixel se considera "fondo" si sus 3 canales estan por encima de esto


def ids_generados_por_serper():
    """Lee todos los reportes de descargar_imagenes_serper.py y junta los IDs
    que ese script descargo, para NO tocar las imagenes que agregaste a mano."""
    ids = set()
    if not REPORTES_DIR.exists():
        return ids
    for f in REPORTES_DIR.glob("reporte_serper_*.json"):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            ids.update(data.get("actualizados_ids", []))
        except Exception:
            pass
    return ids


def encontrar_recuadro(im):
    """Devuelve la caja (izquierda, arriba, derecha, abajo) del contenido no-blanco."""
    rgb = im.convert("RGB")
    w, h = rgb.size
    pix = rgb.load()

    izq, arriba, der, abajo = w, h, 0, 0
    encontrado = False
    # Muestrea cada 2 pixeles para que sea rapido en imagenes grandes
    paso = max(1, min(w, h) // 400)
    for y in range(0, h, paso):
        for x in range(0, w, paso):
            r, g, b = pix[x, y]
            if not (r > UMBRAL_BLANCO and g > UMBRAL_BLANCO and b > UMBRAL_BLANCO):
                encontrado = True
                izq = min(izq, x)
                der = max(der, x)
                arriba = min(arriba, y)
                abajo = max(abajo, y)

    if not encontrado:
        return None
    return (izq, arriba, der, abajo)


def procesar(path):
    with Image.open(path) as im:
        im = im.convert("RGB")
        caja = encontrar_recuadro(im)
        if caja is None:
            return False  # imagen totalmente blanca o vacia, la dejamos como esta

        recortada = im.crop(caja)
        cw, ch = recortada.size

        margen = int(max(cw, ch) * MARGEN_PORC)
        lado_contenido = max(cw, ch) + margen * 2

        lienzo = Image.new("RGB", (lado_contenido, lado_contenido), (255, 255, 255))
        x_off = (lado_contenido - cw) // 2
        y_off = (lado_contenido - ch) // 2
        lienzo.paste(recortada, (x_off, y_off))

        lienzo = lienzo.resize((LIENZO, LIENZO), Image.LANCZOS)
        lienzo.save(path, quality=90)
    return True


def main():
    if not CARPETA.exists():
        print(f"No existe la carpeta {CARPETA}")
        return

    BACKUP.mkdir(parents=True, exist_ok=True)

    ids_serper = ids_generados_por_serper()
    if not ids_serper:
        print("No encontre reportes en 'reportes/reporte_serper_*.json'.")
        print("No se toco ninguna imagen (por seguridad, para no tocar las manuales por error).")
        return
    print(f"IDs descargados por Serper (segun los reportes): {len(ids_serper)}")

    archivos = [
        f for f in CARPETA.iterdir()
        if f.is_file() and f.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp")
        and f.stem in ids_serper
    ]
    print(f"De esos, encontrados en disco para normalizar: {len(archivos)}")
    print("(las imagenes que agregaste a mano NO se tocan)")

    procesadas = saltadas = errores = 0
    for f in archivos:
        backup_path = BACKUP / f.name
        if not backup_path.exists():
            shutil.copy2(f, backup_path)
        try:
            if procesar(f):
                procesadas += 1
            else:
                saltadas += 1
        except Exception as e:
            errores += 1
            print(f"  error con {f.name}: {e}")

    print(f"\nProcesadas: {procesadas}")
    print(f"Saltadas (vacias/blancas): {saltadas}")
    print(f"Errores: {errores}")
    print(f"Respaldo de originales guardado en: {BACKUP}")


if __name__ == "__main__":
    main()
