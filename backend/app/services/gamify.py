from __future__ import annotations

from collections import Counter

from sqlalchemy.orm import Session

from ..models import Event, Client

def profile_summary(db: Session) -> dict:
    """Compatibility endpoint with factual business indicators only.

    Older versions exposed invented XP and levels here. Keeping the endpoint
    avoids breaking saved clients while returning metrics with direct meaning.
    """
    events = db.query(Event).all()
    clients = db.query(Client).all()
    paid = [e for e in events if e.status == "paid"]
    completed = [e for e in events if e.status in ("completed", "invoiced", "paid")]
    revenue = sum(e.agreed_price or 0.0 for e in events)

    client_events = Counter(e.client_id for e in events if e.client_id)
    repeat_clients = sum(count >= 2 for count in client_events.values())
    months_active = len({e.date[:7] for e in events if e.date})

    return {
        "stats": {
            "jobs": len(events),
            "completed": len(completed),
            "paid": len(paid),
            "clients": len(clients),
            "repeat_clients": repeat_clients,
            "months_active": months_active,
            "revenue": round(revenue, 2),
        },
    }
