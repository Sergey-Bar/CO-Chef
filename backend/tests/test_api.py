import pytest

from app.main import app
from app.database import SessionLocal
from app.seed import seed_all
from app.models import Event


def _make_event(client, guests=100):
    r = client.post("/api/events", json={
        "name": "Wedding", "date": "2030-06-01", "total_guests": guests,
    })
    assert r.status_code == 201
    return r.json()["id"]


def test_crud_ingredient(client):
    r = client.post("/api/ingredients", json={
        "name": "Test Flour", "category": "pantry", "aliases": ["th flour"],
        "default_unit": "g", "cost_per_unit": 0.003, "density": 0.529,
    })
    assert r.status_code == 201
    iid = r.json()["id"]
    r = client.get("/api/ingredients")
    assert any(i["name"] == "Test Flour" for i in r.json())
    r = client.put(f"/api/ingredients/{iid}", json={"default_unit": "cup"})
    assert r.json()["default_unit"] == "cup"
    r = client.delete(f"/api/ingredients/{iid}")
    assert r.status_code == 204


def test_segment_sum_validation(client):
    eid = _make_event(client, 100)
    # Mismatched total -> rejected
    r = client.put(f"/api/events/{eid}/segments", json=[
        {"name": "Vegan", "guest_count": 60, "restrictions": ["dairy", "egg"]},
        {"name": "Veg", "guest_count": 20},
    ])
    assert r.status_code == 400
    # Matching total -> accepted
    r = client.put(f"/api/events/{eid}/segments", json=[
        {"name": "Vegan", "guest_count": 60, "restrictions": ["dairy", "egg"]},
        {"name": "Veg", "guest_count": 40},
    ])
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_unknown_allergen_rejected(client):
    eid = _make_event(client, 50)
    r = client.post(f"/api/events/{eid}/segments", json={
        "name": "Weird", "guest_count": 50, "restrictions": ["gluten", "notreal"],
    })
    assert r.status_code == 400


def test_recipe_and_plan_flow(client):
    client.post("/api/seed")
    # create event + recipe + menu item, then compute plan
    eid = client.post("/api/events", json={
        "name": "Party", "date": "2030-07-01", "total_guests": 8,
        "buffer_percent": 10, "other_costs": 25, "tax_percent": 8,
    }).json()["id"]

    recipes = client.get("/api/recipes").json()
    roaster = next(r for r in recipes if r["name"] == "Roast Chicken with Vegetables")
    r = client.post(f"/api/events/{eid}/menu-items", json={
        "recipe_id": roaster["id"], "portions_per_guest": 1,
    })
    assert r.status_code == 201

    plan = client.get(f"/api/events/{eid}/plan").json()
    assert len(plan["shopping_list"]) > 0
    # buffer applied: qty_after_buffer = qty_before * 1.1
    for line in plan["shopping_list"]:
        assert line["qty_after_buffer"] == pytest.approx(line["qty_before_buffer"] * 1.1)
    assert plan["costs"]["other_costs"] == 25
    assert plan["costs"]["tax_percent"] == 8
    assert plan["prep_suggestions"]


def test_status_pipeline(client):
    db = SessionLocal()
    ev = Event(name="Future", date="2030-01-01", total_guests=10, status="confirmed")
    db.add(ev)
    db.commit()
    eid = ev.id

    # manual lifecycle status is preserved (no auto-override)
    r = client.get(f"/api/events/{eid}")
    assert r.json()["status"] == "confirmed"

    # forward transitions are allowed
    r = client.put(f"/api/events/{eid}", json={"status": "production"})
    assert r.status_code == 200 and r.json()["status"] == "production"

    # archive allowed from any active stage
    r = client.put(f"/api/events/{eid}", json={"status": "archived"})
    assert r.json()["status"] == "archived"

    # cannot transition out of archived
    r = client.put(f"/api/events/{eid}", json={"status": "confirmed"})
    assert r.status_code == 400


def test_allergen_report(client):
    client.post("/api/seed")
    eid = _make_event(client, 48)
    seg = client.post(f"/api/events/{eid}/segments", json={
        "name": "Vegan", "guest_count": 48, "restrictions": ["egg", "dairy"],
    }).json()
    cookies = next(r for r in client.get("/api/recipes").json()
                   if r["name"] == "Classic Chocolate Chip Cookies")
    client.post(f"/api/events/{eid}/menu-items", json={
        "recipe_id": cookies["id"], "segment_id": seg["id"],
    })
    plan = client.get(f"/api/events/{eid}/plan").json()
    assert len(plan["allergen_report"]) == 1
    report = plan["allergen_report"][0]
    assert report["segment_name"] == "Vegan"
    assert len(report["flagged_items"]) == 1
    assert set(report["flagged_items"][0]["allergens"]) == {"dairy", "egg"}


def test_import_parse_and_confirm(client):
    text = "Hearty Pancakes\n2 cups flour\n1/2 cup milk\n2 eggs"
    parsed = client.post("/api/import/parse", json={"text": text}).json()
    assert parsed["name"] == "Hearty Pancakes"
    parsed_lines = [p for p in parsed["ingredients"] if p.get("ok")]
    assert len(parsed_lines) == 3
    # confirm creates imported recipe
    confirmed = client.post("/api/import/confirm", json={
        "name": "Hearty Pancakes", "ingredients": [
            {"ingredient": "All-purpose flour", "quantity": 2, "unit": "cup"},
            {"ingredient": "Milk", "quantity": 0.5, "unit": "cup"},
            {"ingredient": "Eggs", "quantity": 2, "unit": "each"},
        ],
    })
    assert confirmed.status_code == 201
    assert confirmed.json()["source"] == "imported"
    assert len(confirmed.json()["ingredients"]) == 3


def test_alias_matching(monkeypatch):
    # verify find_ingredient_by_alias resolves by alias
    from app.database import SessionLocal
    from app.seed import seed_all, find_ingredient_by_alias
    db = SessionLocal()
    seed_all(db)
    ing = find_ingredient_by_alias(db, "flour")
    assert ing is not None and ing.name == "All-purpose flour"
    ing2 = find_ingredient_by_alias(db, "evoo")
    assert ing2 is not None and ing2.name == "Olive oil"
