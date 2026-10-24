import re
import time
from unittest.mock import AsyncMock, patch
import pytest
from sqlalchemy import select, delete
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from bulkhead.db import SessionLocal, User, Token, Job, Membership, SessionRecord, Identity
from bulkhead.security import digest, password_valid, token_new
from bulkhead.config import settings
from app import app
from conftest import sign_in

BASE = '/api/v1'
PASSWORD = 'correct horse battery staple'


def email_token(purpose):
    with SessionLocal() as db:
        job = db.scalar(select(Job).where(Job.kind == 'email', Job.dedupe_key.like(purpose+':%')).order_by(Job.available_at.desc()))
        return re.search(r'token=([^\s]+)', job.payload['text']).group(1)


def test_registration_verification_single_use_and_argon2id(client):
    r = client.post(BASE+'/auth/register', json={'email': 'NEW@EXAMPLE.COM', 'password': PASSWORD})
    assert r.status_code == 202
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == 'new@example.com'))
        assert not user.verified and user.password_hash.startswith('$argon2id$')
        assert password_valid(PASSWORD, user.password_hash)
    assert client.post(BASE+'/auth/login', json={'email':'new@example.com','password':PASSWORD}).status_code == 401
    token = email_token('verification')
    assert client.post(BASE+'/auth/verify',json={'token':token}).status_code == 200
    assert client.post(BASE+'/auth/verify',json={'token':token}).status_code == 400
    r = client.post(BASE+'/auth/login',json={'email':'new@example.com','password':PASSWORD})
    assert r.status_code == 200
    cookie = r.headers['set-cookie'].lower()
    assert 'httponly' in cookie and 'samesite=lax' in cookie
    assert 'secure' not in cookie  # Explicit localhost development only.


def test_csrf_origin_and_legacy_removal(client, owner):
    _, home = owner
    endpoint = BASE+f'/households/{home}/profile'
    assert client.post(endpoint,json={'profile':'Work'},headers={'X-CSRF-Token':'wrong'}).status_code == 403
    assert client.post(endpoint,json={'profile':'Work'},headers={'Origin':'https://attacker.example'}).status_code == 403
    for legacy in ('/state','/audit','/profile','/scenario/reset','/action/confirm'):
        assert client.get(legacy).status_code == 404
    for profile in ('Admin','Family','Work','Solo'):
        assert client.post(endpoint,json={'profile':profile}).status_code == 200
        assert client.get(BASE+f'/households/{home}/state').json()['profile'] == profile


def test_recovery_revokes_all_sessions_and_expiry(client, owner):
    client.post(BASE+'/auth/recovery',json={'email':'owner@example.com'})
    token = email_token('recovery')
    assert client.post(BASE+'/auth/reset',json={'token':token,'password':PASSWORD+'new'}).status_code == 200
    assert client.get(BASE+'/auth/me').status_code == 401
    client.headers['X-CSRF-Token'] = client.get(BASE+'/auth/csrf').json()['csrf_token']
    assert client.post(BASE+'/auth/reset',json={'token':token,'password':PASSWORD+'new'}).status_code == 400
    with SessionLocal.begin() as db:
        expired = token_new(db, 'verification', owner[0], ttl=-1)
    assert client.post(BASE+'/auth/verify',json={'token':expired}).status_code == 400


def test_failed_logins_are_throttled_across_sessions(client, owner):
    for _ in range(9):
        assert client.post(BASE+'/auth/login',json={'email':'owner@example.com','password':PASSWORD+'wrong'}).status_code == 401
    assert client.post(BASE+'/auth/login',json={'email':'owner@example.com','password':PASSWORD+'wrong'}).status_code == 429


