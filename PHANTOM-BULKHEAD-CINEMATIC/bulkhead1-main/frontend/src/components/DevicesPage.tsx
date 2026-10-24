import { useState, useEffect, FormEvent } from 'react';
import { api, post, errorText } from '../lib/api';
import { useBulkhead } from '../lib/session';
const initial = { name: '', type: 'plug', vendor: 'Unknown', zone: 'iot', criticality: 'medium', approval: 'pending', firmware_age_days: 0, firmware_version: '', product_cpe: '', trusted_ipv4: '', trusted_mac: '' };

export default function DevicesPage() {
  const { state, path, canWrite, refresh } = useBulkhead();
  const [form, setForm] = useState<any>(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [advisories, setAdvisories] = useState<Record<string, any>>({});
  useEffect(() => { setAdvisories({}); }, [state?.policy_revision]);
  const field = (name: string, label: string, type = 'text') => <label>{label}<input type={type} min={type === 'number' ? 0 : undefined} required={['name','type','vendor'].includes(name)} value={form[name] ?? ''} onChange={e => setForm({ ...form, [name]: type === 'number' ? Number(e.target.value) : e.target.value })} /></label>;
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    const body = { ...form };
    for (const key of ['firmware_version','product_cpe','trusted_ipv4','trusted_mac']) body[key] = body[key] || null;
    try {
      await api(path(editing ? `/devices/${editing}` : '/devices'), { method: editing ? 'PUT' : 'POST', body: JSON.stringify(body) });
      await refresh(); setEditing(null); setForm(initial);
    } catch (err) { setError(errorText(err)); } finally { setBusy(false); }
  };
  return <div>
    {error && <p role="alert" className="app-error">{error}</p>}
    <div className="app-grid">{state?.devices.map((d: any) => <article className="app-card" key={d.id}>
      <h3>{d.name}</h3><p>{d.approval} · {d.zone} · {d.criticality}{d.isolated ? ' · contained in simulation' : ''}</p>
      <p className="app-muted">{d.vendor} · Firmware: {d.firmware_version || 'unknown'} ({d.firmware_age_days} days)<br />Trusted mapping: {d.trusted_ipv4 || 'none'} {d.trusted_mac || ''}</p>
      <div className="app-row"><button className="app-link" disabled={!canWrite} onClick={() => { setEditing(d.id); setForm({ ...initial, ...d }); }}>Edit device</button><button className="app-link" onClick={async () => { try { const result = await api(path(`/integrations/advisories/${d.id}`)); setAdvisories(p => ({ ...p, [d.id]: result })); } catch (err) { setError(errorText(err)); } }}>Look up NVD advisories</button></div>
      {advisories[d.id] && <div className="app-muted"><p>Advisory status: {advisories[d.id].status}. {advisories[d.id].reason || advisories[d.id].note}</p>{advisories[d.id].advisories.map((a: any) => <p key={a.id}><a href={a.url} target="_blank" rel="noreferrer">{a.id}</a> {a.description}</p>)}</div>}
    </article>)}</div>
    {canWrite && <section className="app-card" style={{ marginTop: 24 }}><h2>{editing ? 'Edit device' : 'Add a device'}</h2><form className="app-form" onSubmit={submit}>
      {field('name','Name')}{field('type','Device type')}{field('vendor','Vendor')}
      <label>Zone<select value={form.zone} onChange={e => setForm({ ...form, zone: e.target.value })}>{['main','iot','work','guest'].map(z => <option key={z}>{z}</option>)}</select></label>
      <label>Approval<select value={form.approval} onChange={e => setForm({ ...form, approval: e.target.value })}>{['pending','approved','rejected'].map(z => <option key={z}>{z}</option>)}</select></label>
      <label>Criticality<select value={form.criticality} onChange={e => setForm({ ...form, criticality: e.target.value })}>{['low','medium','high','safety'].map(z => <option key={z}>{z}</option>)}</select></label>
      {field('firmware_age_days','Firmware age in days','number')}{field('firmware_version','Exact firmware version (optional)')}{field('product_cpe','Exact product CPE 2.3 (optional)')}
      {field('trusted_ipv4','Trusted lab IPv4 (optional)')}{field('trusted_mac','Trusted lab MAC (optional)')}
      <p className="app-muted">Only enter a CPE after identifying the exact product and firmware. Seeded demo devices have unknown advisory status. Trusted mappings must match the lab fixture; they do not establish physical Wi-Fi identity.</p>
      <div className="app-row"><button disabled={busy} className="app-button">{busy ? 'Saving…' : 'Save device'}</button>{editing && <button type="button" className="app-link" onClick={() => { setEditing(null); setForm(initial); }}>Cancel</button>}</div>
    </form></section>}
  </div>;
}
