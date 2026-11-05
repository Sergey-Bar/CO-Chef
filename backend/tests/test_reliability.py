import sqlite3
from datetime import date

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.models import Event, Ingredient, Recipe, RecipeIngredient, EventMenuItem, PriceBook, Payment
from app.services.finance import event_finance, finance_summary, _in_period
from app.services.plan import auto_update_status
from app.static import SPAStaticFiles


def test_spa_routes_and_real_404s(tmp_path):
    (tmp_path / "index.html").write_text("<h1>Chef</h1>")
    app = FastAPI()
    app.mount("/", SPAStaticFiles(directory=tmp_path, html=True))
    with TestClient(app) as client:
        assert client.get("/events/123").text == "<h1>Chef</h1>"
        assert client.get("/api/unknown").status_code == 404
        assert client.get("/assets/missing.js").status_code == 404
        assert client.post("/events/123").status_code == 405


def test_backup_contains_all_tables(client, tmp_path):
    client.post("/api/clients", json={"name": "Backup Client"})
    response = client.get("/api/backup")
    assert response.status_code == 200
    path = tmp_path / "restore.db"
    path.write_bytes(response.content)
    with sqlite3.connect(path) as db:
        assert db.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
        assert db.execute("SELECT name FROM clients").fetchone()[0] == "Backup Client"
        assert db.execute("SELECT count(*) FROM recipes").fetchone()[0] > 0


@pytest.mark.parametrize("payload", [
    {"name": " ", "ingredients": [{"ingredient": "Rice", "quantity": 1}]},
    {"name": "Rice", "ingredients": []},
    {"name": "Rice", "ingredients": [{"ingredient": "Rice", "quantity": -1}]},
])
def test_import_validation(client, payload):
    assert client.post("/api/import/confirm", json=payload).status_code == 422


def test_profit_includes_buffer_and_converts_price_units(db_session):
    db = db_session
    ingredient = Ingredient(name="Profit test", default_unit="g", cost_per_unit=0.01, currency="ILS")
    recipe = Recipe(name="Profit recipe", base_servings=1)
    event = Event(name="Profit event", date="2030-01-01", total_guests=1,
                  buffer_percent=20, agreed_price=100, other_costs=10, tax_percent=10)
    db.add_all([ingredient, recipe, event])
    db.flush()
    db.add_all([
        RecipeIngredient(recipe_id=recipe.id, ingredient_id=ingredient.id, quantity=500, unit="g"),
        EventMenuItem(event_id=event.id, recipe_id=recipe.id),
        PriceBook(ingredient_id=ingredient.id, unit="kg", price_per_unit=20, effective_date="2029-01-01"),
    ])
    db.commit()
    result = event_finance(db, event)
    assert result["cogs"] == 12  # 600 g at 20 per kg
    assert result["total_cost"] == 23.2
    assert result["net"] == 76.8
    assert result["estimate_complete"]
    ingredient.currency = "USD"
    db.commit()
    assert not event_finance(db, event)["estimate_complete"]


def test_collection_does_not_double_count_deposit(db_session):
    event = Event(name="Paid", date=date.today().isoformat(), total_guests=1,
                  status="completed", agreed_price=1000, deposit_paid=500)
    db_session.add(event)
    db_session.flush()
    db_session.add(Payment(event_id=event.id, amount=500, date=event.date))
    db_session.commit()
    result = finance_summary(db_session)
    assert result["collected"] == 500
    assert result["receivables"] == 500
    # No menu means costs are unknown; collections remain valid but profit
    # must not be presented as a fully costed completed event.
    assert result["completed_net"] == 0
    assert result["incomplete_estimates"] == 1
    assert result["projected_net"] == 0
    assert result["incomplete_estimates"] == 1


def test_auto_update_status_completes_past_confirmed(db_session):
    event = Event(name="Past", date="2020-01-01", total_guests=1, status="confirmed")
    db_session.add(event)
    db_session.commit()
    auto_update_status(db_session, event)
    assert event.status == "completed"


def test_auto_update_status_completes_past_production(db_session):
    event = Event(name="Past", date="2020-01-01", total_guests=1, status="production")
    db_session.add(event)
    db_session.commit()
    auto_update_status(db_session, event)
    assert event.status == "completed"


def test_auto_update_status_keeps_future_confirmed(db_session):
    event = Event(name="Future", date="2099-01-01", total_guests=1, status="confirmed")
    db_session.add(event)
    db_session.commit()
    auto_update_status(db_session, event)
    assert event.status == "confirmed"


def test_auto_update_status_does_not_touch_invoiced(db_session):
    event = Event(name="Past", date="2020-01-01", total_guests=1, status="invoiced")
    db_session.add(event)
    db_session.commit()
    auto_update_status(db_session, event)
    assert event.status == "invoiced"


def test_period_excludes_future_year():
    assert _in_period(date.today().isoformat(), "month")
    assert not _in_period(f"{date.today().year + 1}-01-01", "month")
    assert not _in_period(f"{date.today().year + 1}-01-01", "year")
