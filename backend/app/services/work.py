from __future__ import annotations

from datetime import date, timedelta
from collections import defaultdict

from sqlalchemy.orm import Session

from ..models import Event, Lead
from .pipeline import STATUS_ORDER
from .pipeline import event_balance
from .finance import effective_unit_cost


def event_prep_hours(event: Event) -> float:
    total_min = 0
    seen = set()
    for item in event.menu_items:
        r = item.recipe
        if r is None or r.id in seen:
            continue
        seen.add(r.id)
        total_min += r.prep_time_min or 0
    return round(total_min / 60.0, 1)


def work_summary(db: Session) -> dict:
    events = db.query(Event).all()
    active = [e for e in events if e.status != "archived"]

    counts = {s: 0 for s in STATUS_ORDER}
    for e in active:
        counts[e.status] = counts.get(e.status, 0) + 1

    today = date.today()
    upcoming = [e for e in active if e.status in ("confirmed", "production")
                and e.date and e.date >= today.isoformat()]
    upcoming.sort(key=lambda e: e.date)

    # 14-day prep load
    load = []
    load_map: dict[str, dict] = {}
    for e in upcoming:
        d = e.date
        ent = load_map.setdefault(d, {"date": d, "jobs": 0, "prep_hours": 0.0})
        ent["jobs"] += 1
        ent["prep_hours"] += event_prep_hours(e)
    for i in range(14):
        d = today + timedelta(days=i)
        key = d.isoformat()
        if key in load_map:
            ent = load_map[key]
            load.append({"date": key, "jobs": ent["jobs"],
                         "prep_hours": round(ent["prep_hours"], 1)})
        else:
            load.append({"date": key, "jobs": 0, "prep_hours": 0.0})

    # Actions
    open_quotes = [l for l in db.query(Lead).all()
                   if l.kind == "quote" and l.status in ("sent", "accepted")]
    new_leads = [l for l in db.query(Lead).all()
                 if l.kind == "lead" and l.status in ("new", "contacted")]
    unpaid = [e for e in events if e.status == "invoiced" and event_balance(e) > 0]
    unpaid_sum = round(sum(event_balance(e) for e in unpaid), 2)

    next_event = None
    if upcoming:
        first = upcoming[0]
        next_event = {
            "event_id": first.id,
            "name": first.name,
            "date": first.date,
            "client_name": first.client.name if first.client else None,
            "guests": first.total_guests,
            "prep_hours": event_prep_hours(first),
            "status": first.status,
        }

    return {
        "pipeline_counts": counts,
        "next_event": next_event,
        "workload": load,
        "upcoming_events": [
            {"event_id": e.id, "name": e.name, "date": e.date,
             "client_name": e.client.name if e.client else None,
             "guests": e.total_guests, "status": e.status,
             "prep_hours": event_prep_hours(e)}
            for e in upcoming],
        "actions": {
            "open_quotes": {"count": len(open_quotes),
                            "value": round(sum(l.amount or 0.0 for l in open_quotes), 2)},
            "new_leads": {"count": len(new_leads)},
            "unpaid_invoices": {"count": len(unpaid), "total": unpaid_sum},
        },
    }
