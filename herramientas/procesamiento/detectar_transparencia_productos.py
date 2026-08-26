"""
Recorre las imagenes de los 798 productos (productos.json) y detecta cuales
tienen transparencia REAL (canal alfa con una porcion significativa de
pixeles no opacos), a diferencia de PNG/WEBP que traen canal alfa pero estan
100% opacos (alpha=255 en todos lados).

Umbral: se considera "transparencia real" si al menos el 3% de los pixeles
tiene alpha < 250. Esto evita falsos positivos por antialiasing en los bordes
(que solo afecta un puñado de pixeles sueltos) y por PNG exportados como RGBA
sin recorte real.

Salida: reportes/transparencia_productos.json con:
  { "prod-00143": { "imagen": "...", "transparente": true/false, "pct_transparente": 0.0-100.0 }, ... }
"""
import json
import os
from PIL import Image

UMBRAL_PCT = 3.0       # % minimo de pixeles no-opacos para contar como "transparencia real"
ALPHA_CORTE = 250       # un pixel se considera "no opaco" si su alpha < 250

def calcular_pct_transparente(img_path):
    with Image.open(img_path) as im:
        if im.mode not in ("RGBA", "LA", "PA") and not (im.mode == "P" and "transparency" in im.info):
            return 0.0, im.mode
        rgba = im.convert("RGBA")
        alpha = rgba.getchannel("A")
        histograma = alpha.histogram()  # 256 valores, indice = nivel de alpha
        total = sum(histograma)
        no_opacos = sum(histograma[:ALPHA_CORTE])  # cuenta alpha < 250
        pct = (no_opacos / total) * 100 if total else 0.0
        return pct, im.mode

def main():
    with open("productos.json", encoding="utf-8") as f:
        productos = json.load(f)

    resultados = {}
    transparentes = 0
    opacos_con_alpha = 0
    sin_alpha = 0
    errores = 0

    for p in productos:
        pid = p["id"]
        ruta = p.get("imagen", "")
        if not os.path.exists(ruta):
            errores += 1
            resultados[pid] = {"imagen": ruta, "transparente": False, "error": "no_encontrado"}
            continue
        try:
            pct, modo = calcular_pct_transparente(ruta)
        except Exception as e:
            errores += 1
            resultados[pid] = {"imagen": ruta, "transparente": False, "error": str(e)}
            continue

        es_transparente = pct >= UMBRAL_PCT
        if es_transparente:
            transparentes += 1
        elif modo in ("RGBA", "LA", "PA"):
            opacos_con_alpha += 1
        else:
            sin_alpha += 1

        resultados[pid] = {
            "imagen": ruta,
            "modo": modo,
            "pct_transparente": round(pct, 2),
            "transparente": es_transparente,
        }

    os.makedirs("reportes", exist_ok=True)
    out_path = os.path.join("reportes", "transparencia_productos.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(resultados, f, ensure_ascii=False, indent=2)

    print(f"Total productos analizados: {len(productos)}")
    print(f"Con transparencia real (>= {UMBRAL_PCT}% pixeles no opacos): {transparentes}")
    print(f"Con canal alfa pero 100% opacos (< {UMBRAL_PCT}%): {opacos_con_alpha}")
    print(f"Sin canal alfa (jpg u otros): {sin_alpha}")
    print(f"Errores/no encontrados: {errores}")
    print(f"Detalle guardado en: {out_path}")

if __name__ == "__main__":
    main()