def test_roles_invitations_guests_and_household_isolation(client, owner):
    owner_id, home = owner
    invite = client.post(BASE+f'/households/{home}/invitations',json={'email':'viewer@example.com','guest':True}).json()
    token = invite['invite_url'].split('invite=')[1]
    assert invite['role'] == 'Viewer' and invite['expires_in'] == 604800
    with TestClient(app,base_url='http://localhost:8080',headers={'Origin':'http://localhost:8080'}) as viewer:
        viewer.headers['X-CSRF-Token'] = viewer.get(BASE+'/auth/csrf').json()['csrf_token']
        viewer_id = sign_in(viewer,'viewer@example.com')
        joined = viewer.post(BASE+'/households/invitations/accept',json={'token':token})
        assert joined.status_code == 200
        assert 86390 < joined.json()['expires_at'] - time.time() <= 86400
        assert viewer.get(BASE+f'/households/{home}/state').status_code == 200
        assert viewer.post(BASE+f'/households/{home}/profile',json={'profile':'Work'}).status_code == 403
        other = viewer.post(BASE+'/households',json={'name':'Private elsewhere'}).json()['id']
        assert client.get(BASE+f'/households/{other}/state').status_code == 404
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect('ws://localhost:8080'+BASE+f'/households/{other}/events/ws',headers={'Origin':'http://localhost:8080'}):
                pass
        with viewer.websocket_connect('ws://localhost:8080'+BASE+f'/households/{home}/events/ws',headers={'Origin':'http://localhost:8080'}) as ws:
            assert ws.receive_json()['type'] == 'STATE_UPDATE'
            with SessionLocal.begin() as db:
                member = db.scalar(select(Membership).where(Membership.household_id==home,Membership.user_id==viewer_id))
                member.expires_at=time.time()-1
            while True:
                try: ws.receive_json()
                except WebSocketDisconnect: break
        assert viewer.get(BASE+f'/households/{home}/state').status_code == 404


def test_only_owner_grants_admin_and_invitation_expiry(client, owner):
    _, home = owner
    invite = client.post(BASE+f'/households/{home}/invitations',json={'email':'admin@example.com','role':'Admin'}).json()
    with TestClient(app,base_url='http://localhost:8080',headers={'Origin':'http://localhost:8080'}) as admin:
        admin.headers['X-CSRF-Token'] = admin.get(BASE+'/auth/csrf').json()['csrf_token']
        sign_in(admin,'admin@example.com')
        assert admin.post(BASE+'/households/invitations/accept',json={'token':invite['invite_url'].split('invite=')[1]}).status_code == 200
        assert admin.post(BASE+f'/households/{home}/invitations',json={'email':'another@example.com','role':'Admin'}).status_code == 403
        expired=admin.post(BASE+f'/households/{home}/invitations',json={'email':'expired@example.com'}).json()['invite_url'].split('invite=')[1]
        with SessionLocal.begin() as db:
            db.get(Token,digest(expired)).expires_at=time.time()-1
        assert admin.post(BASE+'/households/invitations/accept',json={'token':expired}).status_code == 400


def test_session_revocation_terminates_websocket(client, owner):
    _, home = owner
    with client.websocket_connect('ws://localhost:8080'+BASE+f'/households/{home}/events/ws',headers={'Origin':'http://localhost:8080'}) as ws:
        ws.receive_json()
        session_id=client.get(BASE+'/auth/me').json()['session_id']
        assert client.delete(BASE+'/auth/sessions/'+session_id).status_code == 200
        with pytest.raises(WebSocketDisconnect):
            while True: ws.receive_json()


