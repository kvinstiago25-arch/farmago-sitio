"""
Copia las 14 imagenes de producto con transparencia real confirmada hacia
imagenesmedimentos/reales/, reemplazando las versiones opacas viejas.

Para cada producto:
  - Si la extension del archivo transparente coincide con la que ya tiene
    productos.json, solo se copia (mismo nombre).
  - Si la extension es distinta (ej. el original era .jpg y la version
    transparente es .png), se copia con la NUEVA extension, se actualiza
    "imagen" en productos.json, y se borra el archivo viejo de esa
    extension en reales/ para no dejar huerfanos. Nunca se convierte un
    PNG/WEBP con alfa a JPG (eso destruiria la transparencia).
"""
import json
import os
import shutil

FUENTES = {
    "prod-00105": "imagenesmedimentos/reales_backup/prod-00105.png",
    "prod-00106": "imagenesmedimentos/reales_backup/prod-00106.png",
    "prod-00161": "imagenesmedimentos/reales_backup/prod-00161.png",
    "prod-00200": "imagenesmedimentos/reales_backup/prod-00200.png",
    "prod-00227": "imagenesmedimentos/reales_backup/prod-00227.webp",
    "prod-00269": "imagenesmedimentos/reales_backup/prod-00269.png",
    "prod-00598": "imagenesmedimentos/reales_backup/prod-00598.png",
    "prod-00605": "imagenesmedimentos/reales_backup/prod-00605.png",
    "prod-00693": "imagenesmedimentos/reales_backup/prod-00693.png",
    "prod-00751": "imagenesmedimentos/reales_backup/prod-00751.png",
    "prod-00754": "imagenesmedimentos/reales_backup/prod-00754.png",
    "prod-00755": "imagenesmedimentos/reales_backup/prod-00755.png",
    "prod-00822": "imagenesmedimentos/reales_backup/prod-00822.png",
    "prod-00314": "imagenesmedimentos/prod-00314.png",
}
DEST_DIR = "imagenesmedimentos/reales"

def main():
    with open("productos.json", encoding="utf-8") as f:
        productos = json.load(f)
    by_id = {p["id"]: p for p in productos}

    log = []
    for pid, fuente in FUENTES.items():
        p = by_id.get(pid)
        if not p:
            log.append(f"{pid}: NO existe en productos.json, se omite")
            continue

        ext_nueva = os.path.splitext(fuente)[1].lower()
        imagen_actual = p["imagen"]
        ext_actual = os.path.splitext(imagen_actual)[1].lower()
        destino = f"{DEST_DIR}/{pid}{ext_nueva}"

        shutil.copyfile(fuente, destino)

        if ext_actual != ext_nueva:
            ruta_vieja = f"{DEST_DIR}/{pid}{ext_actual}"
            p["imagen"] = destino
            if os.path.exists(ruta_vieja) and ruta_vieja != destino:
                os.remove(ruta_vieja)
            log.append(f"{pid}: copiado a {destino} (extension cambio de {ext_actual} -> {ext_nueva}, productos.json actualizado, {ruta_vieja} eliminado)")
        else:
            log.append(f"{pid}: copiado a {destino} (misma extension, productos.json sin cambios)")

    with open("productos.json", "w", encoding="utf-8") as f:
        json.dump(productos, f, ensure_ascii=False, indent=2)

    # Limpieza de duplicados sueltos de prod-00314 en la carpeta raiz
    dup = "imagenesmedimentos/prod-00314 (2).png"
    if os.path.exists(dup):
        os.remove(dup)
        log.append(f"eliminado duplicado suelto: {dup}")
    orig = "imagenesmedimentos/prod-00314.png"
    if os.path.exists(orig):
        os.remove(orig)
        log.append(f"eliminado (ya copiado a reales/): {orig}")

    for linea in log:
        print(linea)

if __name__ == "__main__":
    main()
