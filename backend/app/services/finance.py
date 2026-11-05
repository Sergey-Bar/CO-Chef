from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from ..models import Event, Lead
from .plan import compute_plan
from .pipeline import event_balance
from .pricing import effective_unit_cost

ACTIVE_STATUSES = ["confirmed", "production", "completed", "invoiced", "paid"]


def event_finance(db: Session, event: Event) -> dict:
    plan = compute_plan(db, event)
    cogs = plan["costs"]["ingredient_subtotal"]
    missing_price = sum(not line["cost_ok"] for line in plan["shopping_list"])
    other = event.other_costs or 0.0
    tax = plan["costs"]["tax"]
    total_cost = plan["costs"]["total"]
    revenue = event.agreed_price or 0.0
    net = revenue - total_cost
    balance = event_balance(event) if event.status != "archived" else 0.0
    margin = (net / revenue * 100.0) if revenue else None
    return {
        "event_id": event.id,
        "status": event.status,
        "revenue": round(revenue, 2),
        "cogs": round(cogs, 2),
        "other_costs": round(other, 2),
        "tax": round(tax, 2),
        "total_cost": round(total_cost, 2),
        "net": round(net, 2),
        "margin": round(margin, 1) if margin is not None else None,
        "balance": round(balance, 2),
        "missing_price_lines": missing_price,
        "estimate_complete": missing_price == 0 and bool(plan["shopping_list"]),
    }


def _shift_month(year: int, month: int, delta: int) -> tuple[int, int]:
    m = month + delta
    while m < 1:
        m += 12
        year -= 1
    while m > 12:
        m -= 12
        year += 1
    return year, m


def _period_start(period: str) -> date | None:
    today = date.today()
    if period == "month":
        return date(today.year, today.month, 1)
    if period == "quarter":
        return date(today.year, ((today.month - 1) // 3) * 3 + 1, 1)
    if period == "year":
        return date(today.year, 1, 1)
    return None


def _in_period(event_date: str, period: str) -> bool:
    if period == "all" or not event_date:
        return True
    try:
        d = date.fromisoformat(event_date)
    except ValueError:
        return False
    start = _period_start(period)
    if start is None:
        return True
    months = {"month": 1, "quarter": 3, "year": 12}[period]
    y, m = _shift_month(start.year, start.month, months)
    return start <= d < date(y, m, 1)


def finance_summary(db: Session, period: str = "all", currency: str = "ILS") -> dict:
    events = [e for e in db.query(Event).all()
              if e.status in ACTIVE_STATUSES and e.currency == currency and _in_period(e.date, period)]
    finance_per_event = [event_finance(db, e) for e in events]

    revenue = sum(f["revenue"] for f in finance_per_event)
    cogs = sum(f["cogs"] for f in finance_per_event)
    other = sum(f["other_costs"] for f in finance_per_event)
    tax = sum(f["tax"] for f in finance_per_event)
    total_cost = sum(f["total_cost"] for f in finance_per_event)
    net = revenue - total_cost
    margin = (net / revenue * 100.0) if revenue else None
    receivables = sum(f["balance"] for f in finance_per_event)
    # Payments are the source of truth; deposit_paid is a legacy summary field.
    collected = sum(p.amount for e in events for p in e.payments)

    # Pipeline value: open quotes (sent/accepted) not yet converted to a job.
    pipeline_value = sum(l.amount or 0.0 for l in db.query(Lead).all()
                        if l.kind == "quote" and l.status in ("sent", "accepted")
                        and l.converted_event_id is None)

    series = monthly_series(db, events, {f["event_id"]: f for f in finance_per_event})
    return {
        "currency": currency,
        "completed_net": round(sum(f["net"] for f in finance_per_event if f["estimate_complete"] and f["status"] in ("completed", "invoiced", "paid")), 2),
        "projected_net": round(sum(f["net"] for f in finance_per_event if f["estimate_complete"] and f["status"] in ("confirmed", "production")), 2),
        "incomplete_estimates": sum(not f["estimate_complete"] for f in finance_per_event),
        "period": period,
        "revenue": round(revenue, 2),
        "cogs": round(cogs, 2),
        "other_costs": round(other, 2),
        "tax": round(tax, 2),
        "total_cost": round(total_cost, 2),
        "net": round(net, 2),
        "margin": round(margin, 1) if margin is not None else None,
        "receivables": round(receivables, 2),
        "collected": round(collected, 2),
        "pipeline_value": round(pipeline_value, 2),
        "jobs_count": len(events),
        "monthly": series,
        "by_event": finance_per_event,
    }


def monthly_series(db: Session, events: list[Event], finances: dict | None = None) -> list[dict]:
    by_month: dict[str, dict] = {}
    for e in events:
        key = e.date[:7] if e.date else "?"
        ent = by_month.setdefault(key, {"month": key, "revenue": 0.0, "cost": 0.0})
        f = finances[e.id] if finances is not None else event_finance(db, e)
        ent["revenue"] += f["revenue"]
        ent["cost"] += f["total_cost"]
    return [{
        "month": k,
        "revenue": round(v["revenue"], 2),
        "cost": round(v["cost"], 2),
    } for k, v in sorted(by_month.items())]


def client_summary(db: Session, client) -> dict:
    events = [e for e in client.events if e.status in ACTIVE_STATUSES]
    revenue = sum(e.agreed_price or 0.0 for e in events)
    outstanding = sum(event_balance(e) for e in events if e.status != "archived")
    return {
        "client_id": client.id,
        "jobs_count": len(events),
        "revenue": round(revenue, 2),
        "outstanding": round(outstanding, 2),
        "last_job_date": max((e.date for e in events), default=None),
    }
