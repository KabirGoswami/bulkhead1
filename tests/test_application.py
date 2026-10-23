import json
import time
from datetime import datetime
from uuid import uuid4, UUID
import pytest
from sqlalchemy import select
from bulkhead.db import SessionLocal, Household, Incident, Action, Job, EventRecord, WorkerHealth, PolicyRecord
from bulkhead.service import tick, load_state
from bulkhead.worker import claim, process
from models import Device, HomeState, Account
from alert_model import Alert
from baseline import BaselineEngine
from events import AuthEvent, FlowEvent
from detector import DetectorEngine
from policy import PolicyEngine
from blast import get_reachable_nodes, traffic_allowed


def endpoint(home, path): return f'/api/v1/households/{home}{path}'


def advance(home):
    with SessionLocal.begin() as db:
        row=db.scalar(select(Household).where(Household.id==home).with_for_update())
        tick(db,row)


def test_stream_multiple_ticks_disconnect_replay_and_worker_health(client, owner):
    _, home=owner
    assert client.get('/api/v1/health').status_code == 503
    with SessionLocal.begin() as db: db.add(WorkerHealth(id=str(uuid4()),heartbeat=time.time()))
    assert client.get('/api/v1/health').status_code == 200
    with client.websocket_connect('ws://localhost:8080'+endpoint(home,'/events/ws'),headers={'Origin':'http://localhost:8080'}) as ws:
        initial=ws.receive_json()
        cursor=initial['sequence']
        for _ in range(3): advance(home)
        ticks=[]
        while len(ticks)<3:
            event=ws.receive_json()
            json.dumps(event)  # Real JSON stream includes timestamps across multiple ticks.
            if event['type']=='SIM_TICK': ticks.append(event)
        assert [t['sequence'] for t in ticks]==sorted(t['sequence'] for t in ticks)
    advance(home)  # No connected client can interrupt simulation.
    replay=client.get(endpoint(home,f'/events?after={cursor}')).json()
    assert len([e for e in replay if e['type']=='SIM_TICK'])==4
    with client.websocket_connect('ws://localhost:8080'+endpoint(home,f'/events/ws?after={ticks[-1]["sequence"]}'),headers={'Origin':'http://localhost:8080'}) as ws:
        assert ws.receive_json()['type']=='SIM_TICK'


def test_scenarios_persistent_actions_deduplication_undo_and_errors(client, owner):
    _, home=owner
    assert client.post(endpoint(home,'/scenarios/reset')).status_code == 200
    assert client.post(endpoint(home,'/scenarios/invalid')).status_code == 400
    assert client.post(endpoint(home,'/profile'),json={'profile':'invalid'}).status_code == 422
    assert client.post(endpoint(home,'/audit/fix'),json={'finding_id':'missing'}).status_code == 404
    assert client.post(endpoint(home,f'/actions/{uuid4()}/undo')).status_code == 404
    client.post(endpoint(home,'/scenarios/B'))
    advance(home)
    state=client.get(endpoint(home,'/state')).json()
    incident=next(i for i in state['incidents'] if 'NEW_GEO_LOGIN' in i['alert']['reason_codes'])
    assert incident['alert']['response']['action']=='REVOKE'
    body={'incident_id':incident['id'],'action':'REVOKE','command_id':str(uuid4()),'policy_revision':state['policy_revision']}
    first=client.post(endpoint(home,'/actions'),json=body)
    assert first.status_code == 201, first.text
    second=client.post(endpoint(home,'/actions'),json=body)
    assert first.json()['id']==second.json()['id']
    UUID(first.json()['id'])
    assert first.json()['execution_mode']=='simulation' and first.json()['state']=='verified'
    state=client.get(endpoint(home,'/state')).json()
    assert next(a for a in state['accounts'] if a['seed_key']=='camera_vendor_acc')['access_revoked']
    assert client.post(endpoint(home,f'/actions/{first.json()["id"]}/undo')).json()['state']=='rolled_back'
    assert not next(a for a in client.get(endpoint(home,'/state')).json()['accounts'] if a['seed_key']=='camera_vendor_acc')['access_revoked']
    assert client.patch(endpoint(home,f'/incidents/{incident["id"]}'),json={'status':'acknowledged'}).status_code == 200
    assert client.patch(endpoint(home,f'/incidents/{incident["id"]}'),json={'status':'resolved'}).status_code == 200
    history=client.get(endpoint(home,'/audit-events')).json()
    assert any(e['kind']=='action.rolled_back' and e['actor_id']==owner[0] for e in history)


