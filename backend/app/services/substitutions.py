from __future__ import annotations

from sqlalchemy.orm import Session

from ..models import Ingredient

# Curated fallback substitution groups (name -> candidate names) used when an
# ingredient has no explicit `substitution_group`.
SUBSTITUTION_GROUPS: dict[str, list[str]] = {
    "butter": ["Unsalted butter", "Vegetable oil", "Olive oil"],
    "vegetable oil": ["Olive oil", "Peanut oil", "Canola oil"],
    "heavy cream": ["Milk", "Sour cream", "Plain yogurt"],
    "milk": ["Heavy cream", "Plain yogurt"],
    "parmesan": ["Cheddar cheese", "Mozzarella"],
    "mozzarella": ["Cheddar cheese", "Parmesan"],
    "cheddar": ["Mozzarella", "Parmesan"],
    "white rice": ["Jasmine rice", "Basmati rice", "Sushi rice"],
    "jasmine rice": ["White rice", "Basmati rice"],
    "basmati rice": ["White rice", "Jasmine rice"],
    "pasta": ["Rice noodles", "Couscous"],
    "onion": ["Scallions", "Shallots"],
    "garlic": ["Garlic powder", "Scallions"],
    "lemon": ["Limes"],
    "chicken breast": ["Chicken thighs"],
    "chicken thighs": ["Chicken breast"],
    "ground beef": ["Ground lamb", "Beef stew meat"],
    "celery": ["Carrots"],
    "tomato sauce": ["Diced tomatoes", "Tomato paste"],
    "soy sauce": ["Fish sauce"],
}


def _sub_ingredients(db: Session, contributor: Ingredient) -> list[Ingredient]:
    """Candidates drawn from the same explicit group."""
    if not contributor.substitution_group:
        return []
    return (db.query(Ingredient)
            .filter(Ingredient.substitution_group == contributor.substitution_group,
                    Ingredient.id != contributor.id)
            .all())


def _fallback_candidates(contributor: Ingredient) -> list[Ingredient | None]:
    key = (contributor.name or "").strip().lower()
    group = SUBSTITUTION_GROUPS.get(key)
    if group:
        return group  # names; resolved below
    # Category-level heuristic for produce.
    return []


def get_substitutions(db: Session, ingredient: Ingredient) -> list[dict]:
    """Suggest substitutes for a missing ingredient."""
    suggestions: list[dict] = []

    for cand in _sub_ingredients(db, ingredient):
        suggestions.append({
            "ingredient_id": cand.id,
            "name": cand.name,
            "reason": "אותה קבוצת תחליף",
            "group": True,
        })

    # Curated fallback.
    names = _fallback_candidates(ingredient)
    name_set = {s["name"] for s in suggestions}
    for nm in names:
        cand = db.query(Ingredient).filter(Ingredient.name == nm).first()
        if cand is None or cand.id == ingredient.id or cand.name in name_set:
            continue
        name_set.add(cand.name)
        suggestions.append({
            "ingredient_id": cand.id,
            "name": cand.name,
            "reason": "החלפה מוצעת",
            "group": False,
        })

    return suggestions


def substitution_suggestions_for_db(db: Session) -> list[dict]:
    """Suggest a substitute for every ingredient that has a known alternative."""
    out = []
    for ing in db.query(Ingredient).all():
        subs = get_substitutions(db, ing)
        if subs:
            out.append({"ingredient_id": ing.id, "name": ing.name, "substitutions": subs})
    return out
