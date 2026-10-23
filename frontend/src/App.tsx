import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { useBulkhead, useSession } from './lib/session';
import { errorText } from './lib/api';
import AccountPages from './components/AccountPages';
import DevicesPage from './components/DevicesPage';
import PoliciesPage from './components/PoliciesPage';
import HouseholdPage from './components/HouseholdPage';
import PhantomPage from './components/PhantomPage';
import {
  Activity, ArrowRight, ArrowUp, ArrowUpRight, Box,
  CircleDot, Fingerprint, History, House, LayoutGrid, Menu, Network, Play, Shield,
  ShieldCheck, UsersRound, X,
} from 'lucide-react';
import AccessHealth from './components/AccessHealth';
import HomeMap from './components/HomeMap';
import './styles/network-room3d.css';
import './styles/workspace.css';
const NetworkRoom3D = lazy(() => import('./components/NetworkRoom3D'));
import AlertFeed from './components/AlertFeed';
import ScenarioControl from './components/ScenarioControl';
import Timeline from './components/Timeline';
import ProfileSwitcher from './components/ProfileSwitcher';
import LandingIntro from './components/LandingIntro';
import ThemePicker from './components/ThemePicker';

const pages = [
  { id: 'overview', label: 'Home', icon: House, href: '#/' },
  { id: 'network', label: 'Network', icon: Network, href: '#/network' },
  { id: 'health', label: 'Access health', icon: ShieldCheck, href: '#/health' },
  { id: 'alerts', label: 'Alerts', icon: Activity, href: '#/alerts' },
  { id: 'timeline', label: 'Timeline', icon: History, href: '#/timeline' },
  { id: 'devices', label: 'Devices', icon: Network, href: '#/devices' },
  { id: 'policies', label: 'Policies', icon: Shield, href: '#/policies' },
  { id: 'household', label: 'Household', icon: UsersRound, href: '#/household' },
  { id: 'simulation', label: 'Simulation', icon: Play, href: '#/simulation' },
  { id: 'phantom', label: 'Reality Check', icon: Fingerprint, href: '#/phantom' },
] as const;
type Page = typeof pages[number]['id'] | 'not-found' | 'login' | 'register' | 'verify' | 'recover' | 'reset' | 'onboarding';

