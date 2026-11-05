from __future__ import annotations

import re

from .units import (
    VOLUME_TO_ML, WEIGHT_TO_G, COUNT_UNITS,
)

NUM_RE = re.compile(r"^(\d+(?:\.\d+)?|\d+/\d+|\d+\s+\d+/\d+)$")
UNIT_TOKENS = set(VOLUME_TO_ML) | set(WEIGHT_TO_G) | set(COUNT_UNITS)

ALL_UNIT_KEYS = set(VOLUME_TO_ML) | set(WEIGHT_TO_G) | set(COUNT_UNITS)


def normalize_unit_token(token: str) -> str | None:
    """Return a canonical unit key, tolerating common plurals."""
    t = token.strip().lower()
    if t in ALL_UNIT_KEYS:
        return t
    if t.endswith("s") and t[:-1] in ALL_UNIT_KEYS:
        return t[:-1]
    return None


def parse_quantity(text: str) -> float | None:
    text = text.strip()
    if text == "":
        return None
    if "/" in text and " " in text:
        # mixed number "1 1/2"
        whole, frac = text.split(" ", 1)
        try:
            n, d = frac.split("/")
            return float(whole) + float(n) / float(d)
        except ValueError:
            return None
    if "/" in text:
        try:
            n, d = text.split("/")
            return float(n) / float(d)
        except ValueError:
            return None
    try:
        return float(text)
    except ValueError:
        return None


def parse_ingredient_line(line: str) -> dict:
    """Parse one ingredient line. Returns dict with keys:
    raw, quantity, unit, ingredient, ok, error.
    """
    stripped = line.strip()
    if not stripped:
        return {"raw": line, "ok": False, "error": "empty line"}

    tokens = stripped.split()

    # Leading quantity.
    if not NUM_RE.match(tokens[0]):
        return {"raw": line, "ok": False, "error": "no leading quantity",
                "ingredient": stripped}

    quantity = parse_quantity(tokens[0])
    i = 1

    # Optional second quantity token for mixed numbers.
    if i < len(tokens) and re.match(r"^\d+/\d+$", tokens[i]):
        # e.g. "1 1/2 cups"
        extra = parse_quantity(tokens[i])
        if extra is not None:
            quantity = (quantity or 0) + extra
        i += 1

    # Optional unit token. Volume/weight units are consumed as units; count nouns
    # (egg, slice, package) are treated as the ingredient name instead.
    unit = None
    if i < len(tokens):
        norm = normalize_unit_token(tokens[i])
        if norm is not None and norm not in COUNT_UNITS:
            unit = norm
            i += 1

    ingredient = " ".join(tokens[i:]) if i < len(tokens) else ""
    if not ingredient:
        return {"raw": line, "ok": False, "error": "no ingredient name",
                "quantity": quantity, "unit": unit}

    return {
        "raw": line,
        "ok": True,
        "quantity": quantity,
        "unit": unit,
        "ingredient": ingredient,
    }


def parse_recipe_text(text: str) -> dict:
    """Parse pasted recipe text into a name (heuristic) and structured ingredient lines."""
    lines = [ln for ln in text.splitlines() if ln.strip()]
    result = {"name": "", "ingredients": []}
    if not lines:
        return result

    # Heuristic: the first line that isn't a parseable ingredient line is likely the title.
    first = parse_ingredient_line(lines[0])
    if first["ok"]:
        result["name"] = ""
        result["ingredients"] = [first]
        rest = lines[1:]
    else:
        result["name"] = lines[0].strip()
        rest = lines[1:]

    for ln in rest:
        parsed = parse_ingredient_line(ln)
        if parsed.get("ok") and parsed.get("ingredient"):
            result["ingredients"].append(parsed)
        else:
            # Keep unparsed lines for manual review.
            result["ingredients"].append(parsed)

    return result
