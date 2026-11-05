from datetime import date, timedelta

from app.models import Event, Recipe
from app.services.prepplan import prep_plan
from app.services.gamify import profile_summary
from app.database import SessionLocal


def _make_event(client, guests=6, date="2027-03-10"):
    e = client.post("/api/events", json={
        "name": "Smart", "date": date, "total_guests": guests, "agreed_price": 1200,
    })
    return e.json()["id"]


def _add_menu_item(client, event_id, recipe_name):
    recipes = client.get("/api/recipes").json()
    r = next(x for x in recipes if x["name"] == recipe_name)
    client.post(f"/api/events/{event_id}/menu-items", json={"recipe_id": r["id"]})


# ---------- Pantry ----------

def test_pantry_crud(client, db_session):
    from app.models import Ingredient
    ing = db_session.query(Ingredient).filter(Ingredient.name == "White rice").first()
    r = client.put(f"/api/pantry/{ing.id}", json={"quantity": 500, "unit": "g"})
    assert r.status_code == 200
    assert r.json()["quantity"] == 500

    pantry = client.get("/api/pantry").json()
    assert any(p["ingredient_id"] == ing.id and p["quantity"] == 500 for p in pantry)

    assert client.delete(f"/api/pantry/{ing.id}").status_code == 204
    pantry2 = client.get("/api/pantry").json()
    assert all(p["ingredient_id"] != ing.id for p in pantry2)


# ---------- Prep plan / readiness ----------

def test_prep_plan(client, db_session):
    eid = _make_event(client)
    _add_menu_item(client, eid, "Roast Chicken with Vegetables")
    _add_menu_item(client, eid, "Greek Salad")
    plan = prep_plan(db_session, db_session.get(Event, eid))
    assert plan["total_min"] > 0
    assert plan["recommended_start_date"] is not None
    assert len(plan["tasks"]) >= 1
    assert isinstance(plan["days"], list)


def test_readiness_endpoint(client):
    eid = _make_event(client)
    _add_menu_item(client, eid, "Classic Chocolate Chip Cookies")
    r = client.get(f"/api/events/{eid}/readiness")
    assert r.status_code == 200
    body = r.json()
    assert body["finance"]["revenue"] == 1200
    assert body["prep"]["total_min"] > 0
    assert body["menu_count"] == 1
    assert body["shopping_lines"] >= 0


# ---------- Factual business profile ----------

def test_profile_summary(client, db_session):
    _make_event(client)
    p = profile_summary(db_session)
    assert p["stats"]["jobs"] == 1
    assert p["stats"]["months_active"] == 1
    assert "xp" not in p
    assert "level" not in p

    ep = client.get("/api/profile/summary").json()
    assert ep == p


# ---------- Daily Co-Chef briefing ----------

def test_home_briefing_prioritizes_missing_menu(client):
    event_day = (date.today() + timedelta(days=3)).isoformat()
    event_id = _make_event(client, date=event_day)
    body = client.get("/api/home/summary").json()

    assert body["briefing"]["summary"]["urgent"] >= 1
    primary = body["briefing"]["primary"]
    assert primary["key"] == f"menu-{event_id}"
    assert primary["href"] == f"/events/{event_id}"
    assert "תפריט" in primary["title"]


def test_pantry_rejects_negative_quantity(client, db_session):
    from app.models import Ingredient
    ingredient = db_session.query(Ingredient).first()
    response = client.put(f"/api/pantry/{ingredient.id}", json={"quantity": -1})
    assert response.status_code == 422
    assert "שלילית" in response.json()["detail"]


# ---------- File import upload ----------

def test_import_upload_txt(client):
    content = "Butter chicken\nIngredients:\nChicken breast 600 g\n"
    r = client.post("/api/import/upload", files={
        "file": ("recipe.txt", content.encode("utf-8"), "text/plain"),
    })
    assert r.status_code == 200
    body = r.json()
    assert body["kind"] == "txt"
    assert "parsed" in body
    assert body["parsed"]["name"]


def test_import_upload_unsupported(client):
    r = client.post("/api/import/upload", files={
        "file": ("recipe.exe", b"MZ", "application/octet-stream"),
    })
    assert r.status_code == 400


def test_import_upload_classifies_event_instead_of_forcing_recipe(client):
    content = "אירוע יום הולדת\n18/12/2026\n45 אורחים\nתקציב 8,500 ש״ח"
    r = client.post("/api/import/upload", files={
        "file": ("inquiry.txt", content.encode("utf-8"), "text/plain"),
    })
    assert r.status_code == 200
    body = r.json()
    assert body["classification"]["kind"] == "event"
    assert body["parsed"] is None
    assert body["text"] == content
