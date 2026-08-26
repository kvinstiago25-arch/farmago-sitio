import json
from pathlib import Path

detalle = json.loads(Path("reportes/pendientes_119_detalle.json").read_text(encoding="utf-8"))

REVISAR_NOMBRE_INMEDIATO = {"prod-00843", "prod-00608", "prod-00194", "prod-00137"}

candidatos = [d for d in detalle if d["sku"] not in REVISAR_NOMBRE_INMEDIATO]
print(f"Total a investigar: {len(candidatos)}")

N_LOTES = 8
tam = -(-len(candidatos) // N_LOTES)
lotes = [candidatos[i:i + tam] for i in range(0, len(candidatos), tam)]
for idx, lote in enumerate(lotes, start=1):
    out_path = Path(f"reportes/lote_ampliado_{idx:02d}.json")
    out_path.write_text(json.dumps(lote, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"  {out_path.name}: {len(lote)} productos")
