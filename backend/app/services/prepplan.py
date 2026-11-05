from __future__ import annotations

import math
from datetime import date, timedelta

from sqlalchemy.orm import Session

from ..models import Event
from .plan import compute_plan
from .finance import event_finance
from .nutrition import NUTRIENT_KEYS

DAY_HOURS = 8  # workable prep hours per day
MAX_DAY_RANGE = 5


def prep_plan(db: Session, event: Event) -> dict:
    """Generate an automatic prep schedule for an event."""
    tasks = []
    total_min = 0
    for item in event.menu_items:
        r = item.recipe
        if r is None or not r.prep_time_min:
            continue
        off = max(1, math.ceil((r.prep_time_min or 0) / 60.0))
        tasks.append({
            "title": f"הכנה: {r.name}",
            "recipe_name": r.name,
            "prep_min": r.prep_time_min,
            "due_offset_hours": off,
        })
        total_min += r.prep_time_min

    max_off = max([t["due_offset_hours"] for t in tasks], default=1)
    day_count = min(MAX_DAY_RANGE, max(1, math.ceil(max_off / DAY_HOURS)))

    recommended_start = None
    try:
        ev_date = date.fromisoformat(event.date)
        recommended_start = (ev_date - timedelta(days=day_count - 1)).isoformat()
    except (ValueError, TypeError):
        pass

    buckets: list[dict] = []
    for i in range(day_count, 0, -1):
        # day i counts up to i*DAY_HOURS before the event
        buckets.append({
            "day": i,
            "label": f"יום {i} לפני האירוע",
            "tasks": [],
            "hours": 0.0,
        })

    for t in tasks:
        # which bucket (in reverse, day 1 = closest)
        idx = max(0, math.ceil(t["due_offset_hours"] / DAY_HOURS) - 1)
        idx = min(len(buckets) - 1, idx)
        buckets[len(buckets) - 1 - idx]["tasks"].append(t)

    for b in buckets:
        b["hours"] = round(sum(t["prep_min"] for t in b["tasks"]) / 60.0, 1)

    return {
        "event_id": event.id,
        "total_min": total_min,
        "total_hours": round(total_min / 60.0, 1),
        "max_due_offset_hours": max_off,
        "recommended_start_date": recommended_start,
        "days": [b for b in buckets if b["tasks"]],
        "tasks": tasks,
    }


def event_readiness(db: Session, event: Event) -> dict:
    finance = event_finance(db, event)
    plan = compute_plan(db, event)
    prep = prep_plan(db, event)

    shopping = plan.get("shopping_list", [])
    missing_prices = [l["name"] for l in shopping if not l.get("cost_ok")]
    return {
        "event_id": event.id,
        "name": event.name,
        "date": event.date,
        "status": event.status,
        "finance": finance,
        "menu_count": len(event.menu_items),
        "shopping_lines": len(shopping),
        "shopping_cost": round(sum(l.get("cost") or 0 for l in shopping), 2),
        "missing_prices": missing_prices,
        "prep": prep,
        "allergen_warnings": sum(
            len(seg.get("flagged_items", [])) for seg in plan.get("allergen_report", [])
        ),
        "nutrition_calories": plan.get("nutrition", {}).get("totals", {}).get("calories", 0),
    }
