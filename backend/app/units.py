from __future__ import annotations

# Same-dimension conversion factors to base units.
# Volume base: mL; Weight base: g; Count base: item.
VOLUME_TO_ML = {
    "tsp": 4.92892,
    "tbsp": 14.7868,
    "cup": 236.588,
    "fl oz": 29.5735,
    "floz": 29.5735,
    "oz (fluid)": 29.5735,
    "ml": 1.0,
    "milliliter": 1.0,
    "milliliters": 1.0,
    "l": 1000.0,
    "liter": 1000.0,
    "liters": 1000.0,
    "litre": 1000.0,
}

WEIGHT_TO_G = {
    "g": 1.0,
    "gram": 1.0,
    "grams": 1.0,
    "kg": 1000.0,
    "kilogram": 1000.0,
    "kilograms": 1000.0,
    "oz": 28.3495,
    "ounce": 28.3495,
    "ounces": 28.3495,
    "lb": 453.592,
    "lbs": 453.592,
    "pound": 453.592,
    "pounds": 453.592,
}

COUNT_UNITS = {"item", "items", "each", "whole", "egg", "eggs", "package", "packages", "pack",
               "can", "cans", "clove", "cloves", "slice", "slices", "piece", "pieces"}

# Canonical purchasing-unit categories for display.
CANONICAL_UNITS = {
    "volume": "cup",
    "weight": "g",
    "count": "each",
}


class ConversionResult:
    __slots__ = ("value", "unit", "ok", "error", "needs_density")

    def __init__(self, value, unit, ok=True, error=None, needs_density=False):
        self.value = value
        self.unit = unit
        self.ok = ok
        self.error = error
        self.needs_density = needs_density

    def __repr__(self):
        return f"ConversionResult({self.value}, {self.unit}, ok={self.ok}, err={self.error})"


def _dimension(unit: str) -> str | None:
    if unit is None:
        return None
    key = unit.strip().lower()
    if key in VOLUME_TO_ML:
        return "volume"
    if key in WEIGHT_TO_G:
        return "weight"
    if key in COUNT_UNITS:
        return "count"
    return None


def to_base(quantity: float, unit: str | None):
    """Convert to base unit (mL / g / item). Returns (value, dimension) or (None, None)."""
    dim = _dimension(unit)
    if dim is None:
        return None, None
    key = unit.strip().lower()
    if dim == "volume":
        return quantity * VOLUME_TO_ML[key], "volume"
    if dim == "weight":
        return quantity * WEIGHT_TO_G[key], "weight"
    return quantity, "count"


def convert_quantity(quantity: float, from_unit: str | None, to_unit: str | None,
                     density: float | None = None) -> ConversionResult:
    """Convert quantity expressed in from_unit to to_unit.

    Returns a ConversionResult. Cross-dimension (volume<->weight) conversion requires
    `density` (grams per 1 mL). If a conversion cannot be made the result is flagged.
    """
    # Simplification: identical units (case-insensitive) convert trivially.
    if from_unit and to_unit and from_unit.strip().lower() == to_unit.strip().lower():
        return ConversionResult(quantity, to_unit)

    base, dim = to_base(quantity, from_unit)
    if base is None or dim is None:
        return ConversionResult(quantity, from_unit, ok=False,
                                error=f'Unknown unit "{from_unit}"')

    to_dim = _dimension(to_unit)
    if to_dim is None:
        return ConversionResult(quantity, from_unit, ok=False,
                                error=f'Unknown unit "{to_unit}"')

    if dim == to_dim:
        # Same dimension: convert base -> to_unit.
        if dim == "volume":
            factor = VOLUME_TO_ML[to_unit.strip().lower()]
        elif dim == "weight":
            factor = WEIGHT_TO_G[to_unit.strip().lower()]
        else:
            return ConversionResult(quantity, to_unit)
        return ConversionResult(base / factor, to_unit)

    # Cross-dimension: require density.
    if density is None:
        return ConversionResult(quantity, from_unit, ok=False,
                                error="Missing density for volume↔weight conversion",
                                needs_density=True)
    if dim == "volume" and to_dim == "weight":
        grams = base * density
        factor = WEIGHT_TO_G[to_unit.strip().lower()]
        return ConversionResult(grams / factor, to_unit)
    if dim == "weight" and to_dim == "volume":
        ml = base / density
        factor = VOLUME_TO_ML[to_unit.strip().lower()]
        return ConversionResult(ml / factor, to_unit)
    return ConversionResult(quantity, from_unit, ok=False, error="Unsupported conversion")
