from __future__ import annotations

import math
from datetime import date
from collections import defaultdict

from sqlalchemy.orm import Session

from ..models import Event, GuestSegment, EventMenuItem, RecipeIngredient, Ingredient, PrepTask
from ..scaling import multiplier, apply_buffer
from ..units import convert_quantity
from ..costs import line_cost, event_cost_totals
from ..formatting import format_quantity
from .nutrition import event_nutrition
from .pricing import effective_unit_cost


def auto_update_status(db: Session, event: Event) -> Event:
    """Lazily flag past events as completed when read."""
    if event.status in ("confirmed", "production"):
        try:
            ev_date = date.fromisoformat(event.date)
            if ev_date < date.today():
                event.status = "completed"
                db.commit()
        except ValueError:
            pass
    return event


def _scale_ingredient(ing: RecipeIngredient, factor: float):
    return ing.quantity * factor


def _aggregate_ingredients(db: Session, event: Event) -> dict:
    """Aggregate scaled ingredient quantities across all menu items (before buffer).

    Aggregation is done in each ingredient's canonical (default) unit. Returns
    dict keyed by ingredient_id with entries:
      {ingredient, qty (float in default unit), flags, menu_items}
    """
    acc: dict[int, dict] = {}

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

        for ing in recipe.ingredients:
            scaled = _scale_ingredient(ing, factor)
            ingredient: Ingredient = ing.ingredient
            if ingredient is None:
                continue

            entry = acc.get(ingredient.id)
            if entry is None:
                entry = {
                    "ingredient": ingredient,
                    "qty": 0.0,
                    "flags": [],
                    "menu_items": [],
                }
                acc[ingredient.id] = entry

            # Convert to canonical default unit for aggregation.
            if ingredient.default_unit:
                res = convert_quantity(scaled, ing.unit, ingredient.default_unit, ingredient.density)
                if res.ok:
                    entry["qty"] += res.value
                else:
                    entry["flags"].append(f"{recipe.name}: {res.error}")
                    # Still track raw scaled quantity as fallback.
                    entry["qty"] += scaled
            else:
                entry["flags"].append(f"{recipe.name}: no purchasing unit for ingredient")
                entry["qty"] += scaled

            entry["menu_items"].append(recipe.name)

    return acc


def compute_prep_suggestions(db: Session, event: Event) -> list[dict]:
    suggestions = []
    for item in event.menu_items:
        recipe = item.recipe
        if recipe is None or not recipe.prep_time_min:
            continue
        hours = max(1, math.ceil(recipe.prep_time_min / 60.0))
        suggestions.append({
            "title": f"Prep: {recipe.name}",
            "description": f"Automatic prep task for {recipe.name} "
                           f"({recipe.prep_time_min} min).",
            "due_offset_hours": hours,
            "prep_min": recipe.prep_time_min,
        })
    return suggestions


def compute_plan(db: Session, event: Event) -> dict:
    aggregated = _aggregate_ingredients(db, event)
    buffer_percent = event.buffer_percent or 0.0

    shopping = []
    ingredient_subtotal = 0.0
    for ing_id, entry in aggregated.items():
        ingredient: Ingredient = entry["ingredient"]
        qty_before = entry["qty"]
        qty_after = apply_buffer(qty_before, buffer_percent)

        # Budget for the full purchasing quantity, including contingency buffer.
        cost, cost_ok, cost_error = None, True, None
        if ingredient.default_unit:
            cost, cost_ok, cost_error = line_cost(
                qty_after, ingredient.default_unit, ingredient.default_unit,
                effective_unit_cost(db, ingredient.id, event.date), ingredient.density,
            )
        if ingredient.currency != event.currency:
            entry["flags"].append("Ingredient currency does not match event currency")
        if not ingredient.default_unit:
            cost_ok = False
        if not cost_ok:
            entry["flags"].append(cost_error or "cost unavailable")
        if entry["flags"]:
            cost, cost_ok = None, False

        display = format_quantity(qty_after, ingredient.default_unit)

        shopping.append({
            "ingredient_id": ingredient.id,
            "name": ingredient.name,
            "category": ingredient.category,
            "unit": ingredient.default_unit,
            "qty_before_buffer": round(qty_before, 4),
            "qty_after_buffer": round(qty_after, 4),
            "display": display,
            "flags": entry["flags"],
            "menu_items": sorted(set(entry["menu_items"])),
            "cost": round(cost, 2) if cost_ok and cost is not None else None,
            "cost_ok": cost_ok,
        })
        if cost_ok and cost is not None:
            ingredient_subtotal += cost

    shopping.sort(key=lambda s: (s["category"] or "", s["name"]))

    costs = event_cost_totals(ingredient_subtotal, event.other_costs or 0.0,
                              event.tax_percent or 0.0)

    # Allergen report: per segment, menu items whose recipe allergens intersect restrictions.
    allergen_report = []
    for seg in event.segments:
        restrictions = set(seg.restrictions or [])
        flagged = []
        for item in event.menu_items:
            if item.segment_id is not None and item.segment_id != seg.id:
                continue
            recipe = item.recipe
            if recipe is None:
                continue
            overlap = restrictions & set(recipe.allergens or [])
            if overlap:
                flagged.append({
                    "menu_item_id": item.id,
                    "recipe_id": recipe.id,
                    "recipe_name": recipe.name,
                    "allergens": sorted(overlap),
                })
        allergen_report.append({
            "segment_id": seg.id,
            "segment_name": seg.name,
            "guest_count": seg.guest_count,
            "restrictions": sorted(restrictions),
            "flagged_items": flagged,
        })

    return {
        "event_id": event.id,
        "shopping_list": shopping,
        "costs": costs,
        "allergen_report": allergen_report,
        "nutrition": event_nutrition(db, event),
        "buffer_percent": buffer_percent,
        "prep_suggestions": compute_prep_suggestions(db, event),
    }
