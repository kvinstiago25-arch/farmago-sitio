import csv
import json
from pathlib import Path

RAIZ = Path(__file__).parent
PRODUCTOS_JSON = RAIZ / "productos.json"
REALES_ABS = RAIZ / "imagenesmedimentos" / "reales"

productos = json.loads(PRODUCTOS_JSON.read_text(encoding="utf-8"))

candidatos = []
for p in productos:
    imagen = (p.get("imagen") or "").replace("\\", "/")
    if "/reales/" not in imagen:
        continue
    fname = imagen.split("/")[-1]
    abspath = REALES_ABS / fname
    if not abspath.exists():
        continue
    candidatos.append({
        "sku": p.get("id", ""),
        "nombre": p.get("nombre", ""),
        "descripcion": p.get("descripcion", ""),
        "categoria": p.get("categoria", ""),
        "ruta_abs": str(abspath),
    })

print(f"Total candidatos para QA visual: {len(candidatos)}")

N_LOTES = 10
tam = -(-len(candidatos) // N_LOTES)  # ceil div
lotes = [candidatos[i:i + tam] for i in range(0, len(candidatos), tam)]
print(f"Lotes: {len(lotes)}, tamano aprox por lote: {tam}")

out_dir = RAIZ / "reportes"
for idx, lote in enumerate(lotes, start=1):
    out_path = out_dir / f"lote_qa_visual_{idx:02d}.json"
    out_path.write_text(json.dumps(lote, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"  {out_path.name}: {len(lote)} productos")