def test_notify_only_and_stale_or_fabricated_actions_rejected(client, owner):
    _, home=owner
    state=client.get(endpoint(home,'/state')).json()
    device=next(d for d in state['devices'] if d['seed_key']=='thermostat')
    with SessionLocal.begin() as db:
        incident=Incident(household_id=home,node_id=device['id'],fingerprint='fixture',alert=Alert(id=str(uuid4()),node_id=device['id'],confidence='high',reason_codes=['VOLUME_SPIKE'],explanation='Fixture',timestamp=datetime.now()).model_dump(mode='json'))
        db.add(incident);db.flush();incident_id=incident.id
    body={'incident_id':incident_id,'action':'CONTAIN','command_id':str(uuid4()),'policy_revision':state['policy_revision']}
    assert client.post(endpoint(home,'/actions'),json=body).status_code == 409
    body['incident_id']=str(uuid4())
    assert client.post(endpoint(home,'/actions'),json=body).status_code == 404
    body['action']='RANDOM'
    assert client.post(endpoint(home,'/actions'),json=body).status_code == 422


def test_per_source_warmup_and_benign_vendor_update():
    baseline=BaselineEngine()
    for _ in range(100): baseline.process_event(FlowEvent(ts=datetime.now(),src='early',dst='known',port=443,bytes=100))
    for _ in range(100): baseline.process_event(AuthEvent(ts=datetime.now(),account_id='late',client='home',geo='Home',result='success'))
    assert baseline.get_baseline('late').is_learned
    assert DetectorEngine(baseline).analyze_event(AuthEvent(ts=datetime.now(),account_id='late',client='attacker',geo='Unknown',result='fail'))
    b=baseline.get_baseline('thermostat');b.finalize()
    assert DetectorEngine(baseline).analyze_event(FlowEvent(ts=datetime.now(),src='thermostat',dst='updates.google.com',port=443,bytes=2000000,verified_vendor_update=True)) is None


def test_containment_blocks_traffic_keeps_account_paths_and_profiles():
    def device(id, zone='iot', accounts=[]):
        return Device(id=id,name=id,type='plug',vendor='v',zone=zone,criticality='high',firmware_age_days=0,allowed_destinations=['*'],allowed_peers=[],account_ids=accounts)
    state=HomeState(devices=[device('router','main'),device('other','main',['account'])],accounts=[Account(id='account',name='account',mfa_enabled=True,password_strength='strong',linked_device_ids=['router','other'])])
    router=state.devices[0];router.account_ids=['account']
    alert=Alert(id=str(uuid4()),node_id='router',confidence='high',reason_codes=['x'],explanation='y',timestamp=datetime.now())
    policy=PolicyEngine()
    assert policy.determine_response(alert,state,'Work')['action']=='NOTIFY'
    alert.node_id='lock_1';state.devices.append(device('lock_1'))
    assert policy.determine_response(alert,state,'Solo')['requires_confirmation']
    alert.node_id='router'
    action=policy.execute_action(alert,'CONTAIN',state)
    assert not traffic_allowed(state,'router','other') and not traffic_allowed(state,'router','example.com')
    assert 'other' in get_reachable_nodes(state,'router')  # Account compromise remains explicit.
    state.accounts[0].access_revoked=True
    assert get_reachable_nodes(state,'router')=={'router'}
    assert policy.undo(action.id,state)


