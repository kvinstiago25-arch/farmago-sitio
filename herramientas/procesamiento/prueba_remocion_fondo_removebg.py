"""
Prueba de remocion de fondo con la API de remove.bg sobre una muestra de
20 productos variados (blisteres, jarabes, cremas, frascos, polvos, etc).
Guarda los resultados en imagenesmedimentos/prueba_sin_fondo/ SIN tocar
los archivos originales ni productos.json.

La API key se lee de removebg_api_key.txt (no va en el codigo, y ese
archivo esta en .gitignore para que nunca se suba a un repositorio).
"""
import os
import time

# Este entorno tiene una capa de red que re-firma el TLS saliente con una
# cadena de certificados que el OpenSSL nuevo de Python 3.14 rechaza por
# un detalle tecnico (Basic Constraints no marcado "critical"), aunque el
# almacen de certificados de Windows si la acepta (lo mismo que usa curl).
# En vez de desactivar la verificacion SSL, se apunta requests al almacen
# de Windows: sigue verificando, solo que contra la misma fuente de
# confianza que ya usa el sistema operativo.
import truststore
truststore.inject_into_ssl()
import requests

API_KEY_PATH = "removebg_api_key.txt"
API_URL = "https://api.remove.bg/v1.0/removebg"

MUESTRA = [
    "prod-00868", "prod-00119", "prod-00124", "prod-00581", "prod-00233",
    "prod-00065", "prod-00433", "prod-00046", "prod-00045", "prod-00490",
    "prod-00232", "prod-00195", "prod-00264", "prod-00434", "prod-00087",
    "prod-00516", "prod-00517", "prod-00518", "prod-00460", "prod-00696",
]

SRC_DIR = "imagenesmedimentos/reales"
OUT_DIR = "imagenesmedimentos/prueba_sin_fondo"


def cargar_api_key():
    if not os.path.exists(API_KEY_PATH):
        raise SystemExit(
            f"No existe {API_KEY_PATH}. Crea ese archivo con tu API key de remove.bg adentro."
        )
    key = open(API_KEY_PATH, encoding="utf-8").read().strip()
    if not key or key == "PEGA_AQUI_TU_API_KEY_REAL_DE_REMOVE_BG":
        raise SystemExit(
            f"{API_KEY_PATH} todavia tiene el placeholder. Reemplazalo por tu API key real de remove.bg."
        )
    return key


def encontrar_origen(pid):
    for ext in (".jpg", ".jpeg", ".png", ".webp"):
        ruta = os.path.join(SRC_DIR, pid + ext)
        if os.path.exists(ruta):
            return ruta
    return None


def quitar_fondo(api_key, ruta_imagen):
    with open(ruta_imagen, "rb") as f:
        resp = requests.post(
            API_URL,
            headers={"X-Api-Key": api_key},
            files={"image_file": f},
            data={"size": "auto"},
            timeout=60,
        )
    if resp.status_code != 200:
        raise RuntimeError(f"remove.bg respondio {resp.status_code}: {resp.text[:300]}")
    return resp.content


def main():
    api_key = cargar_api_key()
    os.makedirs(OUT_DIR, exist_ok=True)

    inicio_total = time.time()
    ok, fallidos = [], []

    for pid in MUESTRA:
        origen = encontrar_origen(pid)
        if not origen:
            print(f"{pid}: NO encontrado en {SRC_DIR}, se omite")
            fallidos.append((pid, "no encontrado en disco"))
            continue
        destino = os.path.join(OUT_DIR, pid + ".png")
        t0 = time.time()
        try:
            resultado = quitar_fondo(api_key, origen)
            with open(destino, "wb") as f:
                f.write(resultado)
            dt = time.time() - t0
            print(f"{pid}: {origen} -> {destino}  ({dt:.2f}s)")
            ok.append(pid)
        except Exception as e:
            print(f"{pid}: ERROR - {e}")
            fallidos.append((pid, str(e)))

    total = time.time() - inicio_total
    print()
    print(f"Procesadas con exito: {len(ok)} / {len(MUESTRA)}")
    if fallidos:
        print(f"Fallidas: {len(fallidos)}")
        for pid, err in fallidos:
            print(f"  - {pid}: {err}")
    print(f"Tiempo total: {total:.1f}s")
    if ok:
        promedio = total / len(ok)
        print(f"Promedio por imagen: {promedio:.2f}s")
        print(f"Estimado para 798 imagenes: {promedio * 798 / 60:.1f} minutos (sin contar límites de la API)")


if __name__ == "__main__":
    main()
