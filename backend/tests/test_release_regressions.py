from datetime import date
from app.models import Ingredient, PriceBook


def test_telegram_secret_is_not_exposed_in_general_settings(client):
    token = '123456789:TEST_ONLY_NOT_A_REAL_TOKEN'
    response = client.put('/api/integrations/telegram', json={'bot_token': token, 'chat_id': '12345', 'enabled': True})
    assert response.status_code == 200
    assert token not in response.text
    assert token not in client.get('/api/settings').text
    assert token not in client.put('/api/settings', json={'test_preference': True}).text
    assert client.put('/api/settings', json={'telegram_bot_token': token}).status_code == 422


def test_price_insights_normalize_units_and_ignore_future(client, db_session):
    ingredient = Ingredient(name='Regression flour', default_unit='g', currency='ILS')
    db_session.add(ingredient)
    db_session.flush()
    db_session.add_all([
        PriceBook(ingredient_id=ingredient.id, unit='g', price_per_unit=0.01, effective_date='2020-01-01'),
        PriceBook(ingredient_id=ingredient.id, unit='kg', price_per_unit=12, effective_date=date.today().isoformat()),
        PriceBook(ingredient_id=ingredient.id, unit='kg', price_per_unit=1200, effective_date='2099-01-01'),
    ])
    db_session.commit()
    changes = client.get('/api/home/summary').json()['insights']['price_increases']
    change = next(item for item in changes if item['name'] == 'Regression flour')
    assert change['change_percent'] == 20


def test_telegram_errors_are_returned_without_secrets(client, monkeypatch):
    client.put('/api/integrations/telegram', json={'bot_token': '123456789:TEST_ONLY_NOT_A_REAL_TOKEN', 'chat_id': '12345', 'enabled': True})
    def fail(*args):
        raise ValueError('Telegram unavailable')
    monkeypatch.setattr('app.main.send_telegram_message', fail)
    response = client.post('/api/integrations/telegram/test')
    assert response.status_code == 502
    assert 'TEST_ONLY' not in response.text
