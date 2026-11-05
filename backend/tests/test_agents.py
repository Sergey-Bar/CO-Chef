def test_external_agent_can_publish_dashboard_update(client):
    created = client.post("/api/agents", json={
        "name": "שומר הרווחיות", "slug": "profit-guard",
        "provider": "Local test agent", "capabilities": ["רווחיות", "תמחור"],
    })
    assert created.status_code == 201
    agent = created.json()
    assert agent["access_key"].startswith("ccagent_")
    assert agent["access_key"] not in str(client.get("/api/agents").json())

    published = client.post(
        f"/api/agents/{agent['id']}/updates",
        headers={"X-CoChef-Agent-Key": agent["access_key"]},
        json={
            "severity": "warning",
            "title": "מחיר חומר גלם חסר",
            "summary": "יש להשלים מחיר לפני חישוב רווח סופי.",
            "href": "/finance",
        },
    )
    assert published.status_code == 201
    update = published.json()
    assert update["agent_name"] == "שומר הרווחיות"
    assert update["status"] == "new"

    home = client.get("/api/home/summary").json()
    assert home["agent_updates"][0]["id"] == update["id"]

    resolved = client.patch(f"/api/agent-updates/{update['id']}", json={"status": "resolved"})
    assert resolved.status_code == 200
    assert resolved.json()["status"] == "resolved"


def test_agent_update_rejects_wrong_key_and_external_url(client):
    agent = client.post("/api/agents", json={"name": "בדיקה", "slug": "safety-check"}).json()
    wrong_key = client.post(
        f"/api/agents/{agent['id']}/updates",
        headers={"X-CoChef-Agent-Key": "wrong"},
        json={"title": "לא אמור להישמר", "summary": "בדיקה"},
    )
    assert wrong_key.status_code == 401

    unsafe_url = client.post(
        f"/api/agents/{agent['id']}/updates",
        headers={"X-CoChef-Agent-Key": agent["access_key"]},
        json={"title": "לא אמור להישמר", "summary": "בדיקה", "href": "https://example.com"},
    )
    assert unsafe_url.status_code == 422


def test_agents_can_report_to_a_manager(client):
    manager = client.post("/api/agents", json={"name": "מנהל הסוכנים", "slug": "orchestrator"}).json()
    specialist = client.post("/api/agents", json={
        "name": "מומחה מלאי", "slug": "pantry-specialist", "parent_agent_id": manager["id"],
    })
    assert specialist.status_code == 201
    assert specialist.json()["parent_agent_id"] == manager["id"]
    listed = client.get("/api/agents").json()
    assert next(agent for agent in listed if agent["id"] == specialist.json()["id"])["parent_agent_id"] == manager["id"]


def test_agent_reporting_lines_cannot_form_a_cycle(client):
    manager = client.post("/api/agents", json={"name": "מנהל", "slug": "manager"}).json()
    specialist = client.post("/api/agents", json={
        "name": "מומחה", "slug": "specialist", "parent_agent_id": manager["id"],
    }).json()

    response = client.put(f"/api/agents/{manager['id']}", json={"parent_agent_id": specialist["id"]})

    assert response.status_code == 422
    assert "מעגל" in response.json()["detail"]
