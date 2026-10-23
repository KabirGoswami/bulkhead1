import time
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4
import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import select, func
from bulkhead.db import SessionLocal, PhantomEvent, PhantomActuator
from bulkhead.phantom.schemas import SensorEvent
from bulkhead.phantom.ingress import fixture, ingest, write_home
from bulkhead.phantom.verifier import assess


def event(home, **overrides):
    return SensorEvent(event_id=overrides.pop('event_id', uuid4()), household_id=home,
                       device_id=overrides.pop('device_id', 'door_contact'), sequence=overrides.pop('sequence', 1),
                       observed_at=overrides.pop('observed_at', time.time()), kind=overrides.pop('kind', 'door.open'), **overrides)


def accept(owner, message):
    with SessionLocal.begin() as db:
        home = write_home(db, owner[1], owner[0])
        fixture(db, home)
        row = ingest(db, home, message)
        return row.verdict, row.reason


def test_ingress_fresh_replay_sequence_and_no_actuation(owner):
    message = event(owner[1])
    assert accept(owner, message)[0] == 'ACCEPTED'
    assert accept(owner, message)[1] == 'DUPLICATE_EVENT_ID'
    assert accept(owner, event(owner[1]))[1] == 'STALE_SEQUENCE'
    assert accept(owner, event(owner[1], device_id='forged'))[1] == 'UNREGISTERED_SIMULATED_SOURCE'
    assert accept(owner, event(owner[1], sequence=2, observed_at=time.time()-31))[1] == 'CLOCK_SKEW_OR_STALE'
    with SessionLocal() as db:
        assert db.get(PhantomActuator, (owner[1], 'entry_lock')).state == 'locked'
        assert db.get(PhantomActuator, (owner[1], 'hallway_light')).executions == 0


def test_invalid_household_and_malformed(owner):
    with pytest.raises(HTTPException):
        accept(owner, event(uuid4()))
    for change in ({'kind': 'raw.video'}, {'sequence': -1}, {'sequence': True}, {'observed_at': float('nan')}, {'attributes': {'secret': 'no'}}):
        with pytest.raises(ValidationError):
            event(owner[1], **change)


def test_concurrent_duplicate_attempts(owner):
    message = event(owner[1])
    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(lambda _: accept(owner, message), range(2)))
    assert sorted(x[0] for x in outcomes) == ['ACCEPTED', 'REJECTED']
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(PhantomEvent).where(PhantomEvent.accepted_id == str(message.event_id))) == 1


@pytest.mark.parametrize('mode,expected', [('normal', 'VERIFIED'), ('missing', 'UNKNOWN'),
    ('offline', 'UNKNOWN'), ('contradiction', 'INCONSISTENT'), ('old_lock', 'UNKNOWN'), ('late', 'VERIFIED')])
def test_correlation_causality_missing_offline_and_late(owner, mode, expected):
    with SessionLocal.begin() as db:
        home = write_home(db, owner[1], owner[0]); config = fixture(db, home)
        now = time.time()
        door = ingest(db, home, event(home.id, observed_at=now), now=now)
        assert assess(db, home, door, config, now=now).state == 'UNKNOWN'
        if mode in ('normal', 'late'):
            ingest(db, home, event(home.id, device_id='hallway_motion', kind='motion.detected', observed_at=now+1), now=now+(12 if mode == 'late' else 1))
        elif mode in ('contradiction', 'old_lock'):
            ingest(db, home, event(home.id, device_id='lock_sensor', kind='lock.locked', observed_at=now-(1 if mode == 'old_lock' else 0)), now=now)
        elif mode == 'offline':
            ingest(db, home, event(home.id, device_id='hallway_motion', kind='sensor.offline', observed_at=now), now=now)
        result = assess(db, home, door, config, now=now+12)
        assert result.state == expected
        if mode == 'offline':
            assert result.evidence['offline_sensor_ids'] == ['hallway_motion']


def test_evidence_partition_and_preceding_motion(owner):
    from bulkhead.db import Household
    with SessionLocal.begin() as db:
        home = write_home(db, owner[1], owner[0]); config = fixture(db, home)
        other = Household(name='Other home'); db.add(other); db.flush(); fixture(db, other)
        now = time.time()
        door = ingest(db, home, event(home.id, observed_at=now), now=now)
        ingest(db, other, event(other.id, device_id='hallway_motion', kind='motion.detected', observed_at=now+1), now=now+1)
        ingest(db, home, event(home.id, device_id='hallway_motion', kind='motion.detected', observed_at=now-1), now=now)
        assert assess(db, home, door, config, now=now+12).state == 'UNKNOWN'


