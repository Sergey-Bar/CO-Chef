from __future__ import annotations

from .units import convert_quantity


def line_cost(quantity: float,
              from_unit: str | None,
              ingredient_unit: str | None,
              cost_per_unit: float | None,
              density: float | None = None):
    """Cost of a single recipe ingredient line.

    Returns (cost, ok, error). Units are aligned via the conversion table; volume↔weight
    uses density. If cost_per_unit is missing (no price), the line is flagged rather than
    silently treated as free.
    """
    if cost_per_unit is None:
        return None, False, "No cost set for this ingredient"
    if not ingredient_unit:
        return None, False, "No purchasing unit set for this ingredient"
    res = convert_quantity(quantity, from_unit, ingredient_unit, density)
    if not res.ok:
        return None, False, res.error
    return res.value * cost_per_unit, True, None


def event_cost_totals(ingredient_subtotal: float,
                      other_costs: float,
                      tax_percent: float) -> dict:
    """Compute cost line items.

    tax_percent is applied to the ingredient subtotal (not to other_costs).
    """
    tax = ingredient_subtotal * (tax_percent or 0.0) / 100.0
    total = ingredient_subtotal + other_costs + tax
    return {
        "ingredient_subtotal": round(ingredient_subtotal, 2),
        "other_costs": round(other_costs, 2),
        "tax": round(tax, 2),
        "tax_percent": tax_percent or 0.0,
        "total": round(total, 2),
    }
