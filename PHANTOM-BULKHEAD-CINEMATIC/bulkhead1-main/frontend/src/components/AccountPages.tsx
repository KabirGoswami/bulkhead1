import { useEffect, useState, FormEvent } from 'react';
import { api, post, errorText, savedInvite, forgetInvite } from '../lib/api';
import { useSession } from '../lib/session';
import { Terminal, Zap } from 'lucide-react';

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
  const [devEnabled, setDevEnabled] = useState(false);

  useEffect(() => {
    api('/auth/options')
      .then(r => {
        setGoogle(Boolean(r.google_configured));
        setDevEnabled(Boolean(r.dev_enabled));
      })
      .catch(() => {});
  }, []);

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

  const handleDevLogin = async (devEmail = 'dev@bulkhead.local', devRole: 'Owner' | 'Admin' | 'Viewer' = 'Owner') => {
    setBusy(true); setError(''); setMessage('');
    try {
      await post('/auth/dev-login', {
        email: email.trim() || devEmail,
        role: devRole,
        household_name: 'Dev Household'
      });
      await session.refresh();
      location.hash = '#/network';
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
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

    {devEnabled && ['login', 'register', 'onboarding'].includes(kind) && (
      <div className="dev-login-panel" data-testid="dev-login-panel">
        <div className="dev-login-panel__header">
          <div className="dev-login-panel__badge">
            <span className="dev-login-dot" />
            <Terminal size={15} aria-hidden="true" />
            <strong>Developer Quick Sign In</strong>
          </div>
          <span className="dev-login-tag">DEV_LOCALHOST</span>
        </div>
        <p className="dev-login-panel__text">
          Passwordless login for local testing. Provisons or accesses a pre-configured smart-home network.
        </p>
        <div className="dev-login-actions">
          <button
            type="button"
            id="dev-login-btn-owner"
            className="app-button dev-login-btn--primary"
            disabled={busy}
            onClick={() => handleDevLogin('dev@bulkhead.local', 'Owner')}
          >
            <Zap size={14} aria-hidden="true" />
            <span>{email.trim() ? `Sign in as ${email.trim()} (Owner)` : 'Sign in as Owner (dev@bulkhead.local)'}</span>
          </button>
          <div className="dev-login-presets">
            <button
              type="button"
              id="dev-login-btn-admin"
              className="app-button app-button--secondary"
              disabled={busy}
              onClick={() => handleDevLogin('admin@bulkhead.local', 'Admin')}
              title="Sign in as Household Admin"
            >
              Admin Role
            </button>
            <button
              type="button"
              id="dev-login-btn-viewer"
              className="app-button app-button--secondary"
              disabled={busy}
              onClick={() => handleDevLogin('viewer@bulkhead.local', 'Viewer')}
              title="Sign in as Household Viewer"
            >
              Viewer Role
            </button>
          </div>
        </div>
      </div>
    )}

    {kind === 'login' && (
      <div className="oauth-section">
        <div className="oauth-divider">
          <span>or continue with</span>
        </div>
        {google ? (
          <a
            id="google-login-btn"
            className="app-button app-button--google"
            href="/api/v1/auth/google/start"
          >
            <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Continue with Google</span>
          </a>
        ) : (
          <p className="app-muted">Google sign-in awaits server credentials.</p>
        )}
      </div>
    )}
    {session.user && !session.home && <form className="app-form" onSubmit={async event => { event.preventDefault(); setBusy(true); setError(''); try { const h = await post('/households/invitations/accept', { token: invite }); forgetInvite(); await session.refresh(); session.choose(h.id); location.hash = '#/household'; } catch (err) { setError(errorText(err)); } finally { setBusy(false); } }}><label>Or join with an invitation token<input required value={invite} onChange={e => setInvite(e.target.value)} /></label><button disabled={busy} className="app-button app-button--secondary">Accept invitation</button></form>}
    <div className="account-links"><a href="#/login">Sign in</a><a href="#/register">Create account</a><a href="#/verify">Verify email</a><a href="#/recover">Forgot password</a></div>
    {kind === 'verify' && <><label className="app-form">Email for another verification message<input type="email" value={email} onChange={e => setEmail(e.target.value)} /></label><button type="button" className="app-link" disabled={busy || !email} onClick={async () => { try { const r = await post('/auth/verification', { email }); setMessage(r.message); } catch (err) { setError(errorText(err)); } }}>Resend verification</button></>}
    <p className="app-muted">Mailpit shows local verification and recovery messages at <a href="http://localhost:8025" target="_blank" rel="noreferrer">localhost:8025</a>. Physical-device protection, vendor-cloud enforcement and the public simulator are later phases.</p>
  </section>;
}