def url(owner, suffix):
    return f'/api/v1/households/{owner[1]}/phantom{suffix}'


def command(client, owner, **overrides):
    return client.post(url(owner, '/commands'), json={'command_key': str(uuid4()),
        'target': 'entry_lock', 'command': 'unlock', **overrides})


def locked(owner):
    with SessionLocal() as db:
        return db.get(PhantomActuator, (owner[1], 'entry_lock')).state == 'locked'


def test_hold_approve_exactly_once_and_manual_light(client, owner):
    key = str(uuid4())
    response = command(client, owner, command_key=key)
    assert response.status_code == 200, response.text
    row = response.json()
    assert row['decision'] == 'HOLD' and locked(owner)
    assert command(client, owner, command_key=key).json()['id'] == row['id']
    path = url(owner, f'/approvals/{row["approval"]["id"]}/decision')
    assert client.post(path, json={'decision': 'approve', 'payload': {'target': 'other'}}).status_code == 422
    assert locked(owner)
    assert client.post(path, json={'decision': 'approve'}).json()['decision'] == 'ALLOW'
    assert client.post(path, json={'decision': 'approve'}).json()['decision'] == 'ALLOW'
    with SessionLocal() as db:
        assert db.get(PhantomActuator, (owner[1], 'entry_lock')).executions == 1
    assert command(client, owner, command_key=key, target='hallway_light', command='turn_on').status_code == 409
    assert command(client, owner, target='hallway_light', command='turn_on').json()['decision'] == 'ALLOW'


@pytest.mark.parametrize('invalidate,reason', [('expiry','APPROVAL_EXPIRED'), ('revision','POLICY_REVISION_CHANGED'),
    ('home_revision','POLICY_REVISION_CHANGED'), ('binding','ACTION_BINDING_CHANGED'), ('freshness','RECENT_LOGIN_REQUIRED')])
def test_invalid_approval_does_not_mutate(client, owner, invalidate, reason):
    from bulkhead.db import PhantomApproval, PhantomConfig, PhantomDecision, SessionRecord, Household
    row = command(client, owner).json()
    with SessionLocal.begin() as db:
        grant = db.get(PhantomApproval, row['approval']['id'])
        if invalidate == 'expiry': grant.expires_at = time.time()-1
        elif invalidate == 'revision': db.get(PhantomConfig, owner[1]).revision += 1
        elif invalidate == 'home_revision': db.get(Household, owner[1]).policy_revision += 1
        elif invalidate == 'binding': db.get(PhantomDecision, row['id']).payload = {'different': True}
        elif invalidate == 'freshness': db.get(SessionRecord, grant.session_id).authenticated_at = time.time()-601
    result = client.post(url(owner, f'/approvals/{row["approval"]["id"]}/decision'), json={'decision':'approve'})
    assert result.status_code == 200, result.text
    assert result.json()['decision'] == 'DENY' and result.json()['reason'] == reason and locked(owner)


@pytest.mark.parametrize('invalidate', ['viewer', 'revoked', 'guest_expired', 'logout'])
def test_role_session_and_membership_rechecked(client, owner, invalidate):
    from bulkhead.db import Membership
    row = command(client, owner).json()
    if invalidate == 'logout':
        assert client.post('/api/v1/auth/logout').status_code == 200
    else:
        with SessionLocal.begin() as db:
            member = db.scalar(select(Membership).where(Membership.household_id == owner[1], Membership.user_id == owner[0]))
            if invalidate == 'viewer': member.role = 'Viewer'
            elif invalidate == 'revoked': db.delete(member)
            else: member.expires_at = time.time()-1
    result = client.post(url(owner, f'/approvals/{row["approval"]["id"]}/decision'), json={'decision':'approve'})
    assert result.status_code in (401, 403, 404) and locked(owner)


def test_cross_home_csrf_and_forged_approval(client, owner):
    row = command(client, owner).json()
    other = client.post('/api/v1/households', json={'name':'Other'}).json()['id']
    assert client.post(url((owner[0], other), f'/approvals/{row["approval"]["id"]}/decision'), json={'decision':'approve'}).status_code == 404
    assert command(client, owner, approved=True).status_code == 422
    assert client.post(url(owner, '/commands'), json={'command_key':str(uuid4()), 'target':'entry_lock', 'command':'unlock'}, headers={'X-CSRF-Token':'wrong'}).status_code == 403
    assert command(client, owner, target='entry_lock', command='turn_on').status_code == 422
    assert locked(owner)


