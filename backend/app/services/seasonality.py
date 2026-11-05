from __future__ import annotations

from ..models import Ingredient

# Produce-season map: ingredient name -> months (1-12) it is in season (Northern hemisphere).
PRODUCE_SEASONS: dict[str, set[int]] = {
    "White onion": set(range(4, 11)),
    "Red onion": set(range(4, 11)),
    "Yellow onion": set(range(4, 11)),
    "Scallions": set(range(3, 9)),
    "Garlic": set(range(6, 10)),
    "Ginger": set(range(1, 13)),
    "Carrots": set(range(1, 13)),
    "Celery": set(range(1, 13)),
    "Potatoes": set(range(1, 13)),
    "Sweet potato": set(range(9, 13)) | {1, 2},
    "Zucchini": set(range(5, 10)),
    "Eggplant": set(range(6, 10)),
    "Bell peppers": set(range(6, 11)),
    "Jalapeño": set(range(5, 11)),
    "Cherry tomatoes": set(range(6, 10)),
    "Plum tomatoes": set(range(6, 10)),
    "Tomatoes": set(range(6, 10)),
    "Mushrooms": set(range(1, 13)),
    "Baby spinach": set(range(1, 13)),
    "Kale": set(range(10, 13)) | {1, 2, 3},
    "Broccoli": set(range(10, 13)) | {1, 2, 3, 4},
    "Cauliflower": set(range(9, 13)) | {1, 2, 3},
    "Green cabbage": set(range(9, 13)) | {1, 2, 3, 4},
    "Napa cabbage": set(range(9, 13)) | {1, 2, 3},
    "Bok choy": set(range(10, 13)) | {1, 2, 3},
    "Cucumber": set(range(4, 10)),
    "Avocado": set(range(1, 13)),
    "Pear": set(range(8, 13)) | {1, 2},
    "Peas": set(range(3, 7)),
    "Corn kernels": set(range(5, 10)),
    "Green beans": set(range(5, 10)),
    "Snow peas": set(range(4, 7)),
    "Bean sprouts": set(range(1, 13)),
    "Shallots": set(range(4, 10)),
    "Lemons": set(range(1, 13)),
    "Limes": set(range(1, 13)),
    "Cilantro": set(range(4, 11)),
    "Parsley": set(range(1, 13)),
    "Basil": set(range(5, 10)),
    "Mint": set(range(4, 10)),
    "Dill": set(range(3, 10)),
    "Rosemary": set(range(1, 13)),
    "Thyme": set(range(1, 13)),
    "Arugula": set(range(3, 7)) | {9, 10, 11},
    "Romaine lettuce": set(range(3, 10)),
}

SEASON_LABELS = {1: "חורף", 2: "חורף", 3: "אביב", 4: "אביב", 5: "אביב",
                 6: "קיץ", 7: "קיץ", 8: "קיץ", 9: "סתיו", 10: "סתיו",
                 11: "סתיו", 12: "חורף"}


def month_to_season(month: int) -> str:
    return SEASON_LABELS.get(month, "חורף")


def is_in_season(ingredient: Ingredient, month: int | None) -> bool | None:
    """Return True if in season, False if out of season, None if unknown."""
    if month is None:
        return None
    seasons = PRODUCE_SEASONS.get(ingredient.name)
    if seasons is None:
        return None
    return month in seasons
