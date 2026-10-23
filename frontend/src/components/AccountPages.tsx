import { useEffect, useState, FormEvent } from 'react';
import { api, post, errorText, savedInvite, forgetInvite } from '../lib/api';
import { useSession } from '../lib/session';

export default function AccountPages({ page }: { page: string }) {
  const session = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const [invite, setInvite] = useState(params.get('invite') || savedInvite());
  const [token, setToken] = useState(params.get('token') || '');
  const [name, setName] = useState('My household');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [google, setGoogle] = useState(false);
  useEffect(() => { api('/auth/options').then(r => setGoogle(r.google_configured)).catch(() => {}); }, []);
  useEffect(() => { setMessage(''); setError(''); setPassword(''); }, [page]);
  const kind = session.user && !session.home ? 'onboarding' : ['register','verify','recover','reset','onboarding'].includes(page) ? page : 'login';
  const title = { login: 'Welcome home', register: 'Create your account', verify: 'Verify your email', recover: 'Recover access', reset: 'Choose a new password', onboarding: 'Create your private household' }[kind];
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      if (kind === 'onboarding') {
        const home = await post('/households', { name });
        await session.refresh(); session.choose(home.id); location.hash = '#/network';
      } else if (kind === 'login') {
        await post('/auth/login', { email, password });
        await session.refresh(); location.hash = '#/network';
      } else {
        const result = await post(`/auth/${kind === 'recover' ? token ? 'reset' : 'recovery' : kind === 'reset' ? 'reset' : kind}`, kind === 'verify' ? { token } : kind === 'recover' && !token ? { email } : kind === 'reset' || kind === 'recover' && token ? { token, password } : { email, password });
        setMessage(result.message);
      }
    } catch (err) { setError(errorText(err)); } finally { setBusy(false); }
  };
  return <section className="account-page feature-surface" data-active-page="true">
    <span className="section-eyebrow">Private households · simulation and routed VM lab</span>
    <h1 data-page-title tabIndex={-1}>{title}<span className="heading-dot">.</span></h1>
    <p>Application accounts are separate from vendor accounts. A household role controls access; a response profile controls simulated responses.</p>
    {session.loading ? <p role="status">Loading your session…</p> : <form onSubmit={submit} className="app-form">
      {kind === 'onboarding' ? <label>Household name<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label> : <>
        {['login','register'].includes(kind) || kind === 'recover' && !token ? <label>Email<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label> : null}
        {kind === 'verify' || kind === 'reset' ? <label>Single-use token<input required value={token} onChange={e => setToken(e.target.value)} /></label> : null}
        {['login','register','reset'].includes(kind) || kind === 'recover' && token ? <label>Password (at least 12 characters)<input required type="password" minLength={12} maxLength={1024} autoComplete={kind === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} /></label> : null}
      </>}
      <button className="app-button" disabled={busy}>{busy ? 'Working…' : kind === 'onboarding' ? 'Create household' : kind === 'verify' ? 'Verify email' : kind === 'login' ? 'Sign in' : kind === 'register' ? 'Create account' : token ? 'Reset password' : 'Send recovery email'}</button>
    </form>}
    {(error || session.error) && <p role="alert" className="app-error">{error || session.error}</p>}
    {message && <p role="status" className="app-notice">{message}</p>}
    {kind === 'login' && <p>{google ? <a className="app-button" href="/api/v1/auth/google/start">Continue with Google</a> : <span>Google sign-in awaits server credentials.</span>}</p>}
    {session.user && !session.home && <form className="app-form" onSubmit={async event => { event.preventDefault(); setBusy(true); setError(''); try { const h = await post('/households/invitations/accept', { token: invite }); forgetInvite(); await session.refresh(); session.choose(h.id); location.hash = '#/household'; } catch (err) { setError(errorText(err)); } finally { setBusy(false); } }}><label>Or join with an invitation token<input required value={invite} onChange={e => setInvite(e.target.value)} /></label><button disabled={busy} className="app-button app-button--secondary">Accept invitation</button></form>}
    <div className="account-links"><a href="#/login">Sign in</a><a href="#/register">Create account</a><a href="#/verify">Verify email</a><a href="#/recover">Forgot password</a></div>
    {kind === 'verify' && <><label className="app-form">Email for another verification message<input type="email" value={email} onChange={e => setEmail(e.target.value)} /></label><button type="button" className="app-link" disabled={busy || !email} onClick={async () => { try { const r = await post('/auth/verification', { email }); setMessage(r.message); } catch (err) { setError(errorText(err)); } }}>Resend verification</button></>}
    <p className="app-muted">Mailpit shows local verification and recovery messages at <a href="http://localhost:8025" target="_blank" rel="noreferrer">localhost:8025</a>. Physical-device protection, vendor-cloud enforcement and the public simulator are later phases.</p>
  </section>;
}