def test_rejected_ingress_cannot_authorize_routine_or_protected_command(client, owner):
    with SessionLocal.begin() as db:
        home = write_home(db, owner[1], owner[0]); config = fixture(db, home)
        rejected = ingest(db, home, event(home.id, device_id='forged'))
        evidence = assess(db, home, rejected, config); evidence_id = evidence.id
    for target, action in [('hallway_light','turn_on'), ('entry_lock','unlock')]:
        result = command(client, owner, target=target, command=action, assessment_id=evidence_id).json()
        assert result['decision'] == 'DENY'
    assert locked(owner)


@pytest.mark.parametrize('scenario,verdict', [('normal_entry','ALLOW'), ('compromised_sensor','HOLD'),
    ('replay','DENY'), ('forged_sender','DENY'), ('owner_approval','HOLD'), ('sensor_dropout','ALLOW')])
def test_six_deterministic_demos_and_sandbox(client, owner, scenario, verdict):
    from bulkhead.db import Household
    body = {'scenario': scenario, 'command_key':str(uuid4())}
    response = client.post(url(owner, '/demo/run'), json=body)
    assert response.status_code == 200, response.text
    run = response.json()
    assert client.post(url(owner, '/demo/run'), json=body).json() == run
    overview = client.get(url(owner, '/overview')).json()
    decisions = [d for d in overview['decisions'] if d['id'] in run['decision_ids']]
    assert any(d['decision'] == verdict for d in decisions)
    assert run['protected_outcome_at_run']['entry_lock'] == 'locked'
    if scenario not in ('normal_entry', 'sensor_dropout'):
        assert run['sandbox_outcome']['entry_lock'] == 'unlocked'
    else:
        assert run['protected_outcome_at_run']['hallway_light'] == 'on'
        assert run['metrics']['false_positive_count'] == 0
    if scenario == 'sensor_dropout':
        assert overview['assessments'][0]['state'] == 'UNKNOWN'
    if scenario == 'compromised_sensor':
        assert overview['assessments'][0]['state'] == 'INCONSISTENT'
    with SessionLocal() as db:
        assert db.get(Household, owner[1]).simulation['tick'] == 0
    events = client.get(f'/api/v1/households/{owner[1]}/events').json()
    assert any(e['type'] == 'PHANTOM_UPDATE' for e in events)
    assert all('supporting_event_ids' not in e['payload'] for e in events)


def test_reset_privacy_retention_preserves_replay_tombstones(client, owner):
    from bulkhead.db import PhantomAssessment, PhantomSensor
    msg = event(owner[1]); accept(owner, msg)
    with SessionLocal.begin() as db:
        row = db.scalar(select(PhantomEvent).where(PhantomEvent.accepted_id == str(msg.event_id)))
        row.received_at = time.time()-86400*8
        home = write_home(db, owner[1], owner[0]); config = fixture(db, home)
        evidence = assess(db, home, row, config); evidence.created_at = row.received_at
    pending = command(client, owner).json()
    assert client.patch(url(owner, '/privacy'), json={'retention_days':1}).status_code == 200
    with SessionLocal() as db:
        row = db.scalar(select(PhantomEvent).where(PhantomEvent.accepted_id == str(msg.event_id)))
        assert row.kind is None and row.observed_at is None
        assert db.scalar(select(PhantomAssessment)).evidence == {}
    assert accept(owner, msg)[1] == 'DUPLICATE_EVENT_ID'
    assert client.post(url(owner, '/demo/reset')).status_code == 200
    assert client.post(url(owner, f'/approvals/{pending["approval"]["id"]}/decision'), json={'decision':'approve'}).status_code == 409
    assert locked(owner)
    with SessionLocal() as db:
        assert db.get(PhantomSensor, (owner[1], 'door_contact')).last_sequence == 1


