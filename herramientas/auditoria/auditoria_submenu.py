# -*- coding: utf-8 -*-
"""
Auditoria v2 de las subcategorias del mega-menu contra el inventario real
de productos.json. v1 subestimo mucho por nombres de marca (Redoxon,
Losartan, Ponds, Tena, Centrum Silver, etc. no dicen literalmente
"vitamina c" o "presion arterial"). v2 usa palabras clave revisadas a
mano contra los nombres reales de producto de cada categoria.
"""
import json
import re
import unicodedata


def sin_acentos(s):
    return "".join(
        c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn"
    )


with open("productos.json", encoding="utf-8") as f:
    productos = json.load(f)

for p in productos:
    texto = f"{p.get('nombre','')} {p.get('descripcion','')}"
    p["_texto"] = sin_acentos(texto).lower()
    p["_cat"] = p.get("categoria", "")

MENU = [
    ("Medicamentos", [
        ("Alivio del Dolor", ["Analgésicos y antiinflamatorios"], r".*"),
        ("Fiebre y Malestar General", None, r"NUNCA_MATCH_REDUNDANTE"),  # se marca aparte como duplicado
        ("Antiinflamatorios", ["Analgésicos y antiinflamatorios"], r"inflamat|ibuprofen|naproxeno|diclofenaco|ketoprofeno"),
        ("Gripa y Tos", ["Antigripales y tos"], r".*"),
        ("Sistema Respiratorio", ["Antigripales y tos"], r"vaporub|bronqui|inhalador|expectorante|salbutamol|respirator|eclosynt|sacrusyt"),
        ("Antibióticos", ["Antibióticos"], r".*"),
        ("Salud Digestiva", ["Gastrointestinal"], r".*"),
        ("Antialérgicos", ["Alergias y antihistamínicos"], r".*"),
        ("Primeros Auxilios", ["Insumos y curación médica"], r"algodon|gasa|venda|esparadrapo|alcohol|guante|jeringa|cateter|termometro|tapabocas|micropore|aposito|gotero|cura|bajalengua"),
    ]),
    ("Vitaminas", [
        ("Vitamina C", ["Vitaminas y suplementos"], r"vitamina c\b|vit\.? c\b|redoxon|cebion"),
        ("Multivitamínicos", ["Vitaminas y suplementos"], r"multivitamin|multi ?vita|centrum|bion 3"),
        ("Vitamina D", ["Vitaminas y suplementos"], r"vitamina d\b|vit\.? d\b|\bd3\b|caltrate"),
        ("Complejo B", ["Vitaminas y suplementos"], r"complejo b|neurobion|bedoyecta|tiamina|fosfogen|activit b|multicomplex|neuro ?bion|neuro 15"),
        ("Calcio y Huesos", ["Vitaminas y suplementos"], r"calcio|caltrate|calfafem|hueso|osteo"),
        ("Hierro y Energía", ["Vitaminas y suplementos"], r"hierro|ferroso|anemidox|vitafer"),
        ("Suplementos Deportivos", ["Vitaminas y suplementos"], r"proteina|whey|creatina|deportiv|aminoacido"),
        ("Omega 3", ["Vitaminas y suplementos"], r"omega"),
        ("Defensas e Inmunidad", ["Vitaminas y suplementos"], r"defensas|inmun|bion 3|equinacea|\bzinc\b"),
    ]),
    ("Bebidas", [
        ("Sueros e Hidratación", ["Snacks y bebidas"], r"suero|electrolit|hidrat|pedialyte"),
        ("Sales de Rehidratación", None, r"NUNCA_MATCH_REDUNDANTE"),  # duplicado de Sueros e Hidratacion
        ("Agua y Minerales", ["Snacks y bebidas"], r"\bagua\b|mineral"),
        ("Bebidas Energizantes", ["Snacks y bebidas"], r"energy|amper|red bull|vive 100|mega max"),
        ("Jugos y Nutrición", ["Snacks y bebidas"], r"jugo|glucerna|ensure|nutricion|boost|nutren"),
        ("Bebidas para Niños", ["Snacks y bebidas"], r"jugo hit|ni[ñn]o|infantil|kids"),
    ]),
    ("Cuidado Personal", [
        ("Jabones y Geles", ["Cuidado personal"], r"jabon|gel de ducha|gelilab"),
        ("Higiene de Manos", ["Cuidado personal"], r"manos|antibacterial gel"),
        ("Antisépticos", ["Cuidado personal", "Insumos y curación médica", "Dermatológico y piel"], r"alcohol|isodine|yodopovil|clorhexidina|antisept"),
        ("Cremas Corporales", ["Cuidado personal"], r"nivea.*(milk|soft)|lubriderm|bio oil|locion corporal|crema corporal"),
        ("Cuidado Facial", ["Cuidado personal", "Maquillaje y cuidado facial/labial", "Dermatológico y piel"], r"ponds|nude solar|agua micelar|acid mantle|lubriderm|bloqueador|nutribela|facial|hidrahialuronico|sundark"),
        ("Desodorantes", ["Cuidado personal"], r"desodorante|antitranspirante"),
    ]),
    ("Bebés", [
        ("Pañales", ["Pañales y protección", "Bebés y maternidad"], r"pa[ñn]al"),
        ("Toallitas Húmedas", ["Bebés y maternidad", "Cuidado personal"], r"pa[ñn]itos|toallita"),
        ("Fórmulas y Nutrición Infantil", ["Bebés y maternidad"], r"formula|similac|leche klim|nestum|pediasure|surelab child"),
        ("Higiene del Bebé", ["Bebés y maternidad", "Dermatológico y piel"], r"pa[ñn]itos|talco.*bebe|bebe.*talco|johnson"),
        ("Chupos y Accesorios", ["Bebés y maternidad"], r"chupo|biberon|tetero"),
        ("Cuidado de la Piel del Bebé", ["Bebés y maternidad", "Dermatológico y piel", "Cuidado personal"], r"talco|acid mantle baby|crema.*bebe|arrurru"),
    ]),
    ("Adulto Mayor", [
        ("Control de Presión", ["Cardiovascular y metabólico"], r"losartan|amlodipino|enalapril|valsartan|captopril|hidroclorotiazida|espironolactona|nifedipino|presion|hipertens|tensofar"),
        ("Glucómetros y Diabetes", ["Cardiovascular y metabólico", "Pruebas y diagnóstico"], r"glucofage|metformina|glucometr|diabet|glucosa"),
        ("Pañales para Adultos", ["Pañales y protección", "Cuidado personal"], r"tena|adult"),
        ("Movilidad y Soporte", None, r"silla de ruedas|baston|caminador|andador|soporte ortop|muleta"),
        ("Suplementos para Mayores", ["Vitaminas y suplementos"], r"centrum silver|geriatr|senior|\+50"),
        ("Cuidado Postural", None, r"postural|ortopedic|faja|corse"),
    ]),
]


