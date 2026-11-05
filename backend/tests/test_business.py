from app.models import Event, Ingredient
from app.services.finance import effective_unit_cost, event_finance, finance_summary
from app.services.work import work_summary, event_prep_hours
from app.database import SessionLocal


_STATUS_ORDER = ["confirmed", "production", "completed", "invoiced", "paid"]


def _advance(client, eid, target):
    cur = client.get(f"/api/events/{eid}").json()["status"]
    if cur == target:
        return
    for s in _STATUS_ORDER[_STATUS_ORDER.index(cur) + 1:_STATUS_ORDER.index(target) + 1]:
        r = client.put(f"/api/events/{eid}", json={"status": s})
        assert r.status_code == 200, r.text


def _make_event(client, guests=4, agreed=1000.0, status="confirmed", date="2026-06-15"):
    e = client.post("/api/events", json={
        "name": "Job", "date": date, "total_guests": guests,
        "agreed_price": agreed,
    })
    eid = e.json()["id"]
    if status != "confirmed":
        _advance(client, eid, status)
    return eid


# ---------- Clients ----------

def test_client_crud(client):
    r = client.post("/api/clients", json={"name": "אבי", "phone": "050-123"})
    assert r.status_code == 201
    cid = r.json()["id"]
    assert r.json()["name"] == "אבי"

    lst = client.get("/api/clients").json()
    assert any(c["id"] == cid and "summary" in c for c in lst)

    up = client.put(f"/api/clients/{cid}", json={"email": "a@x.io"})
    assert up.json()["email"] == "a@x.io"

    assert client.delete(f"/api/clients/{cid}").status_code == 204


# ---------- Leads / Quotes ----------

def test_lead_convert_to_event(client):
    cid = client.post("/api/clients", json={"name": "חני"}).json()["id"]
    q = client.post("/api/leads", json={
        "client_id": cid, "kind": "quote", "title": "אירוע חברה",
        "amount": 2500, "status": "sent", "guest_estimate": 30,
        "preferred_date": "2026-07-10",
    })
    assert q.status_code == 201
    qid = q.json()["id"]

    conv = client.post(f"/api/leads/{qid}/convert")
    assert conv.status_code == 200
    ev = conv.json()
    assert ev["status"] == "confirmed"
    assert ev["agreed_price"] == 2500
    assert ev["client_id"] == cid
    assert ev["total_guests"] == 30

    # converting again returns the same event
    conv2 = client.post(f"/api/leads/{qid}/convert")
    assert conv2.json()["id"] == ev["id"]

    # converted quote no longer counts as open pipeline value
    s = client.get("/api/finance/summary?period=all").json()
    assert s["pipeline_value"] == 0


def test_lead_convert_requires_quote(client):
    l = client.post("/api/leads", json={"kind": "lead", "title": "פנייה", "status": "new"})
    qid = l.json()["id"]
    r = client.post(f"/api/leads/{qid}/convert")
    assert r.status_code == 400


# ---------- Payments / pipeline ----------

def test_pipeline_invoiced_requires_price(client):
    eid = _make_event(client, agreed=0, status="completed")
    r = client.put(f"/api/events/{eid}", json={"status": "invoiced"})
    assert r.status_code == 400


def test_payment_auto_paid(client):
    eid = _make_event(client, agreed=100, status="invoiced")
    assert client.post(f"/api/events/{eid}/payments", json={
        "amount": 100, "date": "2026-06-20",
    }).status_code == 201
    ev = client.get(f"/api/events/{eid}").json()
    assert ev["status"] == "paid"
    assert ev["balance"] == 0
    assert ev["paid_total"] == 100


def test_paid_requires_full_payment(client):
    eid = _make_event(client, agreed=100, status="invoiced")
    client.post(f"/api/events/{eid}/payments", json={"amount": 40, "date": "2026-06-20"})
    r = client.put(f"/api/events/{eid}", json={"status": "paid"})
    assert r.status_code == 400


# ---------- Price book / finance ----------

def test_effective_unit_cost(db_session, client):
    ing = db_session.query(Ingredient).filter(Ingredient.name == "Chicken breast").first()
    client.post(f"/api/ingredients/{ing.id}/price-book", json={
        "price_per_unit": 0.012, "effective_date": "2026-01-01",
    })
    client.post(f"/api/ingredients/{ing.id}/price-book", json={
        "price_per_unit": 0.02, "effective_date": "2026-12-01",
    })
    # a date before the future entry picks the 0.012 one
    assert effective_unit_cost(db_session, ing.id, "2026-06-01") == 0.012
    # after the future entry, picks 0.02
    assert effective_unit_cost(db_session, ing.id, "2026-12-15") == 0.02


def test_finance_summary(client, db_session):
    cid = client.post("/api/clients", json={"name": "רוני"}).json()["id"]
    eid = _make_event(client, agreed=2000, status="invoiced")
    client.put(f"/api/events/{eid}", json={"client_id": cid})
    client.post(f"/api/events/{eid}/payments", json={"amount": 500, "date": "2026-06-20"})

    s = client.get("/api/finance/summary?period=all").json()
    assert s["revenue"] == 2000
    assert s["receivables"] == 1500
    assert s["jobs_count"] == 1
    assert s["pipeline_value"] == 0
    assert s["net"] <= s["revenue"]


def test_work_summary(client):
    _make_event(client, guests=10, agreed=1500, date="2027-06-15")
    w = client.get("/api/work/summary").json()
    assert w["pipeline_counts"]["confirmed"] >= 1
    assert len(w["workload"]) == 14
    assert w["next_event"] is not None
    assert "actions" in w
