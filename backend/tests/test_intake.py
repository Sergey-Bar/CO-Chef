from app.services.intake import classify_intake


def test_classifies_hebrew_recipe():
    result = classify_intake("פסטה לימונית\n500 גרם פסטה\n250 מ״ל שמנת\n2 כפות שמן זית")
    assert result["kind"] == "recipe"
    assert result["fields"]["line_count"] == 4


def test_classifies_event_and_extracts_fields():
    result = classify_intake("אירוע יום הולדת\n18/12/2026\n45 אורחים\nתקציב 8,500 ש״ח")
    assert result["kind"] == "event"
    assert result["fields"]["date"] == "2026-12-18"
    assert result["fields"]["guests"] == 45
    assert result["fields"]["amount"] == 8500


def test_classifies_client_contact():
    result = classify_intake("לקוח חדש: דנה\nטלפון 052-123-4567\nמייל dana@example.com")
    assert result["kind"] == "client"
    assert result["fields"]["email"] == "dana@example.com"


def test_classifies_supplier_inventory_text():
    result = classify_intake("חשבונית ספק ירקות\nמלאי עגבניות 4 ארגז\nמחיר ליחידה 35 ש״ח")
    assert result["kind"] == "inventory"
