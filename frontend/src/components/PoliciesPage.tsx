import { useEffect, useState } from 'react';
import { api, post, errorText } from '../lib/api';
import { useBulkhead } from '../lib/session';

export default function PoliciesPage() {
  const { state, path, canWrite, refresh } = useBulkhead();
  const [device, setDevice] = useState('');
  const [peers, setPeers] = useState<string[]>([]);
  const [destinations, setDestinations] = useState('');
  const [temporary, setTemporary] = useState(false);
  const [minutes, setMinutes] = useState(15);
  const [preview, setPreview] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const body = { device_id: device, peers, destinations: destinations.split(/[\n,]/).map(s => s.trim()).filter(Boolean), expires_in: temporary ? minutes * 60 : null, policy_revision: state?.policy_revision };
  const serialized = JSON.stringify(body);
  useEffect(() => { setPreview(null); }, [serialized]);
  useEffect(() => {
    if (!state) return;
    const controller = new AbortController();
    api(path('/policies'), { signal: controller.signal }).then(r => setRecords(r.policies)).catch(err => { if (!controller.signal.aborted) setError(errorText(err)); });
    return () => controller.abort();
  }, [path, state?.policy_revision]);
  const run = async (apply: boolean) => {
    setBusy(true); setError('');
    try { const r = await post(path(apply ? '/policies' : '/policies/preview'), body); if (apply) { setPreview(null); await refresh(); } else setPreview(r); }
    catch (err) { setError(errorText(err)); } finally { setBusy(false); }
  };
  const name = (id: string) => state?.devices.find((d: any) => d.id === id)?.name || state?.accounts.find((a: any) => a.id === id)?.name || id;
  return <div className="app-grid"><section className="app-card"><h2>Preview an access policy</h2>
    {error && <p role="alert" className="app-error">{error}</p>}
    <div className="app-form"><label>Device<select value={device} onChange={e => { setDevice(e.target.value); setPeers([]); setDestinations(''); }}><option value="">Choose a device</option>{state?.devices.map((d: any) => <option value={d.id} key={d.id}>{d.name}</option>)}</select></label>
      <fieldset><legend>Permitted peers</legend>{state?.devices.filter((d: any) => d.id !== device).map((d: any) => <label key={d.id}><input type="checkbox" checked={peers.includes(d.id)} onChange={e => setPeers(e.target.checked ? [...peers, d.id] : peers.filter(p => p !== d.id))} />{d.name}</label>)}</fieldset>
      <label>Permitted external domains (one per line)<textarea rows={4} value={destinations} onChange={e => setDestinations(e.target.value)} placeholder="updates.example.com" /></label>
      <label><input type="checkbox" checked={temporary} onChange={e => setTemporary(e.target.checked)} />Temporary grant</label>
      {temporary && <label>Duration in minutes (1–1440)<input type="number" min={1} max={1440} value={minutes} onChange={e => setMinutes(Number(e.target.value))} /></label>}
      <button className="app-button" disabled={!device || busy || !canWrite} onClick={() => run(false)}>Preview reachability</button>
      {preview && <div className="app-notice"><p>Revision {preview.policy_revision} · {preview.before.length} → {preview.after.length} reachable nodes</p><p>Removed: {preview.removed.map(name).join(', ') || 'none'}<br />Added: {preview.added.map(name).join(', ') || 'none'}</p><p>{preview.note}</p><button className="app-button" disabled={busy || !canWrite} onClick={() => run(true)}>Apply to simulation</button></div>}
    </div><p className="app-muted">Peer rules replace implicit zone access for this source. Temporary grants expire automatically and reveal the underlying permanent policy. No firewall rule is changed by this page.</p>
  </section><section className="app-card"><h2>Policy history</h2>{records.length === 0 && <p>No explicit policies yet; default simulated zone and peer access applies.</p>}{records.map(p => <div key={p.id}><h3>{name(p.device_id)}</h3><p>Revision {p.revision} · {p.active ? 'active' : 'inactive'} · {p.expires_at ? `expires ${new Date(p.expires_at * 1000).toLocaleString()}` : 'persistent'}</p><p className="app-muted">Peers: {p.peers.map(name).join(', ') || 'none'}<br />Domains: {p.destinations.join(', ') || 'none'}</p>{p.active && canWrite && <button className="app-link" onClick={async () => { try { await api(path(`/policies/${p.id}`), { method: 'DELETE' }); await refresh(); } catch (err) { setError(errorText(err)); } }}>Remove policy</button>}</div>)}</section></div>;
}
