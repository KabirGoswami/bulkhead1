import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, DoorOpen, Lightbulb, LockKeyhole, Play, ShieldCheck } from 'lucide-react';
import { api, errorText } from '../lib/api';
import { useBulkhead, useSession } from '../lib/session';
import '../styles/phantom.css';

type SensorEvent = { id: string; device_id: string; kind: string | null; sequence: number | null; verdict: string; reason: string; observed_at: number; received_at: number };
type Assessment = { id: string; trigger_id: string; state: string; explanation: string; confidence: string; risk_score: number; supporting_event_ids: string[]; conflicting_event_ids: string[]; missing_sensor_ids: string[]; offline_sensor_ids: string[]; reason_codes: string[]; run_id: string; expires_at: number };
type Decision = { id: string; target: string; command: string; decision: string; reason: string; assessment_id: string | null; policy_revision: number; executed_at: number | null; created_at: number; latency_ms: number; approval: { id: string; expires_at: number; consumed_at: number | null; can_confirm: boolean; outcome: string | null } | null };
type Run = { id: string; scenario: string; protected_outcome_at_run: Record<string, string>; sandbox_outcome: Record<string, string>; comparison_note: string; metrics: { accepted_events: number; rejected_events: number; unsafe_actions_prevented: number; false_positive_count: number; benign_fixture_count: number; legitimate_automations_allowed: number; approval_requests: number; p50_ms: number; p95_ms: number } };
type Overview = { server_time: number; revision: number; window_seconds: number; rules: Record<string, boolean>; privacy: { retention_days: number }; capabilities: { execution_mode: string; physical_protection: boolean }; sensors: { id: string; location: string; online: boolean }[]; actuators: { id: string; state: string; executions: number }[]; events: SensorEvent[]; assessments: Assessment[]; decisions: Decision[]; runs: Run[] };

const scenarios = [
  ['normal_entry', 'Normal entry', 'Nearby motion supports a door event. The hallway light turns on without a prompt.'],
  ['compromised_sensor', 'Compromised sensor', 'A registered door sensor disagrees with the bolt sensor. The virtual unlock is held.'],
  ['replay', 'Replayed message', 'Resend an accepted message. The repeated event cannot unlock the virtual door.'],
  ['forged_sender', 'Unregistered sender', 'An unknown source reports a door event. Ingress rejects the message.'],
  ['owner_approval', 'Owner approval', 'Review one exact virtual unlock. Confirming twice executes it once.'],
  ['sensor_dropout', 'Benign sensor dropout', 'Motion is offline. Evidence stays unknown; ordinary lighting still works.'],
] as const;
const names: Record<string, string> = { door_contact: 'Door contact', hallway_motion: 'Hallway motion', lock_sensor: 'Interlocked bolt', presence_sensor: 'Person presence', hallway_light: 'Hallway light', entry_lock: 'Virtual entry lock' };
const name = (id: string) => names[id] || id;
const words = (text: string) => text.toLowerCase().replaceAll('_', ' ');
function Badge({ value }: { value: string }) { return <span className={`phantom-badge phantom-badge--${value.toLowerCase()}`}>{words(value)}</span>; }

