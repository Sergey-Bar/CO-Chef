import sqlite3


def test_event_lifecycle_and_backup_recovery(client, tmp_path):
    created = client.post('/api/events', json={
        'name': 'בדיקת מסלול מלא', 'date': '2099-05-12', 'total_guests': 10,
        'agreed_price': 2000, 'other_costs': 300,
    })
    assert created.status_code == 201
    event_id = created.json()['id']
    recipe_id = client.get('/api/recipes').json()[0]['id']
    assert client.post(f'/api/events/{event_id}/menu-items', json={'recipe_id': recipe_id}).status_code == 201
    assert client.get(f'/api/events/{event_id}/plan').json()['shopping_list']
    task = client.post(f'/api/events/{event_id}/prep-tasks', json={'title': 'אריזת ציוד'}).json()
    assert client.put(f"/api/prep-tasks/{task['id']}", json={'done': True}).status_code == 200
    for status in ['production', 'completed', 'invoiced']:
        response = client.put(f'/api/events/{event_id}', json={'status': status})
        assert response.status_code == 200, response.text
    for amount in [500, 1500]:
        response = client.post(f'/api/events/{event_id}/payments', json={'amount': amount, 'date': '2099-05-12'})
        assert response.status_code == 201, response.text
    event = client.get(f'/api/events/{event_id}').json()
    assert event['balance'] == 0
    assert event['status'] == 'paid'
    backup = client.get('/api/backup')
    assert backup.status_code == 200
    restored_path = tmp_path / 'isolated-restored.db'
    restored_path.write_bytes(backup.content)
    with sqlite3.connect(restored_path) as restored:
        assert restored.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
        assert restored.execute('SELECT status FROM events WHERE id=?', (event_id,)).fetchone()[0] == 'paid'
        assert restored.execute('SELECT SUM(amount) FROM payments WHERE event_id=?', (event_id,)).fetchone()[0] == 2000
        assert restored.execute('SELECT done FROM prep_tasks WHERE id=?', (task['id'],)).fetchone()[0] == 1
