from __future__ import annotations

from sqlalchemy.orm import Session

from ..models import Ingredient, Recipe, RecipeIngredient, Nutrition
from ..scaling import multiplier
from ..units import to_base

NUTRIENT_KEYS = ["calories", "protein_g", "carbs_g", "fat_g", "sodium_mg", "sugar_g"]

_NUTRITION_MAP = {
    "calories": "calories",
    "protein_g": "protein_g",
    "carbs_g": "carbs_g",
    "fat_g": "fat_g",
    "sodium_mg": "sodium_mg",
    "sugar_g": "sugar_g",
}


def empty_nutrition() -> dict:
    return {k: 0.0 for k in NUTRIENT_KEYS}


def get_nutrition(ingredient: Ingredient) -> Nutrition | None:
    return ingredient.nutrition


def ingredient_per_100(ingredient: Ingredient) -> dict | None:
    n = get_nutrition(ingredient)
    if n is None:
        return None
    return {
        "calories": n.calories,
        "protein_g": n.protein_g,
        "carbs_g": n.carbs_g,
        "fat_g": n.fat_g,
        "sodium_mg": n.sodium_mg,
        "sugar_g": n.sugar_g,
        "reference_unit": n.reference_unit,
    }


def nutrition_for_quantity(ingredient: Ingredient, quantity: float, unit: str | None) -> dict:
    """Nutritional contribution for a line quantity of an ingredient."""
    result = empty_nutrition()
    per100 = ingredient_per_100(ingredient)
    if per100 is None:
        return result

    base, dim = to_base(quantity, unit)
    if base is None or dim is None:
        return result

    ref_dim = "weight" if per100["reference_unit"] == "100g" else "volume"
    scale = base
    if dim != ref_dim:
        if ingredient.density:
            scale = base * ingredient.density if ref_dim == "weight" else base / ingredient.density
        else:
            return result  # cannot bridge dimensions without density
    factor = scale / 100.0
    for key in NUTRIENT_KEYS:
        result[key] = round(per100[key] * factor, 2)
    return result


def recipe_nutrition(db: Session, recipe: Recipe, factor: float) -> dict:
    """Aggregate nutrition for a recipe scaled by `factor` (multiplier)."""
    total = empty_nutrition()
    missing = []
    for ri in recipe.ingredients:
        ingredient = ri.ingredient
        if ingredient is None:
            continue
        contrib = nutrition_for_quantity(ingredient, ri.quantity * factor, ri.unit)
        for key in NUTRIENT_KEYS:
            total[key] += contrib[key]
        if get_nutrition(ingredient) is None:
            missing.append(ingredient.name)
    for key in NUTRIENT_KEYS:
        total[key] = round(total[key], 2)
    return {**total, "missing_nutrition": sorted(set(missing))}


def event_nutrition(db: Session, event) -> dict:
    """Aggregate nutrition across all menu items (per-portion and totals)."""
    totals = empty_nutrition()
    total_portions = 0
    per_dish = []
    missing = set()
    for item in event.menu_items:
        recipe = item.recipe
        if recipe is None:
            continue
        seg_count = item.segment.guest_count if item.segment else None
        try:
            factor = multiplier(
                event.total_guests, seg_count, item.portions_per_guest,
                recipe.scaling_model, recipe.base_servings, recipe.people_per_batch,
            )
        except ValueError:
            continue
        nut = recipe_nutrition(db, recipe, factor)
        portions = _portions(event, seg_count, item.portions_per_guest)
        total_portions += portions
        for key in NUTRIENT_KEYS:
            totals[key] += nut[key]
        missing.update(nut.get("missing_nutrition", []))
        per_dish.append({
            "recipe_id": recipe.id,
            "recipe_name": recipe.name,
            "portions": portions,
            "nutrition": {k: nut[k] for k in NUTRIENT_KEYS},
        })
    for key in NUTRIENT_KEYS:
        totals[key] = round(totals[key], 2)
    per_portion = {k: (round(totals[k] / total_portions, 2) if total_portions else 0.0)
                   for k in NUTRIENT_KEYS}
    return {
        "totals": totals,
        "per_portion": per_portion,
        "per_dish": per_dish,
        "missing_nutrition": sorted(missing),
    }


def _portions(event, seg_count, portions_per_guest) -> int:
    from ..scaling import total_portions
    return total_portions(event.total_guests, seg_count, portions_per_guest)
