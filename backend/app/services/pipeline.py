from __future__ import annotations

from sqlalchemy.orm import Session

from ..models import Event

STATUS_ORDER = ["confirmed", "production", "completed", "invoiced", "paid"]

ALLOWED_TRANSITIONS = {
    "confirmed": {"production", "archived"},
    "production": {"completed", "archived"},
    "completed": {"invoiced", "archived"},
    "invoiced": {"paid", "archived"},
    "paid": {"archived"},
    "archived": set(),
}


def can_transition(current: str, target: str) -> bool:
    if target == current:
        return True
    return target in ALLOWED_TRANSITIONS.get(current, set())


def event_balance(event: Event) -> float:
    paid = sum(p.amount for p in event.payments)
    return max(0.0, (event.agreed_price or 0.0) - paid)


def apply_side_effects(db: Session, event: Event, target: str) -> str | None:
    """Return an error message if the transition is invalid, else None."""
    if target == "invoiced" and not (event.agreed_price or 0.0) > 0:
        return "לא ניתן לסמן חשבונית ללא מחיר מוסכם (agreed_price)"
    if target == "paid" and event_balance(event) > 0:
        return "קיימת יתרה פתוחה — הוסיפו תשלום קודם"
    if target == "paid":
        event.deposit_paid = event_balance(event)
    return None


def sync_status_from_payments(db: Session, event: Event) -> None:
    """Auto-advance to 'paid' once fully paid while invoiced/completed."""
    if event.status in ("invoiced", "completed") and event_balance(event) <= 0:
        event.status = "paid"
        db.commit()