def test_google_state_nonce_pkce_and_authenticated_linking(client, owner):
    from urllib.parse import urlsplit, parse_qs
    cfg=settings()
    with patch.object(cfg,'google_client_id','test-client'), patch.object(cfg,'google_client_secret','test-secret'):
        start=client.get(BASE+'/auth/google/start',follow_redirects=False)
        query=parse_qs(urlsplit(start.headers['location']).query)
        assert query['code_challenge_method']==['S256'] and query['nonce'] and query['code_challenge']
        assert query['redirect_uri']==['http://localhost:8080/api/v1/auth/google/callback']
        assert client.get(BASE+'/auth/google/callback?state=invalid&code=x').status_code == 400
        state=query['state'][0]
        with patch('bulkhead.auth.validate_google',new=AsyncMock(side_effect=ValueError('bad nonce'))):
            assert client.get(BASE+f'/auth/google/callback?state={state}&code=bad').status_code == 400
        assert client.get(BASE+f'/auth/google/callback?state={state}&code=bad').status_code == 400
        # Existing email never silently links; authenticated link flow is explicit.
        start=client.get(BASE+'/auth/google/start',follow_redirects=False)
        state=parse_qs(urlsplit(start.headers['location']).query)['state'][0]
        claims={'sub':'google-subject','email':'owner@example.com','email_verified':True}
        with patch('bulkhead.auth.validate_google',new=AsyncMock(return_value=claims)):
            assert client.get(BASE+f'/auth/google/callback?state={state}&code=ok').status_code == 409
            link=client.post(BASE+'/auth/google/link').json()['url']
            state=parse_qs(urlsplit(link).query)['state'][0]
            assert client.get(BASE+f'/auth/google/callback?state={state}&code=ok',follow_redirects=False).status_code == 303
        with SessionLocal() as db:
            identity=db.scalar(select(Identity).where(Identity.subject=='google-subject'))
            assert identity.user_id == owner[0]
        assert client.get(BASE+f'/auth/google/callback?state={state}&code=ok').status_code == 400


@pytest.mark.parametrize('bad', ['issuer','audience','expiry','nonce','algorithm'])
def test_google_id_token_validation_failures(bad):
    import asyncio
    import base64
    import jwt
    from cryptography.hazmat.primitives.asymmetric import rsa
    from bulkhead.auth import validate_google
    key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
    jwk=jwt.algorithms.RSAAlgorithm.to_jwk(key.public_key(),as_dict=True)
    jwk.update(kid='fixture',alg='RS256')
    now=int(time.time())
    claims={'iss':'https://accounts.google.com','aud':'fixture-client','sub':'subject','exp':now+300,'iat':now,'nonce':'nonce','email':'a@example.com','email_verified':True}
    if bad=='issuer': claims['iss']='https://evil.example'
    if bad=='audience': claims['aud']='wrong-client'
    if bad=='expiry': claims['exp']=now-60
    if bad=='nonce': claims['nonce']='wrong'
    encoded=jwt.encode(claims, 'deliberately-wrong-signing-key-32-characters' if bad=='algorithm' else key,algorithm='HS256' if bad=='algorithm' else 'RS256',headers={'kid':'fixture'})
    class Response:
        def __init__(self,data): self.data=data
        def raise_for_status(self): pass
        def json(self): return self.data
    client=AsyncMock()
    client.__aenter__.return_value=client
    client.post.return_value=Response({'id_token':encoded})
    client.get.return_value=Response({'keys':[jwk]})
    with patch.object(settings(),'google_client_id','fixture-client'), patch('bulkhead.auth.httpx.AsyncClient',return_value=client):
        with pytest.raises((ValueError,jwt.PyJWTError)):
            asyncio.run(validate_google('code',{'verifier':'pkce','nonce':'nonce'}))
        assert client.post.call_args.kwargs['data']['code_verifier']=='pkce'


def test_dev_login_and_options(client):
    opts = client.get(BASE+'/auth/options').json()
    assert opts['dev_enabled'] is True

    # Dev login creates user, sets session, and provisions default household
    res = client.post(BASE+'/auth/dev-login', json={'email': 'developer@test.local', 'role': 'Owner'})
    assert res.status_code == 200
    data = res.json()
    assert data['email'] == 'developer@test.local'
    assert 'csrf_token' in data
    assert 'set-cookie' in res.headers

    # User can access /auth/me and list the provisioned household
    client.headers['X-CSRF-Token'] = data['csrf_token']
    me = client.get(BASE+'/auth/me').json()
    assert me['email'] == 'developer@test.local'
    assert me['verified'] is True

    homes = client.get(BASE+'/households').json()
    assert len(homes) >= 1
    assert homes[0]['role'] == 'Owner'

    # When dev_localhost is disabled, dev-login must be forbidden
    with patch.object(settings(), 'dev_localhost', False):
        forbidden = client.post(BASE+'/auth/dev-login')
        assert forbidden.status_code == 403

