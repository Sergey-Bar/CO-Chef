from __future__ import annotations

import math

SCALING_SERVINGS = "servings"
SCALING_PER_PERSON = "per_person"
SCALING_BATCH = "batch"


def served_guests(total_guests: int, segment_guest_count: int | None = None) -> int:
    """Number of guests a menu item serves.

    If the item is assigned to a segment, it serves that segment's guest count;
    otherwise it serves the whole event.
    """
    if segment_guest_count is not None:
        return segment_guest_count
    return total_guests


def total_portions(total_guests: int, segment_guest_count: int | None,
                   portions_per_guest: int) -> int:
    return served_guests(total_guests, segment_guest_count) * portions_per_guest


def multiplier(total_guests: int,
               segment_guest_count: int | None,
               portions_per_guest: int,
               scaling_model: str,
               base_servings: int | None = None,
               people_per_batch: int | None = None) -> float:
    """Factor by which recipe ingredient quantities are scaled for one menu item."""
    portions = total_portions(total_guests, segment_guest_count, portions_per_guest)
    if scaling_model == SCALING_SERVINGS:
        if not base_servings:
            raise ValueError("servings scaling requires base_servings")
        return portions / base_servings
    if scaling_model == SCALING_PER_PERSON:
        return float(portions)
    if scaling_model == SCALING_BATCH:
        if not people_per_batch:
            raise ValueError("batch scaling requires people_per_batch")
        return float(math.ceil(portions / people_per_batch))
    raise ValueError(f"unknown scaling model: {scaling_model}")


def scale_quantity(quantity: float, factor: float) -> float:
    return quantity * factor


def apply_buffer(total: float, buffer_percent: float) -> float:
    """Apply event buffer as a planning margin."""
    return total * (1.0 + (buffer_percent or 0.0) / 100.0)


def validate_segments(total_guests: int, segments) -> list[str]:
    """Validate that segment guest counts sum to the event total.

    `segments` is an iterable of objects/dicts with a guest_count attribute/key.
    Returns a list of error messages (empty when valid).
    """
    errors: list[str] = []
    def count(s):
        return s.guest_count if hasattr(s, "guest_count") else s["guest_count"]

    if not segments:
        return errors
    total = sum(count(s) for s in segments)
    if total != total_guests:
        errors.append(
            f"Guest segments sum to {total}, but the event total is {total_guests}. "
            "The segment guest counts must add up to the event total."
        )
    return errors
