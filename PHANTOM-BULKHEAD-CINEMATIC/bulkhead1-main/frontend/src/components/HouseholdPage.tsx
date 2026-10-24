import { useEffect, useState } from 'react';
import { api, post, errorText, savedInvite, forgetInvite } from '../lib/api';
import { useBulkhead, useSession } from '../lib/session';

export default function HouseholdPage() {
  const session = useSession();
  const { state, path, canWrite, refresh } = useBulkhead();
  const [settings, setSettings] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Viewer');
  const [guest, setGuest] = useState(false);
  const [token, setToken] = useState(new URLSearchParams(location.hash.split('?')[1] || '').get('invite') || savedInvite());
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [enrollment, setEnrollment] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => {
    const [s, ownSessions] = await Promise.all([api(path('')), api('/auth/sessions')]);
    setSettings(s); setSessions(ownSessions);
    if (canWrite) setNotifications(await api(path('/integrations/notifications')));
  };
  useEffect(() => { load().catch(err => setError(errorText(err))); }, [path, state?.sequence]);
  const run = async (operation: () => Promise<any>) => {
    setError(''); setMessage(''); setBusy(true);
    try { const result = await operation(); if (result?.message) setMessage(result.message); await refresh(); await load(); }
    catch (err) { setError(errorText(err)); } finally { setBusy(false); }
  };
  return <div>
    {error && <p role="alert" className="app-error">{error}</p>}{message && <p role="status" className="app-notice">{message}</p>}
    <div className="app-grid"><section className="app-card"><h2>{settings?.name || 'Household'}</h2><p>{session.user.email} · {session.home?.role} access</p><p className="app-muted">Owner, Admin and Viewer control authorization. Admin, Family, Work and Solo are independent response profiles.</p>
      {settings?.members.map((m: any) => <div key={m.id}><p>{m.email} · {m.role}{m.expires_at ? ` · expires ${new Date(m.expires_at*1000).toLocaleString()}` : ''}</p><div className="app-row">{session.home?.role === 'Owner' && m.role !== 'Owner' && <button disabled={busy} className="app-link" onClick={() => run(() => api(path(`/members/${m.id}`), { method: 'PATCH', body: JSON.stringify({ role: m.role === 'Admin' ? 'Viewer' : 'Admin' }) }))}>Make {m.role === 'Admin' ? 'Viewer' : 'Admin'}</button>}{canWrite && m.role !== 'Owner' && <button className="app-link" disabled={busy} onClick={() => run(() => api(path(`/members/${m.id}`), { method: 'DELETE' }))}>Remove access</button>}</div></div>)}
      {canWrite && <form className="app-form" onSubmit={e => { e.preventDefault(); run(async () => { const r = await post(path('/invitations'), { email, role, guest, guest_hours: 24 }); setMessage(`Invitation queued. Expires in seven days. ${r.invite_url}`); return r; }); }}><h3>Invite a member</h3><label>Email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} /></label><label>Role<select value={role} onChange={e => setRole(e.target.value)}><option>Viewer</option>{session.home?.role === 'Owner' && <option>Admin</option>}</select></label><label><input type="checkbox" checked={guest} onChange={e => setGuest(e.target.checked)} />Guest access, expires 24 hours after acceptance</label><button className="app-button" disabled={busy}>Send invitation</button></form>}
    </section><section className="app-card"><h2>Notifications & identity</h2>
      {settings && <label className="app-row"><input type="checkbox" disabled={!canWrite || busy} checked={settings.preferences.email_notifications} onChange={e => run(() => api(path('/preferences'), { method: 'PATCH', body: JSON.stringify({ email_notifications: e.target.checked }) }))} />Email notifications for household incidents</label>}
      <p className="app-muted">Emails are queued once per incident and member. Failed deliveries retry; local email is visible in Mailpit.</p>
      <p>Google: {session.user.google_linked ? 'linked' : session.user.google_configured ? 'available' : 'awaiting server credentials'}</p>
      {!session.user.google_linked && session.user.google_configured && <button disabled={busy} className="app-button app-button--secondary" onClick={() => run(async () => { const r = await post('/auth/google/link'); location.assign(r.url); })}>Confirm linking my Google identity</button>}
      <h3>Active sessions</h3>{sessions.map(s => <p key={s.id}>{s.id === session.user.session_id ? 'This session' : 'Another session'} · expires {new Date(s.expires_at*1000).toLocaleString()} <button className="app-link" disabled={busy} onClick={() => run(async () => { await api(`/auth/sessions/${s.id}`, { method: 'DELETE' }); if (s.id === session.user.session_id) await session.refresh(); })}>Revoke</button></p>)}
      {notifications.map(n => <p className="app-muted" key={n.id}>Email {n.id.slice(0,8)} · {n.state} · attempt {n.attempts}{n.error ? ` · ${n.error}` : ''}</p>)}
    </section><section className="app-card"><h2>Join or create a household</h2>
      <form className="app-form" onSubmit={e => { e.preventDefault(); run(async () => { const result = await post('/households/invitations/accept', { token }); forgetInvite(); await session.refresh(); session.choose(result.id); setToken(''); return { message: 'Invitation accepted' }; }); }}><label>Invitation token<input required value={token} onChange={e => setToken(e.target.value)} /></label><button disabled={busy} className="app-button">Accept invitation</button></form>
      <form className="app-form" onSubmit={e => { e.preventDefault(); run(async () => { const h = await post('/households', { name }); await session.refresh(); session.choose(h.id); return { message: 'Household created' }; }); }}><label>New household name<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label><button disabled={busy} className="app-button app-button--secondary">Create another household</button></form>
    </section><section className="app-card"><h2>OpenWrt gateway lab</h2><p className="app-muted">Default: adapter disabled, dry-run enabled. V1 enforces one explicitly confirmed, trusted device mapping using the Windows gateway agent. Management traffic is protected. Quarantines expire after 15 minutes.</p>
      {session.home?.role === 'Owner' && <button className="app-button app-button--secondary" disabled={busy} onClick={() => run(async () => { const r = await post(path('/integrations/gateway/enrollment')); setEnrollment(r.enrollment_token); })}>Create scoped enrollment token</button>}
      {enrollment && <div className="app-notice"><p>Use once in the Windows agent within ten minutes. Store the returned agent credential securely.</p><code>{enrollment}</code><button className="app-link" onClick={() => setEnrollment('')}>Hide token</button></div>}
      <p className="app-muted">Real Google login and the VirtualBox packet fixture remain pending until credentials and a Windows Intel/AMD host are available. Lab commands and explicit quarantine confirmation are documented in the repository.</p>
    </section></div>
  </div>;
}
