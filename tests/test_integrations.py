import json
import time
from unittest.mock import AsyncMock, patch
from uuid import uuid4
from sqlalchemy import select
from bulkhead.db import SessionLocal, Household, Incident, Job, Action, Agent, AdvisoryCache
from bulkhead.service import tick
from bulkhead.config import settings
from bulkhead.security import token_new
from bulkhead.worker import iteration
from alert_model import Alert
from datetime import datetime


def ep(home, path): return f'/api/v1/households/{home}{path}'


def test_email_queue_dedup_preferences_and_delivery_failure(client, owner):
    _, home=owner
    client.post(ep(home,'/scenarios/B'))
    with SessionLocal.begin() as db: tick(db,db.get(Household,home))
    with SessionLocal() as db:
        first=list(db.scalars(select(Job).where(Job.kind=='email',Job.household_id==home)))
        assert first
        count=len(first)
    with SessionLocal.begin() as db: tick(db,db.get(Household,home))
    with SessionLocal() as db:
        assert len(list(db.scalars(select(Job).where(Job.kind=='email',Job.household_id==home))))==count
        job_id=db.scalar(select(Job.id).where(Job.kind=='email',Job.household_id==home))
    with SessionLocal.begin() as db:
        for job in db.scalars(select(Job)):
            job.available_at=time.time()+3600
        db.get(Job,job_id).available_at=time.time()-1
    with patch('bulkhead.worker.send_email',side_effect=OSError('SMTP unavailable')):
        iteration(str(uuid4()))
    with SessionLocal() as db:
        assert db.get(Job,job_id).state=='pending'
        assert db.get(Job,job_id).error=='OSError'
    assert client.patch(ep(home,'/preferences'),json={'email_notifications':False}).status_code==200
    assert client.get(ep(home,'/state')).status_code==200


def test_nvd_requires_exact_identity_and_caches_without_claiming_safety(client, owner):
    _, home=owner
    device=client.get(ep(home,'/state')).json()['devices'][0]
    body={**device,'firmware_version':'1.2.3','product_cpe':'cpe:2.3:o:example:router:1.2.3:*:*:*:*:*:*:*'}
    assert client.put(ep(home,f'/devices/{device["id"]}'),json=body).status_code==200
    class Response:
        def raise_for_status(self): pass
        def json(self): return {'totalResults':0,'vulnerabilities':[]}
    http=AsyncMock();http.__aenter__.return_value=http;http.get.return_value=Response()
    with patch('bulkhead.integrations.httpx.AsyncClient',return_value=http):
        result=client.get(ep(home,f'/integrations/advisories/{device["id"]}'))
        assert result.status_code==200 and result.json()['status']=='unknown'
        second=client.get(ep(home,f'/integrations/advisories/{device["id"]}'))
        assert second.json()['cached'] and http.get.call_count==1
        assert http.get.call_args.kwargs['params']['cpeName']==body['product_cpe']


def test_scoped_gateway_enrollment_dry_run_and_explicit_confirmation(client, owner):
    _, home=owner
    state=client.get(ep(home,'/state')).json()
    plug=next(d for d in state['devices'] if d['seed_key']=='plug_1')
    assert client.put(ep(home,f'/devices/{plug["id"]}'),json={**plug,'trusted_ipv4':'192.168.10.10','trusted_mac':'02:00:00:00:10:10'}).status_code==200
    with SessionLocal.begin() as db:
        alert=Alert(id=str(uuid4()),node_id=plug['id'],confidence='high',reason_codes=['FIRST_LATERAL_CONNECTION'],explanation='Fixture',timestamp=datetime.now())
        incident=Incident(household_id=home,node_id=plug['id'],fingerprint='lab',alert=alert.model_dump(mode='json'))
        db.add(incident);db.flush();incident_id=incident.id
    token=client.post(ep(home,'/integrations/gateway/enrollment')).json()['enrollment_token']
    enrolled=client.post('/api/v1/gateway/enroll',json={'enrollment_token':token})
    assert enrolled.status_code==201
    assert client.post('/api/v1/gateway/enroll',json={'enrollment_token':token}).status_code==400
    agent=enrolled.json()
    assert client.get('/api/v1/gateway/jobs').status_code==401
    headers={'Authorization':'Bearer '+agent['credential']}
    assert client.post('/api/v1/gateway/heartbeat',json={},headers=headers).status_code==200
    body={'incident_id':incident_id,'agent_id':agent['agent_id'],'device_id':plug['id'],'command_id':str(uuid4()),'policy_revision':client.get(ep(home,'/state')).json()['policy_revision'],'confirmation':'wrong'}
    assert client.post(ep(home,'/integrations/gateway/actions'),json=body).status_code==422
    body['confirmation']='QUARANTINE '+plug['id']
    planned=client.post(ep(home,'/integrations/gateway/actions'),json=body)
    assert planned.status_code==201,planned.text
    assert planned.json()['execution_mode']=='dry_run' and planned.json()['state']=='planned'
    job_id=planned.json()['id']
    jobs=client.get('/api/v1/gateway/jobs',headers=headers).json()
    assert jobs[0]['id']==job_id
    assert client.post(f'/api/v1/gateway/jobs/{job_id}/results',headers=headers,json={'state':'verified','router_state':'blocked','packet_verified':False,'detail':'bad'}).status_code==422
    assert client.post(f'/api/v1/gateway/jobs/{job_id}/results',headers=headers,json={'state':'verified','router_state':'unchanged','packet_verified':False,'detail':'Dry-run verified'}).status_code==200
    assert not next(d for d in client.get(ep(home,'/state')).json()['devices'] if d['id']==plug['id'])['isolated']
    client.delete(ep(home,f'/integrations/gateway/agents/{agent["agent_id"]}'))
    assert client.get('/api/v1/gateway/jobs',headers=headers).status_code==401


def test_gateway_agent_dry_run_never_requests_mutation(tmp_path, monkeypatch):
    from gateway.agent import Agent as GatewayAgent
    monkeypatch.setenv('BULKHEAD_AGENT_CREDENTIAL','independent-agent-secret')
    hosts=tmp_path/'known_hosts';hosts.write_text('pinned-host-fixture')
    mapping={'device_id':str(uuid4()),'ipv4':'192.168.10.10','mac':'02:00:00:00:10:10'}
    config={'app_origin':'http://localhost:8080','known_hosts':str(hosts),'journal':str(tmp_path/'journal.json'),'mapping':mapping}
    agent=GatewayAgent(config)
    calls=[]
    def router(op,job):
        calls.append(op)
        return {'router_state':'unchanged' if op=='dry_run' else 'restored'}
    agent.router=router
    agent.api=lambda *a,**kw: {}
    job={'id':str(uuid4()),'execution_mode':'dry_run','action_type':'QUARANTINE','mapping':mapping}
    agent.execute(job)
    assert calls==['status','dry_run','status']
    assert json.loads((tmp_path/'journal.json').read_text())[job['id']]['result']['router_state']=='unchanged'