def contar(cats, kw_pattern):
    if kw_pattern == "NUNCA_MATCH_REDUNDANTE":
        return -1  # marcador especial: duplicado, no se audita por conteo
    pat = re.compile(sin_acentos(kw_pattern), re.IGNORECASE)
    n = 0
    for p in productos:
        if cats is not None and p["_cat"] not in cats:
            continue
        if pat.search(p["_texto"]):
            n += 1
    return n


print(f"{'Categoría principal':<18} {'Subcategoría':<32} {'Productos':>9}  Nota")
print("-" * 90)
resumen = []
for cat_principal, subs in MENU:
    for label, cats, kw in subs:
        n = contar(cats, kw)
        if n == -1:
            nota = "DUPLICADA (se solapa con otra subcategoría hermana)"
            resumen.append((cat_principal, label, "duplicada"))
        elif n == 0:
            nota = "0 productos"
            resumen.append((cat_principal, label, "cero"))
        elif n < 4:
            nota = f"solo {n}, dudosa"
            resumen.append((cat_principal, label, "baja"))
        else:
            nota = ""
        n_str = "dup" if n == -1 else str(n)
        print(f"{cat_principal:<18} {label:<32} {n_str:>9}  {nota}")
    print()

print("=" * 90)
for tipo, msg in [("cero", "SIN productos (0)"), ("duplicada", "DUPLICADAS (redundantes con otra subcategoría)"), ("baja", "CON POCOS productos (1-3, revisar)")]:
    items = [(c, l) for c, l, t in resumen if t == tipo]
    print(f"\n{msg}: {len(items)}")
    for c, l in items:
        print(f"  - [{c}] {l}")
