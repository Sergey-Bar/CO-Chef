def test_employee_crud(client):
    r = client.post("/api/employees", json={"name": "יוסי", "role": "טבח", "hourly_rate": 55})
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "יוסי"
    assert body["role"] == "טבח"
    assert body["hourly_rate"] == 55
    assert body["active"] is True
    eid = body["id"]

    lst = client.get("/api/employees").json()
    assert any(e["id"] == eid for e in lst)

    up = client.put(f"/api/employees/{eid}", json={"hourly_rate": 60, "active": False})
    assert up.status_code == 200
    assert up.json()["hourly_rate"] == 60
    assert up.json()["active"] is False

    assert client.delete(f"/api/employees/{eid}").status_code == 204
    assert client.get("/api/employees").json() == []


def test_employee_requires_name(client):
    r = client.post("/api/employees", json={"hourly_rate": 100})
    assert r.status_code == 422


def test_employee_404(client):
    assert client.put("/api/employees/9999", json={"name": "x"}).status_code == 404
    assert client.delete("/api/employees/9999").status_code == 404
