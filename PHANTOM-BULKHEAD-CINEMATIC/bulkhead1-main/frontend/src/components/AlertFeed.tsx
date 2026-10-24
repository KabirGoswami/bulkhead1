import { useState } from 'react';
import { ShieldCheck, Radio } from 'lucide-react';
import { post, api, errorText } from '../lib/api';
import { useBulkhead } from '../lib/session';
import '../styles/inspector.css';

export default function AlertFeed() {
  const { state, path, stream, refresh, canWrite } = useBulkhead();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [keys] = useState(() => new Map<string, string>());
  const incidents = state?.incidents || [];
  const act = async (id: string, operation: () => Promise<any>) => {
    setBusy(id); setError('');
    try { await operation(); await refresh(); } catch (err) { setError(errorText(err)); } finally { setBusy(null); }
  };
  const confirm = (incident: any) => {
    if (!keys.has(incident.id)) keys.set(incident.id, crypto.randomUUID());
    return post(path('/actions'), { incident_id: incident.id, action: incident.alert.response.action,
      policy_revision: state.policy_revision, command_id: keys.get(incident.id) });
  };
  return <div className="inspector-content">
    <div className="inspector-heading"><div><span className="inspector-eyebrow">Detection & incident response</span><h3>Security Alerts</h3></div><span className="inspector-count">{incidents.length}</span></div>
    <p className="inspector-description">{stream} · {state?.worker.healthy ? 'Worker healthy' : 'Worker unavailable; detection is paused'}</p>
    {error && <p role="alert" className="app-error">{error}</p>}
    {!state ? <p role="status">Loading incidents…</p> : incidents.length === 0 ? <div className="inspector-empty inspector-empty--inset"><ShieldCheck size={30} /><h4>No incidents recorded</h4><p>{stream === 'Live' && state.worker.healthy ? 'Monitoring simulated traffic.' : 'Waiting for live detection.'}</p><span className="inspector-stream-label"><Radio size={12} /> Authenticated event stream</span></div> :
      <div className="inspector-card-list">{incidents.map((incident: any) => {
        const alert = incident.alert;
        const actions = state.actions.filter((a: any) => a.incident_id === incident.id);
        const active = actions.some((a: any) => ['applied','verified','planned'].includes(a.state));
        return <article key={incident.id} className="alert-card">
          <div className="inspector-card-meta"><span className="inspector-badge">{incident.status} · {alert.confidence} confidence</span><time dateTime={incident.created_at}>{new Date(incident.created_at).toLocaleString()}</time></div>
          <h4>{state.devices.find((d: any) => d.id === alert.node_id)?.name || state.accounts.find((a: any) => a.id === alert.node_id)?.name || alert.node_id}</h4>
          <p>{alert.explanation}</p><p className="app-muted">{alert.reason_codes.join(' · ')}</p>
          <div className="alert-response"><p>{alert.response.explanation}</p>
            {incident.status !== 'resolved' && !active && alert.response.requires_confirmation && ['CONTAIN','REVOKE'].includes(alert.response.action) && <button disabled={!canWrite || busy !== null} className="alert-confirm-button" onClick={() => act(incident.id, () => confirm(incident))}>Confirm {alert.response.action === 'REVOKE' ? 'simulated account revocation' : 'simulated containment'}</button>}
            {alert.response.action === 'NOTIFY' && <p className="app-muted">Notify only. No containment is offered.</p>}
          </div>
          {actions.map((action: any) => <div className="app-notice" key={action.id}><p>{action.action_type} · {action.state} · {action.execution_mode}</p><code>{action.id}</code>{action.expires_at && <p className="app-muted">Lease expires {new Date(action.expires_at * 1000).toLocaleString()}{action.expired && action.state !== 'rolled_back' ? " · awaiting recovery verification" : ""}</p>}{['applied','verified'].includes(action.state) && action.execution_mode === 'simulation' && <button className="app-link" disabled={!canWrite || busy !== null} onClick={() => act(action.id, async () => { const result = await post(path(`/actions/${action.id}/undo`)); keys.delete(incident.id); return result; })}>Undo and recover access</button>}</div>)}
          <div className="app-row">{incident.status === 'open' && <button className="app-link" disabled={!canWrite || busy !== null} onClick={() => act(incident.id, () => api(path(`/incidents/${incident.id}`), { method: 'PATCH', body: JSON.stringify({ status: 'acknowledged' }) }))}>Acknowledge</button>}
            <button className="app-link" disabled={!canWrite || busy !== null} onClick={() => act(incident.id, () => api(path(`/incidents/${incident.id}`), { method: 'PATCH', body: JSON.stringify({ status: incident.status === 'resolved' ? 'open' : 'resolved' }) }))}>{incident.status === 'resolved' ? 'Reopen incident' : 'Resolve incident'}</button>
          </div><p className="app-muted">Resolution retains containment history. Undo restores simulated access; account revocation and network containment are separate actions.</p>
        </article>;
      })}</div>}
  </div>;
}
