import pytest

from app.models import Event, GuestSegment, Ingredient
from app.services.nutrition import nutrition_for_quantity, event_nutrition
from app.services.substitutions import get_substitutions
from app.services.seasonality import is_in_season
from app.services.smart_menu import _restriction_overlap, suggest_menu


def _ingredient_by_name(db, name):
    return db.query(Ingredient).filter(Ingredient.name == name).first()


# ---------- Nutrition ----------

def test_nutrition_weight_ingredient(db_session):
    ing = _ingredient_by_name(db_session, "Chicken breast")
    assert ing is not None
    r = nutrition_for_quantity(ing, 100, "g")
    assert r["calories"] == pytest.approx(165, abs=0.5)
    assert r["protein_g"] == pytest.approx(31, abs=0.5)


def test_nutrition_volume_ingredient(db_session):
    ing = _ingredient_by_name(db_session, "Milk")
    r = nutrition_for_quantity(ing, 200, "ml")
    assert r["calories"] == pytest.approx(122, abs=1)


def test_nutrition_missing_returns_zero(db_session):
    ing = _ingredient_by_name(db_session, "White rice")
    r = nutrition_for_quantity(ing, 100, "g")
    assert set(r) >= {"calories", "protein_g", "carbs_g", "fat_g", "sodium_mg", "sugar_g"}
    assert r["carbs_g"] > 0


def test_event_nutrition_aggregates(client, db_session):
    # single-ingredient per-person recipe
    ing = _ingredient_by_name(db_session, "Chicken breast")
    r = client.post("/api/recipes", json={
        "name": "Plain Chicken", "category": "main", "cuisine": "american",
        "scaling_model": "per_person", "source": "user", "prep_time_min": 10,
        "ingredients": [{"ingredient_id": ing.id, "quantity": 100, "unit": "g"}],
    })
    assert r.status_code == 201, r.text
    recipe_id = r.json()["id"]

    e = client.post("/api/events", json={
        "name": "N Event", "date": "2026-06-15", "total_guests": 1,
    })
    event_id = e.json()["id"]
    client.post(f"/api/events/{event_id}/menu-items", json={
        "recipe_id": recipe_id, "portions_per_guest": 1,
    })

    plan = client.get(f"/api/events/{event_id}/plan").json()
    nut = plan["nutrition"]
    assert nut["totals"]["calories"] == pytest.approx(165, abs=1)
    assert nut["per_portion"]["calories"] == pytest.approx(165, abs=1)
    assert nut["per_dish"][0]["recipe_name"] == "Plain Chicken"


# ---------- Substitutions ----------

def test_substitutions_curated_fallback(client, db_session):
    ing = _ingredient_by_name(db_session, "Butter")
    subs = get_substitutions(db_session, ing)
    names = [s["name"] for s in subs]
    assert "Unsalted butter" in names


def test_substitutions_endpoint(client, db_session):
    ing = _ingredient_by_name(db_session, "Butter")
    r = client.get(f"/api/ingredients/{ing.id}/substitutions")
    assert r.status_code == 200
    names = [s["name"] for s in r.json()["substitutions"]]
    assert "Unsalted butter" in names


# ---------- Seasonality ----------

def test_seasonality_tomato():
    ing = Ingredient(name="Tomatoes", category="produce")
    assert is_in_season(ing, 6) is True
    assert is_in_season(ing, 12) is False
    unknown = Ingredient(name="Sea salt", category="spices")
    assert is_in_season(unknown, 6) is None


# ---------- Smart menu ----------

def test_suggest_menu_shape(client, db_session):
    e = client.post("/api/events", json={
        "name": "SM", "date": "2026-06-15", "total_guests": 4,
    })
    event_id = e.json()["id"]
    r = client.post(f"/api/events/{event_id}/menu/suggest", json={"course_count": 4})
    assert r.status_code == 200
    body = r.json()
    assert "suggestions" in body
    assert body["within_budget"] is True
    assert body["currency"] in ("ILS", "USD")
    assert 0 < len(body["suggestions"]) <= 4
    for s in body["suggestions"]:
        assert "recipe_id" in s and "name" in s and "reasons" in s


def test_suggest_menu_preferred_cuisine(client, db_session):
    e = client.post("/api/events", json={
        "name": "SM2", "date": "2026-06-15", "total_guests": 4,
    })
    event_id = e.json()["id"]
    r = client.post(f"/api/events/{event_id}/menu/suggest",
                    json={"course_count": 6, "preferred_cuisine": "indian"})
    cuisines = [s.get("cuisine") for s in r.json()["suggestions"]]
    assert "indian" in cuisines


def test_suggest_menu_budget(client, db_session):
    e = client.post("/api/events", json={
        "name": "SM3", "date": "2026-06-15", "total_guests": 4,
    })
    event_id = e.json()["id"]
    r = client.post(f"/api/events/{event_id}/menu/suggest", json={"budget": 0})
    body = r.json()
    assert body["within_budget"] is False
    assert body["total_cost"] >= 0


def test_restriction_overlap(client, db_session):
    e = client.post("/api/events", json={
        "name": "R", "date": "2026-06-15", "total_guests": 4,
    })
    event_id = e.json()["id"]
    client.post(f"/api/events/{event_id}/segments", json={
        "name": "Vegan-ish", "guest_count": 4, "restrictions": ["dairy"],
    })
    db_event = db_session.get(Event, event_id)
    # find a dairy recipe
    from app.models import Recipe
    dairy_recipe = db_session.query(Recipe).filter(Recipe.name == "Butter Chicken").first()
    reasons = _restriction_overlap(db_event, dairy_recipe)
    assert len(reasons) == 1 and "Vegan-ish" in reasons[0]


# ---------- Currency ----------

def test_event_default_currency_ils(client):
    r = client.post("/api/events", json={
        "name": "Cur", "date": "2026-06-15", "total_guests": 2,
    })
    assert r.status_code == 201
    assert r.json()["currency"] == "ILS"


def test_event_currency_ils_only(client):
    ok = client.post("/api/events", json={
        "name": "Cur2", "date": "2026-06-15", "total_guests": 2,
        "currency": "ILS",
    })
    assert ok.status_code == 201 and ok.json()["currency"] == "ILS"
    bad = client.post("/api/events", json={
        "name": "Cur3", "date": "2026-06-15", "total_guests": 2,
        "currency": "USD",
    })
    assert bad.status_code == 400


def test_settings_endpoint(client):
    assert client.get("/api/settings").json() == {}
    r = client.put("/api/settings", json={"defaultCurrency": "USD"})
    assert r.status_code == 200
    assert r.json()["defaultCurrency"] == "USD"
    assert client.get("/api/settings").json()["defaultCurrency"] == "USD"


def test_meta_endpoint(client):
    body = client.get("/api/meta").json()
    assert body["currencies"] == ["ILS"]
    assert "wedding" in body["event_types"]
    assert "dairy" in [a["key"] for a in body["allergens"]]