def test_concurrent_approval_and_disabled_rule(client, owner):
    row = command(client, owner).json()
    path = url(owner, f'/approvals/{row["approval"]["id"]}/decision')
    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(lambda _: client.post(path, json={'decision':'approve'}), range(2)))
    assert [r.status_code for r in outcomes] == [200, 200]
    with SessionLocal() as db:
        assert db.get(PhantomActuator, (owner[1], 'entry_lock')).executions == 1
    rules = client.get(url(owner, '/rules')).json()
    assert client.post(url(owner, '/rules'), json={'revision':rules['revision'], 'target':'entry_lock', 'enabled':False}).status_code == 200
    assert command(client, owner).json()['decision'] == 'DENY'
    assert client.post(url(owner, '/rules'), json={'revision':rules['revision'], 'target':'entry_lock', 'enabled':True}).status_code == 409


def test_other_admin_cannot_approve_requester_action(client, owner):
    from fastapi.testclient import TestClient
    from app import app
    from conftest import sign_in
    from bulkhead.db import Membership
    row = command(client, owner).json()
    with TestClient(app, base_url='http://localhost:8080', headers={'Origin':'http://localhost:8080'}) as other:
        other.headers['X-CSRF-Token'] = other.get('/api/v1/auth/csrf').json()['csrf_token']
        admin = sign_in(other, 'admin@example.com')
        assert other.get(url(owner, '/overview')).status_code == 404
        with SessionLocal.begin() as db:
            db.add(Membership(household_id=owner[1], user_id=admin, role='Admin'))
        assert other.post(url(owner, f'/approvals/{row["approval"]["id"]}/decision'), json={'decision':'approve'}).status_code == 403
    assert locked(owner)


def test_late_bus_event_appends_assessment_without_actuation(owner):
    from bulkhead.db import PhantomAssessment
    with SessionLocal.begin() as db:
        home = write_home(db, owner[1], owner[0]); config = fixture(db, home)
        now = time.time()
        door = ingest(db, home, event(home.id, observed_at=now), now=now)
        assert assess(db, home, door, config, now=now).state == 'UNKNOWN'
        ingest(db, home, event(home.id, device_id='hallway_motion', kind='motion.detected', observed_at=now+1), now=now+12)
        latest = db.scalar(select(PhantomAssessment).order_by(PhantomAssessment.created_at.desc()))
        assert latest.state == 'VERIFIED'
        assert db.get(PhantomActuator, (home.id, 'entry_lock')).executions == 0


def test_concurrent_command_key_and_new_session_cannot_reuse_challenge(client, owner):
    row = command(client, owner).json()
    client.post('/api/v1/auth/logout')
    client.headers['X-CSRF-Token'] = client.get('/api/v1/auth/csrf').json()['csrf_token']
    logged = client.post('/api/v1/auth/login', json={'email':'owner@example.com', 'password':'correct horse battery staple'})
    client.headers['X-CSRF-Token'] = logged.json()['csrf_token']
    assert client.post(url(owner, f'/approvals/{row["approval"]["id"]}/decision'), json={'decision':'approve'}).status_code == 403
    assert locked(owner)
    key = str(uuid4())
    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(lambda _: command(client, owner, command_key=key, target='hallway_light', command='turn_on'), range(2)))
    assert [r.status_code for r in outcomes] == [200,200]
    assert outcomes[0].json()['id'] == outcomes[1].json()['id']
    with SessionLocal() as db:
        assert db.get(PhantomActuator, (owner[1], 'hallway_light')).executions == 1


def test_viewer_read_only_and_other_home_evidence(client, owner):
    from bulkhead.db import Membership
    client.post(url(owner, '/demo/run'), json={'scenario':'normal_entry','command_key':str(uuid4())})
    overview = client.get(url(owner, '/overview')).json()
    other = client.post('/api/v1/households', json={'name':'Other'}).json()['id']
    assert command(client, (owner[0],other), assessment_id=overview['assessments'][0]['id']).status_code == 404
    with SessionLocal.begin() as db:
        db.scalar(select(Membership).where(Membership.household_id == owner[1], Membership.user_id == owner[0])).role = 'Viewer'
    assert client.get(url(owner, '/overview')).status_code == 200
    for suffix, payload in [('/demo/run', {'scenario':'normal_entry','command_key':str(uuid4())}),
                            ('/demo/reset', None), ('/rules', {'revision':1,'target':'entry_lock','enabled':True})]:
        assert client.post(url(owner,suffix),json=payload).status_code == 403
    assert client.patch(url(owner,'/privacy'),json={'retention_days':1}).status_code == 403
    assert command(client, owner).status_code == 403