function currentPage(): Page {
  const path = window.location.hash.split('?')[0].replace(/^#\/?/, '').replace(/\/$/, '');
  const invite = new URLSearchParams(window.location.hash.split('?')[1] || '').get('invite');
  if (invite) { try { sessionStorage.setItem('bulkhead.invite', invite); } catch { /* The token remains available in this route. */ } }
  if (!path) return 'overview';
  return pages.some(page => page.id === path) || ['login','register','verify','recover','reset','onboarding'].includes(path) ? path as Page : 'not-found';
}

function PageIntro({ number, eyebrow, title, description }: { number: string; eyebrow: string; title: string; description: string }) {
  return (
    <header className="page-intro">
      <div className="page-eyebrow"><span>{number}</span><span className="page-eyebrow__line" />{eyebrow}</div>
      <h1 data-page-title tabIndex={-1}>{title}<span className="heading-dot">.</span></h1>
      <p>{description}</p>
    </header>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>(currentPage);
  const [routeHash, setRouteHash] = useState(window.location.hash);
  const [accountError, setAccountError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [networkView, setNetworkView] = useState<'2d' | '3d'>('2d');
  const session = useSession();
  const { state, stream, error, refresh } = useBulkhead();
  const exposureScore = state?.exposure_score ?? 0;
  const deviceCount = state?.devices.length ?? null;
  const accountCount = state?.accounts.length ?? null;
  const connected = stream === 'Live' && state?.worker.healthy && !error;
  const accountView = ['login','register','verify','recover','reset','onboarding'].includes(page) || (!session.user && page !== 'overview');
  const focusPage = useRef(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const changePage = () => {
      focusPage.current = true;
      setPage(currentPage());
      setRouteHash(window.location.hash);
      setMenuOpen(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', changePage);
    return () => window.removeEventListener('hashchange', changePage);
  }, []);

  useEffect(() => {
    const label = pages.find(item => item.id === page)?.label || 'Page not found';
    document.title = `${label} — Bulkhead`;
    if (!focusPage.current) return;
    focusPage.current = false;
    const frame = requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[data-active-page="true"] [data-page-title]')?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [page]);

  useEffect(() => {
    if (!menuOpen) return;
    const frame = requestAnimationFrame(() => {
      document.querySelector<HTMLAnchorElement>('#site-navigation a')?.focus();
    });
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);


  const securitySummary = (
    <section className="summary-grid" aria-label="Home security summary">
      <article className={`summary-card exposure-card ${exposureScore > 50 ? 'exposure-card--high' : ''}`}>
        <div className="summary-card__top"><span>Home exposure score</span><Shield size={18} /></div>
        <div className="exposure-card__value">
          <strong>{deviceCount === null ? '—' : Math.round(exposureScore)}<span>/100</span></strong>
          <span className="exposure-label">{deviceCount === null ? 'Connecting' : exposureScore > 50 ? 'Elevated exposure' : 'Lower exposure'}</span>
        </div>
        <div className="exposure-meter" role="meter" aria-label="Home exposure score" aria-valuenow={Math.round(exposureScore)} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${Math.min(100, Math.max(0, exposureScore))}%` }} />
        </div>
      </article>
      <article className="summary-card">
        <div className="summary-card__top"><span>Connected devices</span><Network size={18} /></div>
        <div className="summary-card__bottom"><strong>{deviceCount ?? '—'}</strong><span>Across your home network<ArrowUpRight size={14} /></span></div>
      </article>
      <article className="summary-card">
        <div className="summary-card__top"><span>Linked accounts</span><UsersRound size={18} /></div>
        <div className="summary-card__bottom"><strong>{accountCount ?? '—'}</strong><span>Shared access, made visible<Fingerprint size={15} /></span></div>
      </article>
    </section>
  );

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>Skip to content</a>
      {page !== 'overview' && (
        <header className="site-header">
          <div className="site-header__inner">
            <a className="site-brand" href="#/" aria-label="Bulkhead home"><Shield size={26} strokeWidth={1.5} /><span>bulkhead<span className="heading-dot">.</span></span></a>
            <nav id="site-navigation" className={`site-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Main navigation">
              {pages.filter(({ id }) => session.user || id === 'overview').map(({ id, href, label, icon: Icon }) => (
                <a key={id} href={href} aria-current={page === id ? 'page' : undefined} onClick={() => {
                  setMenuOpen(false);
                  if (menuOpen && page === id) {
                    document.querySelector<HTMLElement>('[data-active-page="true"] [data-page-title]')?.focus({ preventScroll: true });
                  }
                }}>
                  <Icon size={16} aria-hidden="true" /><span>{label}</span>
                </a>
              ))}
            </nav>
            <div className="site-header__actions">
              <ThemePicker />
              {session.user ? (
                <a className="app-link" href="#/network">Enter Dashboard</a>
              ) : (
                <a className="app-link" href="#/login">Sign in</a>
              )}
              <button ref={menuButton} className="mobile-menu-button" type="button" aria-expanded={menuOpen} aria-controls="site-navigation" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} onClick={() => setMenuOpen(open => !open)}>
                {menuOpen ? <X size={21} /> : <Menu size={21} />}
              </button>
            </div>
          </div>
        </header>
      )}

      <main id="main-content" tabIndex={-1} className={`site-main ${page === 'overview' ? 'site-main--home' : ''}`}>
        {accountView ? <AccountPages key={routeHash} page={page} /> : <>
        {page === 'overview' && (
          <div data-active-page="true" className="landing-wrapper">
            <LandingIntro session={session} />
          </div>
        )}
        <div className="page-container" hidden={page === 'overview'}>
          {session.user && <div className="household-bar"><label htmlFor="active-household">Household</label><select id="active-household" className="household-select" value={session.home?.id || ''} onChange={e => session.choose(e.target.value)}>{session.homes.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select><span>{session.home?.role} access</span><a href="#/household">Settings</a><button className="app-link" onClick={() => session.logout().catch(err => setAccountError(errorText(err)))}>Sign out</button></div>}
          <div className="capability-note">Simulation is the default. The OpenWrt adapter is {state?.capabilities?.adapter_enabled ? 'enabled' : 'disabled'}; dry-run is {state?.capabilities?.dry_run === false ? 'off' : 'on'}. The lab demonstrates routed VM isolation. Physical-device protection, vendor-cloud enforcement and the public simulator are later phases.</div>
          {(error || accountError) && <div role="alert" className="app-error">{error || accountError} · Displayed data may be stale. <button className="app-link" onClick={refresh}>Retry</button></div>}
          <div className="workspace-toolbar" hidden={page === 'overview' || page === 'not-found'}>
            <div className="workspace-toolbar__status"><span className={`status-dot ${connected ? '' : 'status-dot--offline'}`} /><span>{connected ? 'Live · worker healthy' : `${stream} · ${state?.worker.healthy ? 'worker healthy' : 'worker unavailable'}`}</span><span className="toolbar-divider" /><span>Simulation mode</span></div>
            <ProfileSwitcher />
          </div>

          {page === 'network' && (
            <section className="feature-page feature-page--network" data-active-page="true">
              <PageIntro number="01" eyebrow="Network visibility" title="Your home, mapped" description="Explore the devices and accounts that connect your home. Select any node to see how far a compromise could reach." />
              {securitySummary}
              <section className="network-panel" aria-labelledby="network-title">
                <div className="panel-heading">
                  <div><span className="section-eyebrow">Devices, accounts &amp; shared access</span><h2 id="network-title"><Network size={19} /> Connected home</h2></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="network-view-toggle" role="group" aria-label="Map view mode">
                      <button className="network-view-toggle__btn" type="button" aria-pressed={networkView === '2d'} onClick={() => setNetworkView('2d')}><LayoutGrid size={14} />2D</button>
                      <button className="network-view-toggle__btn" type="button" aria-pressed={networkView === '3d'} onClick={() => setNetworkView('3d')}><Box size={14} />3D Room</button>
                    </div>
                    <span className="panel-tag">{networkView === '3d' ? '3D room view' : 'Interactive map'}</span>
                  </div>
                </div>
                <div className="network-panel__canvas">
                  {networkView === '2d' ? <HomeMap /> : (
                    <Suspense fallback={<div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--muted)', fontSize: '13px' }}>Loading 3D room…</div>}>
                      <NetworkRoom3D />
                    </Suspense>
                  )}
                </div>
                <div className="network-panel__caption"><CircleDot size={14} />{networkView === '3d' ? 'Orbit with mouse. Scroll to zoom. Click any node to reveal its blast radius.' : 'Select a device or account to explore its blast radius. Pan or zoom to take a closer look.'}</div>
              </section>
              <a className="next-page-link" href="#/health"><span>Next: find and resolve access risks</span>Access health<ArrowRight size={17} /></a>
            </section>
          )}

          {page === 'health' && (
            <section className="feature-page feature-page--health" data-active-page="true">
              <PageIntro number="02" eyebrow="Access health" title="Close the gaps" description="Review weak credentials, older firmware, and unnecessary access. Small fixes can make a meaningful difference." />
              <div className="feature-surface"><AccessHealth /></div>
            </section>
          )}

          {/* Keep these views mounted so their event histories survive page navigation. */}
          <section className="feature-page feature-page--alerts" hidden={page !== 'alerts'} data-active-page={page === 'alerts'}>
            <PageIntro number="03" eyebrow="Detection & response" title="The signals that matter" description="Review simulated threats, understand the evidence, and confirm suggested actions when your attention is needed." />
            <div className="feature-surface">{session.user && <AlertFeed />}</div>
          </section>
          <section className="feature-page feature-page--timeline" hidden={page !== 'timeline'} data-active-page={page === 'timeline'}>
            <PageIntro number="04" eyebrow="Event history" title="See the whole sequence" description="Follow each signal from detection to explanation and containment, in the order it reaches your home." />
            <div className="feature-surface">{session.user && <Timeline />}</div>
          </section>

          {page === 'simulation' && (
            <section className="feature-page feature-page--simulation" data-active-page="true">
              <PageIntro number="05" eyebrow="The simulation lab" title="Put your defenses to the test" description="Explore three attack and update scenarios using virtual devices. Every action stays inside this simulated home." />
              <ScenarioControl />
              <section className="simulation-guide" aria-labelledby="simulation-guide-title">
                <div><span className="section-eyebrow">A closer look</span><h2 id="simulation-guide-title">From scenario to insight.</h2></div>
                <ol>
                  <li><span>01</span><div><h3>Choose a profile</h3><p>Use Admin, Family, Work, or Solo above to explore different response policies.</p></div></li>
                  <li><span>02</span><div><h3>Start a scenario</h3><p>Compare a compromised plug, stolen credentials, and a benign vendor update.</p></div></li>
                  <li><span>03</span><div><h3>Follow the signals</h3><p>Review <a href="#/alerts">security alerts</a> and trace the sequence in the <a href="#/timeline">event timeline</a>.</p></div></li>
                </ol>
              </section>
            </section>
          )}
          {page === 'phantom' && <section className="feature-page" data-active-page="true"><PageIntro number="09" eyebrow="PHANTOM / Reality Check" title="Trust the source. Check the story" description="Follow a sensor message through identity, independent evidence, and the decision that controls a virtual action." /><PhantomPage /></section>}
          {page === 'devices' && <section data-active-page="true"><PageIntro number="06" eyebrow="Device inventory" title="Know what is connected" description="Approve devices, choose their zones, and record firmware and trusted lab mappings." /><DevicesPage /></section>}
          {page === 'policies' && <section data-active-page="true"><PageIntro number="07" eyebrow="Access policies" title="Give access a boundary" description="Preview persistent access rules and expiring grants before applying them to the simulation." /><PoliciesPage /></section>}
          {page === 'household' && <section data-active-page="true"><PageIntro number="08" eyebrow="Household settings" title="Your private household" description="Manage membership, invitations, sessions, notifications and lab enrollment." /><HouseholdPage key={routeHahs} /></section>}
          {page === 'not-found' && (
            <section className="feature-page not-found" data-active-page="true">
              <PageIntro number="404" eyebrow="A small detour" title="This page isn't connected" description="Let's get you back to a familiar part of your home." />
              <a className="primary-link" href="#/">Back to home<ArrowRight size={17} /></a>
            </section>
          )}
        </div>
        </>}
      </main>

      <footer className="site-footer">
        <div className="site-footer__inner">
          <div className="site-footer__top">
            <div className="footer-identity"><a className="site-brand" href="#/" aria-label="Bulkhead home"><Shield size={25} strokeWidth={1.5} /><span>bulkhead<span className="heading-dot">.</span></span></a><p>A little more visibility.<br />A more resilient connected home.</p><span className="footer-simulation"><span className="status-dot" /> Virtual devices. Simulated traffic.</span></div>
            <nav className="footer-navigation" aria-label="Footer navigation"><span>Explore the home</span><div>{pages.map(({ id, href, label }) => <a key={id} href={href} aria-current={page === id ? 'page' : undefined}>{label}<ArrowUpRight size={13} /></a>)}</div></nav>
            <div className="footer-note"><span className="section-eyebrow">Designed to contain</span><p>One compromised device should never become the whole story.</p><button type="button" onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}>Back to top<ArrowUp size={14} /></button></div>
          </div>
          <div className="site-footer__bottom"><span>© {new Date().getFullYear()} Bulkhead</span><span>A smart-home security simulation. No real devices are controlled.</span><span><Shield size={12} /> Stay connected.</span></div>
        </div>
      </footer>
    </div>
  );
}
