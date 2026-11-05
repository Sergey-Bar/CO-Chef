from __future__ import annotations

import re
from datetime import datetime


DATE_PATTERNS = (
    re.compile(r"\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b"),
    re.compile(r"\b(\d{1,2})[/.](\d{1,2})[/.](20\d{2})\b"),
)
EMAIL_RE = re.compile(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(r"(?<!\d)(?:\+?972[- ]?|0)(?:5\d|[23489])[- ]?\d{3}[- ]?\d{4}(?!\d)")
GUEST_RE = re.compile(r"(\d{1,4})\s*(?:אורחים|איש|אנשים|סועדים|מנות)")
MONEY_RE = re.compile(r"(?:₪|שח|ש״ח)\s*([\d,]+)|([\d,]+)\s*(?:₪|שח|ש״ח)")


def _date(text: str) -> str | None:
    for index, pattern in enumerate(DATE_PATTERNS):
        match = pattern.search(text)
        if not match:
            continue
        values = [int(value) for value in match.groups()]
        year, month, day = values if index == 0 else (values[2], values[1], values[0])
        try:
            return datetime(year, month, day).date().isoformat()
        except ValueError:
            pass
    return None


def classify_intake(text: str) -> dict:
    clean = "\n".join(line.strip() for line in text.strip().splitlines() if line.strip())
    lowered = clean.lower()
    lines = clean.splitlines()
    unit_lines = sum(bool(re.search(r"\b\d+(?:[.,/]\d+)?\s*(?:גרם|קג|ק״ג|מ״ל|מל|ליטר|כוס|כפות?|כפיות?|g|kg|ml|cup|tbsp|tsp)\b", line, re.I)) for line in lines)

    scores = {
        "recipe": unit_lines * 2 + sum(word in lowered for word in ("מצרכים", "אופן הכנה", "מתכון", "ingredients")) * 3,
        "event": sum(word in lowered for word in ("אירוע", "חתונה", "ארוחה", "יום הולדת", "הצעת מחיר", "קייטרינג", "אורחים", "סועדים")) * 2,
        "client": sum(word in lowered for word in ("לקוח", "טלפון", "נייד", "מייל", "כתובת")) * 2,
        "inventory": sum(word in lowered for word in ("מלאי", "ספק", "חשבונית", "קנייה", "ארגז", "מחיר ליחידה")) * 2,
        "note": 1,
    }
    if GUEST_RE.search(clean):
        scores["event"] += 4
    if EMAIL_RE.search(clean) or PHONE_RE.search(clean):
        scores["client"] += 2
        scores["event"] += 1
    if len(lines) >= 3 and unit_lines >= 2:
        scores["recipe"] += 3

    kind = max(scores, key=scores.get)
    best = scores[kind]
    second = sorted(scores.values(), reverse=True)[1]
    confidence = min(0.98, 0.55 + max(0, best - second) * 0.07)
    title = lines[0][:100] if lines else "טקסט מיובא"
    guest_match = GUEST_RE.search(clean)
    money_match = MONEY_RE.search(clean)
    amount_raw = next((value for value in money_match.groups() if value), None) if money_match else None

    labels = {"recipe": "מתכון", "event": "פנייה לאירוע", "client": "לקוח", "inventory": "מלאי או רכישה", "note": "הערה כללית"}
    return {
        "kind": kind,
        "label": labels[kind],
        "confidence": round(confidence, 2),
        "title": title,
        "fields": {
            "date": _date(clean),
            "guests": int(guest_match.group(1)) if guest_match else None,
            "email": EMAIL_RE.search(clean).group(0) if EMAIL_RE.search(clean) else None,
            "phone": PHONE_RE.search(clean).group(0) if PHONE_RE.search(clean) else None,
            "amount": float(amount_raw.replace(",", "")) if amount_raw else None,
            "line_count": len(lines),
        },
    }
