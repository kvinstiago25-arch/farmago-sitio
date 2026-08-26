"""
Extrae el color exacto de la barra de navegacion azul desde la imagen de
referencia, tomando un pixel de una zona plana de fondo (entre el
buscador y "Mi carrito", sin texto ni logo encima).
"""
from PIL import Image

RUTA_IMAGEN = r"C:\Users\lenovo\Downloads\ChatGPT Image 21 ago 2026, 12_00_14.png"
PUNTO_MUESTRA = (1200, 45)  # entre el buscador y "Mi carrito", zona plana de fondo

im = Image.open(RUTA_IMAGEN).convert("RGB")
print(f"Imagen: {RUTA_IMAGEN}")
print(f"Tamano: {im.size}")

r, g, b = im.getpixel(PUNTO_MUESTRA)
hexcolor = f"#{r:02X}{g:02X}{b:02X}"
print(f"Punto muestreado: {PUNTO_MUESTRA}")
print(f"RGB: ({r}, {g}, {b})")
print(f"HEX: {hexcolor}")

# Verificacion cruzada: promedio de varios puntos cercanos, para
# confirmar que no cayo sobre un borde/antialiasing puntual.
puntos = [(1150, 30), (1180, 45), (1200, 45), (1220, 60), (1250, 45), (1300, 30)]
muestras = [im.getpixel(p) for p in puntos]
avg = tuple(round(sum(c[i] for c in muestras) / len(muestras)) for i in range(3))
avg_hex = f"#{avg[0]:02X}{avg[1]:02X}{avg[2]:02X}"
print()
print("Verificacion cruzada (6 puntos cercanos):")
for p, c in zip(puntos, muestras):
    print(f"  {p} -> RGB{c}")
print(f"Promedio: RGB{avg}  HEX {avg_hex}")
