import os
import tempfile
from pathlib import Path

os.environ.setdefault('BULKHEAD_DEV_LOCALHOST', 'true')
os.environ.setdefault('BULKHEAD_ORIGIN', 'http://localhost:8080')
os.environ['BULKHEAD_DATABASE_URL'] = os.environ.get('BULKHEAD_TEST_DATABASE_URL', 'sqlite:///' + str(Path(tempfile.mkdtemp(prefix='bulkhead-tests-')) / 'regression.db'))
if not os.environ['BULKHEAD_DATABASE_URL'].startswith('sqlite:') and not os.environ['BULKHEAD_DATABASE_URL'].rsplit('/',1)[-1].endswith('_test'):
    raise RuntimeError('The explicit PostgreSQL test database name must end in _test')

# Optional QA accommodation for sandboxes that deny socketpair wakeups. This
# changes only the test loop's idle polling; production uses normal event loops.
if os.environ.get('BULKHEAD_TEST_POLL_LOOP') == 'true':
    import selectors
    _original_select = selectors.DefaultSelector.select
    def _poll_select(self, timeout=None):
        return _original_select(self, min(timeout, 0.01) if timeout is not None else 0.01)
    selectors.DefaultSelector.select = _poll_select

import pytest
from fastapi.testclient import TestClient
from bulkhead.db import Base, engine, SessionLocal, User
from bulkhead.security import password_hash
from app import app


@pytest.fixture(autouse=True)
def database():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture
def client():
    with TestClient(app, base_url='http://localhost:8080', headers={'Origin': 'http://localhost:8080'}) as client:
        client.headers['X-CSRF-Token'] = client.get('/api/v1/auth/csrf').json()['csrf_token']
        yield client


def sign_in(client, email='owner@example.com'):
    with SessionLocal.begin() as db:
        user = User(email=email, password_hash=password_hash('correct horse battery staple'), verified=True)
        db.add(user)
        db.flush()
        user_id = user.id
    response = client.post('/api/v1/auth/login', json={'email': email, 'password': 'correct horse battery staple'})
    assert response.status_code == 200, response.text
    client.headers['X-CSRF-Token'] = response.json()['csrf_token']
    return user_id


@pytest.fixture
def owner(client):
    user = sign_in(client)
    response = client.post('/api/v1/households', json={'name': 'Regression home'})
    assert response.status_code == 201, response.text
    return user, response.json()['id']