def test_inventory_policies_preview_expiry_audit_and_unknown_advisories(client, owner):
    _, home=owner
    state=client.get(endpoint(home,'/state')).json();device=state['devices'][0]
    body={'device_id':device['id'],'peers':[],'destinations':[],'expires_in':60,'policy_revision':state['policy_revision']}
    preview=client.post(endpoint(home,'/policies/preview'),json=body)
    assert preview.status_code==200 and 'after' in preview.json()
    policy=client.post(endpoint(home,'/policies'),json=body)
    assert policy.status_code==201
    assert client.post(endpoint(home,'/policies'),json=body).status_code==409
    with SessionLocal.begin() as db: db.get(PolicyRecord,policy.json()['id']).expires_at=time.time()-1
    advance(home)
    assert not client.get(endpoint(home,'/policies')).json()['policies'][0]['active']
    findings=client.get(endpoint(home,'/audit')).json()
    guidance=next(f for f in findings if f['fix_type']=='SPLIT_ACCOUNT')
    assert not guidance['executable']
    assert client.post(endpoint(home,'/audit/fix'),json={'finding_id':guidance['id']}).status_code==409
    fix=next(f for f in findings if f['fix_type']=='UPDATE_FIRMWARE')
    assert client.post(endpoint(home,'/audit/fix'),json={'finding_id':fix['id']}).status_code==200
    assert fix['id'] not in [f['id'] for f in client.get(endpoint(home,'/audit')).json()]
    assert client.get(endpoint(home,f'/integrations/advisories/{device["id"]}')).json()['status']=='unknown'
    new=client.post(endpoint(home,'/devices'),json={'name':'Unapproved','type':'plug','vendor':'Unknown'})
    assert new.status_code==201 and new.json()['approval']=='pending'
    UUID(new.json()['id'])


def test_worker_lease_restart_and_database_reconnect(client, owner):
    _, home=owner
    first, second=str(uuid4()),str(uuid4())
    job_id=claim(first)
    with SessionLocal.begin() as db:
        job=db.get(Job,job_id);job.lease_until=time.time()-1
    assert claim(second)==job_id
    process(job_id,second)
    process(job_id,first) # Old worker cannot complete a reclaimed job.
    from bulkhead.db import engine
    engine.dispose()
    state=client.get(endpoint(home,'/state')).json()
    assert state['tick']==1
    with SessionLocal() as db: assert db.get(Job,job_id).state=='complete'


def test_uuid_lateral_detection_vendor_commands_and_containment_expiry(client, owner):
    from bulkhead.db import DeviceRecord
    from simulator import HomeSimulator
    from events import VendorCommandEvent
    _, home=owner
    client.post(endpoint(home,'/scenarios/A'))
    advance(home)
    state=client.get(endpoint(home,'/state')).json()
    plug=next(d for d in state['devices'] if d['seed_key']=='plug_1')
    assert plug['isolated']
    assert any('FIRST_LATERAL_CONNECTION' in i['alert']['reason_codes'] for i in state['incidents'])
    action=next(a for a in state['actions'] if a['node_id']==plug['id'])
    with SessionLocal.begin() as db: db.get(Action,action['id']).expires_at=time.time()-1
    client.post(endpoint(home,'/scenarios/reset'))
    advance(home)
    state=client.get(endpoint(home,'/state')).json()
    assert not next(d for d in state['devices'] if d['id']==plug['id'])['isolated']
    assert next(a for a in state['actions'] if a['id']==action['id'])['state']=='rolled_back'
    with SessionLocal.begin() as db:
        domain=load_state(db,db.get(Household,home))
        simulator=HomeSimulator(domain);simulator.current_scenario='B';simulator.tick_count=4
        assert any(isinstance(e,VendorCommandEvent) for e in simulator.generate_tick())
        for account in domain.accounts: account.access_revoked=True
        simulator.tick_count=4
        assert not any(isinstance(e,VendorCommandEvent) for e in simulator.generate_tick())
