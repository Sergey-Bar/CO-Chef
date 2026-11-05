from __future__ import annotations

from .units import COUNT_UNITS

# Practical fraction candidates used for display (remainders only).
_FRACTIONS = [
    (1, 8, 0.125), (1, 4, 0.25), (1, 3, 0.3333), (3, 8, 0.375),
    (1, 2, 0.5), (5, 8, 0.625), (2, 3, 0.6667), (3, 4, 0.75),
    (7, 8, 0.875),
]


def fraction_str(value: float) -> str:
    """Format a positive number using practical fractions (1/8…7/8) and whole parts."""
    if value < 0:
        return "-" + fraction_str(-value)
    if value == 0:
        return "0"

    whole = int(value)
    remainder = value - whole

    if remainder < 0.03:
        return str(whole)
    if remainder > 0.97:
        return str(whole + 1)

    best = None
    best_diff = None
    for num, denom, dec in _FRACTIONS:
        diff = abs(remainder - dec)
        if best_diff is None or diff < best_diff:
            best_diff = diff
            best = (num, denom)

    num, denom = best
    if whole == 0:
        return f"{num}/{denom}"
    return f"{whole} {num}/{denom}"


def is_count_like(unit: str | None) -> bool:
    if not unit:
        return False
    return unit.strip().lower() in COUNT_UNITS


def format_quantity(value: float, unit: str | None = None) -> dict:
    """Return a display-friendly representation of a quantity.

    Returns {"text": str, "rounded_up": bool}. Whole-count items are rounded up and
    flagged; volumes/weights use practical fractions.
    """
    rounded_up = False
    if is_count_like(unit):
        import math
        rounded = math.ceil(value - 1e-9)
        if rounded > value + 1e-9:
            rounded_up = True
        text = str(rounded)
    else:
        text = fraction_str(value)

    result = {"text": text, "rounded_up": rounded_up}
    if unit:
        result["unit"] = unit
    return result
