from __future__ import annotations

import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def send_message(token: str, chat_id: str, message: str) -> None:
    """Send an explicitly requested alert through Telegram's HTTPS Bot API."""
    payload = json.dumps({"chat_id": chat_id, "text": message}).encode("utf-8")
    request = Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=payload,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=12) as response:
            body = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError) as exc:
        raise ValueError("Telegram לא קיבל את ההודעה. בדקו את המפתח, מזהה הצ׳אט והחיבור.") from exc
    if not body.get("ok"):
        raise ValueError("Telegram דחה את ההודעה. בדקו את המפתח, מזהה הצ׳אט והרשאות הבוט.")
