from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy.orm import Session

from ..models import Event, Lead
from .prepplan import event_readiness
from .pipeline import event_balance


SEVERITY_ORDER = {"urgent": 0, "warning": 1, "opportunity": 2, "info": 3}


def _event_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _action(
    key: str,
    severity: str,
    title: str,
    detail: str,
    label: str,
    href: str,
    *,
    event: Event | None = None,
    priority: int = 0,
) -> dict:
    return {
        "key": key,
        "severity": severity,
        "title": title,
        "detail": detail,
        "label": label,
        "href": href,
        "event_id": event.id if event else None,
        "event_name": event.name if event else None,
        "event_date": event.date if event else None,
        "priority": priority,
    }


def business_briefing(db: Session) -> dict:
    """Return an explainable, deterministic daily business briefing.

    This is deliberately rule-based: every recommendation is derived from saved
    business data and links to the exact place where the chef can resolve it.
    """
    today = date.today()
    horizon = today + timedelta(days=45)
    events = [e for e in db.query(Event).all() if e.status != "archived"]
    active = [e for e in events if e.status in ("confirmed", "production")]
    actions: list[dict] = []
    ready_count = 0

    for event in sorted(active, key=lambda e: e.date or "9999-12-31"):
        event_day = _event_date(event.date)
        if event_day and event_day < today:
            actions.append(_action(
                f"overdue-{event.id}", "urgent", f"האירוע {event.name} כבר עבר",
                "הסטטוס עדיין פעיל. עדכנו אותו כדי שהתחזיות והעומס יהיו מדויקים.",
                "עדכון האירוע", f"/events/{event.id}", event=event, priority=-100,
            ))
            continue
        if event_day and event_day > horizon:
            continue

        readiness = event_readiness(db, event)
        days = (event_day - today).days if event_day else 999
        event_issues = 0

        if readiness["menu_count"] == 0:
            severity = "urgent" if days <= 7 else "warning"
            actions.append(_action(
                f"menu-{event.id}", severity, f"לתכנן תפריט ל{event.name}",
                f"האירוע בעוד {days} ימים ועדיין אין בו מנות.",
                "בניית תפריט", f"/events/{event.id}", event=event, priority=days,
            ))
            event_issues += 1
        elif readiness["missing_prices"]:
            missing = len(readiness["missing_prices"])
            severity = "urgent" if days <= 7 else "warning"
            actions.append(_action(
                f"prices-{event.id}", severity, f"להשלים {missing} מחירים ל{event.name}",
                "אומדן הרווח אינו מלא עד שכל חומרי הגלם מתומחרים.",
                "השלמת תמחור", f"/events/{event.id}", event=event, priority=days + 5,
            ))
            event_issues += 1

        finance = readiness["finance"]
        if (event.agreed_price or 0) <= 0:
            actions.append(_action(
                f"quote-{event.id}", "warning", f"לקבוע מחיר ל{event.name}",
                "ללא מחיר מוסכם אי אפשר למדוד רווחיות או יתרה לגבייה.",
                "פתיחת רווחיות", f"/events/{event.id}", event=event, priority=days + 10,
            ))
            event_issues += 1
        elif finance["estimate_complete"] and finance["margin"] is not None and finance["margin"] < 20:
            actions.append(_action(
                f"margin-{event.id}", "warning", f"מרווח נמוך ב{event.name}",
                f"המרווח המשוער הוא {finance['margin']:.1f}%. כדאי לבדוק מחיר ועלויות לפני האירוע.",
                "בדיקת רווחיות", f"/events/{event.id}", event=event, priority=days + 8,
            ))
            event_issues += 1

        if readiness["allergen_warnings"] > 0:
            actions.append(_action(
                f"allergens-{event.id}", "urgent", f"בדיקת אלרגנים ב{event.name}",
                f"נמצאו {readiness['allergen_warnings']} התאמות שדורשות בדיקה לפני ההגשה.",
                "בדיקת האזהרות", f"/events/{event.id}", event=event, priority=days - 5,
            ))
            event_issues += 1

        prep = readiness["prep"]
        pending_tasks = [task for task in event.prep_tasks if not task.done]
        start_day = _event_date(prep.get("recommended_start_date"))
        if prep["total_hours"] > 0 and start_day and start_day <= today and not pending_tasks:
            actions.append(_action(
                f"prep-{event.id}", "urgent" if days <= 2 else "warning",
                f"להפעיל תוכנית הכנות ל{event.name}",
                f"יש כ־{prep['total_hours']:.1f} שעות הכנה והחלון המומלץ כבר התחיל.",
                "יצירת משימות", f"/events/{event.id}", event=event, priority=days - 2,
            ))
            event_issues += 1

        if event_issues == 0:
            ready_count += 1

    for event in events:
        balance = event_balance(event)
        if event.status == "invoiced" and balance > 0:
            actions.append(_action(
                f"payment-{event.id}", "urgent", f"לגבות יתרה מ{event.name}",
                f"נותרו ₪{balance:,.0f} לגבייה.", "רישום תשלום",
                f"/events/{event.id}", event=event, priority=-50,
            ))

    open_leads = [l for l in db.query(Lead).all()
                  if l.kind == "lead" and l.status in ("new", "contacted")]
    if open_leads:
        actions.append(_action(
            "open-leads", "opportunity", f"לטפל ב־{len(open_leads)} פניות פתוחות",
            "מעקב מהיר מגדיל את הסיכוי להפוך פנייה לאירוע.",
            "פתיחת ההזדמנויות", "/work", priority=40,
        ))

    actions.sort(key=lambda item: (
        SEVERITY_ORDER.get(item["severity"], 9), item["priority"], item["event_date"] or "9999-12-31"
    ))
    for item in actions:
        item.pop("priority", None)

    return {
        "generated_for": today.isoformat(),
        "summary": {
            "urgent": sum(a["severity"] == "urgent" for a in actions),
            "warnings": sum(a["severity"] == "warning" for a in actions),
            "opportunities": sum(a["severity"] == "opportunity" for a in actions),
            "ready_events": ready_count,
            "events_checked": len(active),
        },
        "primary": actions[0] if actions else None,
        "actions": actions[:8],
    }
