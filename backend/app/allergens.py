CANONICAL_ALLERGENS = [
    "gluten",
    "dairy",
    "egg",
    "peanuts",
    "tree_nuts",
    "soy",
    "shellfish",
    "fish",
    "sesame",
    "celery",
    "mustard",
    "lupin",
    "sulfites",
]

ALLERGEN_LABELS = {
    "gluten": "Gluten",
    "dairy": "Dairy",
    "egg": "Egg",
    "peanuts": "Peanuts",
    "tree_nuts": "Tree nuts",
    "soy": "Soy",
    "shellfish": "Shellfish",
    "fish": "Fish",
    "sesame": "Sesame",
    "celery": "Celery",
    "mustard": "Mustard",
    "lupin": "Lupin",
    "sulfites": "Sulfites",
}


def is_canonical(allergen: str) -> bool:
    return allergen in CANONICAL_ALLERGENS
