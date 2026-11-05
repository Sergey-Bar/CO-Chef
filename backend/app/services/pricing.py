from sqlalchemy.orm import Session
from ..models import Ingredient, PriceBook
from ..units import convert_quantity


def effective_unit_cost(db: Session, ingredient_id: int, event_date: str) -> float | None:
    ing = db.get(Ingredient, ingredient_id)
    if ing is None:
        return None
    rows = db.query(PriceBook).filter(PriceBook.ingredient_id == ingredient_id).all()
    valid = [r for r in rows if r.effective_date <= event_date]
    if valid:
        latest = max(valid, key=lambda r: (r.effective_date, r.id))
        converted = convert_quantity(1, ing.default_unit, latest.unit or ing.default_unit, ing.density)
        return converted.value * latest.price_per_unit if converted.ok else None
    return ing.cost_per_unit if ing else None

