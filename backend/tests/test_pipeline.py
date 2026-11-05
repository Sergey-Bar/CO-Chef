import pytest

from app.models import Event, Payment
from app.services.pipeline import can_transition, apply_side_effects, event_balance


@pytest.mark.parametrize("current,target,expected", [
    ("confirmed", "confirmed", True),
    ("confirmed", "production", True),
    ("confirmed", "completed", False),
    ("confirmed", "invoiced", False),
    ("confirmed", "paid", False),
    ("production", "completed", True),
    ("production", "confirmed", False),
    ("production", "invoiced", False),
    ("completed", "invoiced", True),
    ("completed", "paid", False),
    ("invoiced", "paid", True),
    ("invoiced", "completed", False),
    ("paid", "archived", True),
    ("paid", "confirmed", False),
    ("confirmed", "archived", True),
    ("archived", "archived", True),
    ("archived", "confirmed", False),
    ("archived", "paid", False),
])
def test_can_transition_enforces_order(current, target, expected):
    assert can_transition(current, target) is expected


def test_apply_side_effects_invoiced_requires_price(db_session):
    event = Event(name="E", date="2030-01-01", total_guests=1, agreed_price=0)
    db_session.add(event)
    db_session.flush()
    assert apply_side_effects(db_session, event, "invoiced") is not None


def test_apply_side_effects_paid_full_balance(db_session):
    event = Event(name="E", date="2030-01-01", total_guests=1, agreed_price=100)
    db_session.add(event)
    db_session.flush()
    db_session.add(Payment(event_id=event.id, amount=100, date="2030-01-01"))
    db_session.flush()
    assert apply_side_effects(db_session, event, "paid") is None
    assert event.deposit_paid == 0


def test_apply_side_effects_paid_rejects_open_balance(db_session):
    event = Event(name="E", date="2030-01-01", total_guests=1, agreed_price=100)
    db_session.add(event)
    db_session.flush()
    db_session.add(Payment(event_id=event.id, amount=40, date="2030-01-01"))
    db_session.flush()
    assert apply_side_effects(db_session, event, "paid") is not None


def test_event_balance_uses_payments(db_session):
    event = Event(name="E", date="2030-01-01", total_guests=1, agreed_price=300)
    db_session.add(event)
    db_session.flush()
    db_session.add(Payment(event_id=event.id, amount=120, date="2030-01-01"))
    db_session.flush()
    assert event_balance(event) == 180
