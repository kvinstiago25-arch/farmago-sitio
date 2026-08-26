"""
Prueba de remocion de fondo con IA (rembg) sobre una muestra de 20
productos variados (blisteres, jarabes, cremas, frascos, polvos, etc).
Guarda los resultados en imagenesmedimentos/prueba_sin_fondo/ SIN tocar
los archivos originales ni productos.json.
"""
import os
import time
from rembg import remove, new_session
from PIL import Image

MUESTRA = [
    "prod-00868", "prod-00119", "prod-00124", "prod-00581", "prod-00233",
    "prod-00065", "prod-00433", "prod-00046", "prod-00045", "prod-00490",
    "prod-00232", "prod-00195", "prod-00264", "prod-00434", "prod-00087",
    "prod-00516", "prod-00517", "prod-00518", "prod-00460", "prod-00696",
]

SRC_DIR = "imagenesmedimentos/reales"
OUT_DIR = "imagenesmedimentos/prueba_sin_fondo"

def encontrar_origen(pid):
    for ext in (".jpg", ".jpeg", ".png", ".webp"):
        ruta = os.path.join(SRC_DIR, pid + ext)
        if os.path.exists(ruta):
            return ruta
    return None

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    session = new_session("u2net")  # modelo general, buen punto de partida

    inicio_total = time.time()
    resultados = []
    for pid in MUESTRA:
        origen = encontrar_origen(pid)
        if not origen:
            print(f"{pid}: NO encontrado en {SRC_DIR}, se omite")
            continue
        destino = os.path.join(OUT_DIR, pid + ".png")
        t0 = time.time()
        with open(origen, "rb") as f:
            entrada = f.read()
        salida = remove(entrada, session=session)
        with open(destino, "wb") as f:
            f.write(salida)
        dt = time.time() - t0
        resultados.append((pid, origen, destino, dt))
        print(f"{pid}: {origen} -> {destino}  ({dt:.2f}s)")

    total = time.time() - inicio_total
    n = len(resultados)
    print()
    print(f"Procesadas: {n} imagenes")
    print(f"Tiempo total: {total:.1f}s")
    if n:
        promedio = total / n
        print(f"Promedio por imagen: {promedio:.2f}s")
        print(f"Estimado para 798 imagenes: {promedio * 798 / 60:.1f} minutos")

if __name__ == "__main__":
    main()