export default function PhantomPage() {
  const { path, canWrite, stream } = useBulkhead();
  const { home } = useSession();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [scenario, setScenario] = useState<string>('compromised_sensor');
  const [selected, setSelected] = useState('');
  const [review, setReview] = useState('');
  const [now, setNow] = useState(Date.now() / 1000);
  const clockOffset = useRef(0);
  const request = useRef<AbortController | null>(null);
  const mutation = useRef<AbortController | null>(null);
  const keys = useRef(new Map<string, string>());
  const active = useRef(true);
  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    const timeout = setTimeout(() => controller.abort('timeout'), 12000);
    try {
      const next = await api<Overview>(path('/phantom/overview'), { signal: controller.signal });
      if (!controller.signal.aborted && active.current) {
        clockOffset.current = next.server_time - Date.now()/1000;
        setNow(next.server_time);
        setData(next); setError('');
      }
    } catch (err) {
      if (active.current && (!controller.signal.aborted || controller.signal.reason === 'timeout')) {
        setError(controller.signal.reason === 'timeout' ? 'The request timed out. Refresh to check server state.' : errorText(err));
        if (err && typeof err === 'object' && 'status' in err && [401, 403, 404].includes(Number(err.status))) setData(null);
      }
    } finally { clearTimeout(timeout); }
  }, [path]);
  useEffect(() => {
    active.current = true; load();
    const update = (event: Event) => { if ((event as CustomEvent).detail === home?.id) load(); };
    window.addEventListener('bulkhead:phantom', update);
    const poll = setInterval(load, 10000);
    const clock = setInterval(() => setNow(Date.now()/1000 + clockOffset.current), 1000);
    return () => { active.current = false; request.current?.abort(); mutation.current?.abort(); clearInterval(poll); clearInterval(clock); window.removeEventListener('bulkhead:phantom', update); };
  }, [load, home?.id]);

  const mutate = async (suffix: string, body?: Record<string, unknown>, method = 'POST', keyName?: string) => {
    if (mutation.current || !canWrite) return;
    const controller = new AbortController(); mutation.current = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    setBusy(true); setError(''); setNotice('');
    if (keyName && !keys.current.has(keyName)) keys.current.set(keyName, crypto.randomUUID());
    try {
      const result = await api<{ decision?: string; reason?: string; message?: string }>(path(`/phantom${suffix}`), {
        method, signal: controller.signal,
        body: body ? JSON.stringify({ ...body, ...(keyName ? { command_key: keys.current.get(keyName) } : {}) }) : undefined,
      });
      if (!active.current) return;
      if (keyName) keys.current.delete(keyName);
      setSelected(''); setReview('');
      setNotice(result.decision ? `Server decision: ${words(result.decision)}. ${words(result.reason || '')}.` : result.message || 'Saved in this household.');
      await load();
    } catch (err) {
      if (active.current) setError(controller.signal.aborted ? 'Response timed out. Refresh to see whether it committed; retrying uses the same request key.' : errorText(err));
    } finally { clearTimeout(timeout); mutation.current = null; if (active.current) setBusy(false); }
  };
  const run = data?.runs[0];
  const evidence = data?.assessments.find(a => a.id === selected) || data?.assessments.find(a => !run || a.run_id === run.id);
  const trigger = data?.events.find(e => e.id === evidence?.trigger_id);
  const decisions = data?.decisions.filter(d => d.reason !== 'FIXTURE_INITIALIZATION') || [];

  return <div className="phantom-page">
    <div className="phantom-status"><span><ShieldCheck size={17} />{data?.capabilities.execution_mode === 'simulation' ? 'Simulation only' : 'Loading capabilities'}</span><p>Server-enforced decisions for virtual devices. {data?.capabilities.physical_protection === false && 'No physical locks or cameras are controlled.'}</p><small>{stream}</small></div>
    {error && <div role="alert" className="app-error">{error} <button className="app-link" onClick={load}>Refresh</button></div>}
    {notice && <p role="status" className="app-notice">{notice}</p>}
    {!data ? <p role="status">{error ? 'Evidence is unavailable.' : 'Loading this household’s reality checks…'}</p> : <>
      <div className="phantom-workbench">
        <section className="phantom-lab" aria-labelledby="phantom-demo-title">
          <h2 id="phantom-demo-title">Try the entrance fixture</h2><p>Each run resets PHANTOM’s virtual fixture and cancels its pending approvals.</p>
          <div className="phantom-scenarios">{scenarios.map(([id, title], i) => <button key={id} aria-pressed={scenario === id} onClick={() => setScenario(id)} disabled={busy}><span>{i+1}</span>{title}</button>)}</div>
          <p>{scenarios.find(s => s[0] === scenario)?.[2]}</p>
          <div className="app-row"><button className="app-button" disabled={busy || !canWrite} onClick={() => mutate('/demo/run', { scenario }, 'POST', `demo:${scenario}`)}><Play size={14} />{busy ? 'Working…' : 'Run scenario'}</button><button className="app-link" disabled={busy || !canWrite} onClick={() => mutate('/demo/reset')}>Reset fixture</button></div>
          {!canWrite && <p>Viewer access: inspect evidence and outcomes. An Owner or Admin must run scenarios or approve actions.</p>}
        </section>
        <section className="phantom-evidence" aria-labelledby="phantom-evidence-title">
          <div className="phantom-section-title"><h2 id="phantom-evidence-title">From message to reality check</h2>{evidence && <Badge value={evidence.state} />}</div>
          {!evidence ? <div className="phantom-empty"><DoorOpen size={38} /><h3>{run?.scenario === 'owner_approval' ? 'A manual command needs your approval' : 'A source can be authentic and still be wrong'}</h3><p>{run?.scenario === 'owner_approval' ? 'Review the exact virtual unlock in the decision timeline below. This request has no sensor claim.' : 'Run a scenario to inspect the source, freshness and independent signals.'}</p></div> : <>
            <ol className="phantom-chain"><li><span>1. Message</span><strong>{trigger ? name(trigger.device_id) : 'Retained assessment'}</strong><p>{trigger?.kind || 'Metadata expired'}</p></li><li><span>2. Identity & freshness</span><strong>{trigger?.verdict === 'ACCEPTED' ? 'Simulator source accepted' : 'Ingress rejected'}</strong><p>{words(trigger?.reason || 'metadata unavailable')}</p></li><li><span>3. Physical context</span><strong>{evidence.confidence}</strong><p>{data.window_seconds}s correlation window</p></li></ol>
            <p className="phantom-explanation">{evidence.explanation}</p>
            <div className="phantom-sensor-list">{data.sensors.map(sensor => {
              const agrees = evidence.supporting_event_ids.some(id => data.events.find(e => e.id === id)?.device_id === sensor.id);
              const conflicts = evidence.conflicting_event_ids.some(id => data.events.find(e => e.id === id)?.device_id === sensor.id);
              const offline = evidence.offline_sensor_ids.includes(sensor.id);
              return <div key={sensor.id}><Activity size={15} /><span>{name(sensor.id)}<small>{sensor.location}</small></span><strong className={conflicts ? 'phantom-conflict' : ''}>{sensor.id === trigger?.device_id ? 'Message sender' : conflicts ? 'Conflicting report' : agrees ? 'Supports entry' : offline ? 'Offline; no evidence' : 'No corroborating report'}</strong></div>;
            })}</div>
            <p className="app-muted">Risk heuristic: {evidence.risk_score}/100. A fixed rule score, not an attack probability. Authentication does not establish sensor truth.</p>
            <details className="phantom-details"><summary>Evidence IDs and reason codes</summary><p>{evidence.reason_codes.join(' · ')}</p><p>Trigger attempt: {evidence.trigger_id}</p><p>Supporting: {evidence.supporting_event_ids.join(', ') || 'none'}</p><p>Conflicting: {evidence.conflicting_event_ids.join(', ') || 'none'}</p><p>Missing sensors: {evidence.missing_sensor_ids.map(name).join(', ') || 'none'}</p>{trigger && <p>Observed {new Date(trigger.observed_at*1000).toLocaleTimeString()} · received {new Date(trigger.received_at*1000).toLocaleTimeString()} · accepted sequence {trigger.sequence ?? 'none'}</p>}</details>
          </>}
          {data.assessments.length > 1 && <label className="phantom-history-select">Inspect an assessment<select value={evidence?.id || ''} onChange={e => setSelected(e.target.value)}><option value="">Latest run</option>{data.assessments.map(a => <option key={a.id} value={a.id}>{words(a.state)} — {data.events.find(e => e.id === a.trigger_id)?.kind || 'retained event'} — {a.id.slice(0,8)}</option>)}</select></label>}
        </section>
      </div>

      <section className="phantom-actuators" aria-label="Current virtual actuator state"><h2>Current virtual state</h2>{data.actuators.length ? data.actuators.map(a => <div key={a.id}>{a.id === 'hallway_light' ? <Lightbulb size={23} /> : <LockKeyhole size={23} />}<span>{name(a.id)}<strong>{a.state}</strong></span><small>{a.executions} recorded state changes</small></div>) : <p>Run a scenario or use a manual control to initialize the fixture.</p>}<div className="phantom-manual">{(['turn_on', 'turn_off'] as const).map(command => <button key={command} className="app-button app-button--secondary" disabled={busy || !canWrite} onClick={() => mutate('/commands', {target:'hallway_light', command}, 'POST', command)}>Light {command === 'turn_on' ? 'on' : 'off'}</button>)}<button className="app-button app-button--secondary" disabled={busy || !canWrite} onClick={() => mutate('/commands', { target:'entry_lock', command:'unlock' }, 'POST', 'unlock')}>Request virtual unlock</button></div></section>

      {run && <section className="phantom-comparison" aria-labelledby="phantom-comparison-title"><div className="phantom-section-title"><h2 id="phantom-comparison-title">Same sequence. Two policies.</h2><span>{scenarios.find(s => s[0] === run.scenario)?.[1]}</span></div><div className="phantom-compare-grid">{[['Vulnerable sandbox',run.sandbox_outcome], ['PHANTOM at run completion',run.protected_outcome_at_run]].map(([title, states]) => <div key={String(title)}><h3>{String(title)}</h3>{Object.entries(states).map(([id, value]) => <p key={id}>{name(id)} <strong>{value}</strong></p>)}</div>)}</div><p className="app-muted">{run.comparison_note}</p><dl className="phantom-metrics"><div><dt>Unsafe actions prevented</dt><dd>{run.metrics.unsafe_actions_prevented}</dd></div><div><dt>Routine automations allowed</dt><dd>{run.metrics.legitimate_automations_allowed}</dd></div><div><dt>Approval requests</dt><dd>{run.metrics.approval_requests}</dd></div><div><dt>False blocks in benign fixture</dt><dd>{run.metrics.benign_fixture_count ? run.metrics.false_positive_count : 'Not a benign fixture'}</dd></div><div><dt>Accepted / rejected events</dt><dd>{run.metrics.accepted_events} / {run.metrics.rejected_events}</dd></div><div><dt>Decision latency p50 / p95</dt><dd>{run.metrics.p50_ms.toFixed(1)} / {run.metrics.p95_ms.toFixed(1)} ms</dd></div></dl><p className="app-muted">Measured from this run’s small fixture, not real-world accuracy or a performance benchmark.</p></section>}

      <section className="phantom-decisions" aria-labelledby="phantom-decisions-title"><h2 id="phantom-decisions-title">Decision timeline</h2><p className="app-muted">Each owner/admin approval authorizes one exact action and requires a login within 10 minutes. Changing policy, signing out, or resetting invalidates pending requests.</p>{decisions.length === 0 ? <p>No commands yet. Run a fixture or use the manual controls.</p> : <ol>{decisions.slice(0,20).map(d => {
        const remaining = d.approval ? Math.max(0, Math.ceil(d.approval.expires_at - now)) : 0;
        const confirmable = d.decision === 'HOLD' && d.approval?.can_confirm && remaining > 0 && canWrite;
        return <li key={d.id}><div className="phantom-decision-head"><Badge value={d.decision} /><strong>{words(d.command)} · {name(d.target)}</strong><time>{new Date(d.created_at*1000).toLocaleTimeString()}</time></div><p>{words(d.reason)}. {d.executed_at ? 'Virtual actuator changed.' : 'No actuator change from this command.'}</p><p className="app-muted">Policy revision {d.policy_revision} · {d.latency_ms.toFixed(1)} ms{d.approval && !d.approval.consumed_at ? ` · ${remaining ? `${remaining}s to approve` : 'Approval expired; propose a new command'}` : ''}</p>{d.assessment_id && <button className="app-link" onClick={() => { setSelected(d.assessment_id!); document.getElementById('phantom-evidence-title')?.scrollIntoView({block:'center'}); }}>Inspect command evidence</button>}{confirmable && review !== d.id && <button className="app-button app-button--secondary" disabled={busy} onClick={() => setReview(d.id)}>Review owner approval</button>}{confirmable && review === d.id && <div className="phantom-approval"><h3>Approve this virtual unlock?</h3><p>Approve <strong>{words(d.command)}</strong> on <strong>{name(d.target)}</strong> in <strong>{home?.name}</strong>, under policy revision {d.policy_revision}. Evidence may remain unknown or inconsistent. This is an authenticated owner/admin confirmation, not biometric verification.</p><div className="app-row"><button className="app-button" disabled={busy} onClick={() => mutate(`/approvals/${d.approval!.id}/decision`, {decision:'approve'})}>Approve virtual unlock once</button><button className="app-button app-button--secondary" disabled={busy} onClick={() => mutate(`/approvals/${d.approval!.id}/decision`, {decision:'reject'})}>Reject command</button><button className="app-link" onClick={() => setReview('')}>Cancel review</button></div></div>}</li>;
      })}</ol>}</section>

      <details className="phantom-settings"><summary>Automation rules & metadata privacy</summary><div className="app-grid"><div className="app-form"><h3>Fixed safe actions</h3>{(['hallway_light','entry_lock'] as const).map(target => <label key={target}><input type="checkbox" checked={data.rules[target]} disabled={!canWrite || busy} onChange={e => mutate('/rules', {revision:data.revision, target, enabled:e.target.checked, window_seconds:data.window_seconds})} />{target === 'hallway_light' ? 'Enable event-driven hallway lighting' : 'Permit virtual unlock requests with owner approval'}</label>)}<p className="app-muted">Manual lighting stays available when its automation is disabled. Protected actions always require approval.</p></div><div className="app-form"><label>Detailed sensor metadata retention<select value={data.privacy.retention_days} disabled={!canWrite || busy} onChange={e => mutate('/privacy', {retention_days:Number(e.target.value)}, 'PATCH')}>{[1,7,30].map(days => <option key={days} value={days}>{days} day{days > 1 ? 's' : ''}</option>)}</select></label><p className="app-muted">No audio, images or recordings. Replay identifiers and minimal decision audits remain. The worker removes expired metadata; reads hide expired evidence immediately.</p></div></div></details>
    </>}
  </div>;
}
