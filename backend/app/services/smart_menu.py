from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from ..models import Event, Recipe
from ..scaling import multiplier
from ..costs import line_cost
from .seasonality import is_in_season

COURSE_PRIORITY = {
    "main": 0,
    "soup": 1,
    "appetizer": 2,
    "side": 3,
    "bread": 4,
    "dessert": 5,
    "dressing": 6,
    "other": 7,
}


def _recipe_cost(db: Session, event: Event, recipe: Recipe) -> float:
    try:
        factor = multiplier(event.total_guests, None, 1, recipe.scaling_model,
                            recipe.base_servings, recipe.people_per_batch)
    except ValueError:
        return 0.0
    total = 0.0
    for ri in recipe.ingredients:
        ing = ri.ingredient
        if ing is None:
            continue
        cost, ok, err = line_cost(ri.quantity * factor, ri.unit, ing.default_unit,
                                  ing.cost_per_unit, ing.density)
        if ok and cost is not None:
            total += cost
    return total


def _month_for_event(event: Event) -> int | None:
    try:
        return date.fromisoformat(event.date).month
    except (ValueError, TypeError):
        return None


def _restriction_overlap(event: Event, recipe: Recipe) -> list[str]:
    recipe_alg = set(recipe.allergens or [])
    reasons = []
    for seg in event.segments:
        overlap = recipe_alg & set(seg.restrictions or [])
        if overlap:
            reasons.append(f"{seg.name} (אלרגנים: {', '.join(sorted(overlap))})")
    return reasons


def _seasonality_bonus(event: Event, recipe: Recipe) -> int:
    month = _month_for_event(event)
    if month is None:
        return 0
    bonus = 0
    for ri in recipe.ingredients:
        ing = ri.ingredient
        if ing is None or ing.category != "produce":
            continue
        in_season = is_in_season(ing, month)
        if in_season:
            bonus += 2
        elif in_season is False:
            bonus -= 1
    return max(0, bonus)


def suggest_menu(db: Session, event: Event, payload: dict | None = None) -> dict:
    payload = payload or {}
    budget = payload.get("budget")
    preferred_cuisine = (payload.get("preferred_cuisine") or "").strip() or None
    course_count = int(payload.get("course_count") or 4)
    month = _month_for_event(event)

    recipes = db.query(Recipe).all()
    chosen: list[dict] = []

    chosen_cuisines: dict[str, int] = {}
    chosen_categories: dict[str, int] = {}

    def base_score(r: Recipe) -> int:
        score = 100
        reasons = []
        # Restriction fit.
        overlaps = _restriction_overlap(event, r)
        if overlaps:
            score -= 60
            reasons.append(f"התנגשות אלרגנים: {'; '.join(overlaps)}")
        # Preferred cuisine.
        if preferred_cuisine and r.cuisine == preferred_cuisine:
            score += 20
            reasons.append(f"במטבח המועדף ({preferred_cuisine})")
        # Seasonality.
        sbonus = _seasonality_bonus(event, r)
        if sbonus >= 4:
            score += sbonus
            reasons.append("מצרכים עונתיים")
        return score, reasons

    def variety_penalty(r: Recipe) -> int:
        penalty = 0
        if r.cuisine and chosen_cuisines.get(r.cuisine, 0) >= 2:
            penalty += 15
        elif r.cuisine and chosen_cuisines.get(r.cuisine, 0) >= 1:
            penalty += 8
        if r.category and chosen_categories.get(r.category, 0) >= 2:
            penalty += 10
        return penalty

    # Precompute base scores + costs.
    candidate_scores = []
    for r in recipes:
        score, reasons = base_score(r)
        cost = _recipe_cost(db, event, r)
        candidate_scores.append({"recipe": r, "score": score, "cost": cost,
                                 "reasons": reasons})

    # Sort by course priority, then score (seed selection).
    candidate_scores.sort(key=lambda x: (COURSE_PRIORITY.get(x["recipe"].category, 99),
                                         -x["score"]))

    for _ in range(course_count):
        best = None
        for cand in candidate_scores:
            r = cand["recipe"]
            if any(c["recipe_id"] == r.id for c in chosen):
                continue
            total_score = cand["score"] - variety_penalty(r)
            # Budget preference: nudge cheaper options.
            if budget is not None:
                if cand["cost"] > budget:
                    total_score -= 25
                else:
                    total_score += min(15, int(budget - cand["cost"]) // 10)
            if best is None or total_score > best[0]:
                best = (total_score, cand)
        if best is None:
            break
        _, cand = best
        r = cand["recipe"]
        reasons = list(cand["reasons"])
        if r.cuisine and chosen_cuisines.get(r.cuisine, 0) >= 1:
            reasons.append("מגוון מטבחים")
        chosen_cuisines[r.cuisine] = chosen_cuisines.get(r.cuisine, 0) + 1 if r.cuisine else 0
        if r.category:
            chosen_categories[r.category] = chosen_categories.get(r.category, 0) + 1
        chosen.append({
            "recipe_id": r.id,
            "name": r.name,
            "cuisine": r.cuisine,
            "category": r.category,
            "cost": round(cand["cost"], 2),
            "score": int(cand["score"]),
            "reasons": reasons,
        })

    total_cost = round(sum(c["cost"] for c in chosen), 2)
    return {
        "event_id": event.id,
        "currency": event.currency or "ILS",
        "suggestions": chosen,
        "total_cost": total_cost,
        "budget": budget,
        "within_budget": budget is None or total_cost <= budget,
        "month": month,
    }
