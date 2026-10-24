import React, { useEffect, useRef, useState } from 'react';
import { useBulkhead, useSession } from './lib/session';
import { errorText } from './lib/api';
import AccountPages from './components/AccountPages';
import PoliciesPage from './components/PoliciesPage';
import LandingIntro from './components/LandingIntro';
import PhantomSidebar from './components/PhantomSidebar';
import PhantomHeader from './components/PhantomHeader';
import NotificationDrawer from './components/NotificationDrawer';

// Dedicated Page Views
import OverviewPage from './components/OverviewPage';
import SmartHomePage from './components/SmartHomePage';
import PhantomRealityCheck from './components/PhantomRealityCheck';
import ThreatMonitorPage from './components/ThreatMonitorPage';
import AttackSimulatorPage from './components/AttackSimulatorPage';
import AutomationSecurityPage from './components/AutomationSecurityPage';
import NetworkSecurityPage from './components/NetworkSecurityPage';
import PrivacySettingsPage from './components/PrivacySettingsPage';

// Interactive Modals & Tools
import CommandPalette from './components/CommandPalette';
import TerminalDrawer from './components/TerminalDrawer';
import InvestigationModal from './components/InvestigationModal';

import './styles/phantom.css';

type Page =
  | 'overview'
  | 'smart-home'
  | 'reality-check'
  | 'threat-monitor'
  | 'simulator'
  | 'automation-security'
  | 'network'
  | 'policies'
  | 'privacy-settings'
  | 'login'
  | 'register'
  | 'verify'
  | 'recover'
  | 'reset'
  | 'onboarding'
  | 'not-found';

function normalizePage(rawPath: string): Page {
  const path = rawPath.split('?')[0].replace(/^#\/?/, '').replace(/\/$/, '');
  const invite = new URLSearchParams(rawPath.split('?')[1] || '').get('invite');
  if (invite) {
    try { sessionStorage.setItem('bulkhead.invite', invite); } catch { /* Ignore */ }
  }

  if (!path || path === 'overview') return 'overview';

  // Direct page matches
  if (['smart-home', 'reality-check', 'threat-monitor', 'simulator', 'automation-security', 'network', 'policies', 'privacy-settings'].includes(path)) {
    return path as Page;
  }

  // Account views
  if (['login', 'register', 'verify', 'recover', 'reset', 'onboarding'].includes(path)) {
    return path as Page;
  }

  // Legacy route aliases
  if (path === 'devices' || path === 'health') return 'smart-home';
  if (path === 'alerts' || path === 'timeline') return 'threat-monitor';
  if (path === 'simulation') return 'simulator';
  if (path === 'household') return 'privacy-settings';

  return 'not-found';
}

export default function App() {
  const [page, setPage] = useState<Page>(() => normalizePage(window.location.hash));
  const [routeHash, setRouteHash] = useState(window.location.hash);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [investigationTargetId, setInvestigationTargetId] = useState<string | null>(null);

  const session = useSession();
  const { state, stream, error, refresh } = useBulkhead();

  const accountView = ['login', 'register', 'verify', 'recover', 'reset', 'onboarding'].includes(page) ||
                      (page !== 'overview' && (!session.user || !session.home));

  useEffect(() => {
    const handleHashChange = () => {
      setPage(normalizePage(window.location.hash));
      setRouteHash(window.location.hash);
      setSidebarOpen(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Global Keyboard Shortcuts (Ctrl+K for Command Palette, Ctrl+` for Terminal)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(open => !open);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '`') {
        e.preventDefault();
        setTerminalOpen(open => !open);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const titles: Record<string, string> = {
      'overview': 'Cybersecurity Overview — PHANTOM × Bulkhead',
      'smart-home': 'Smart Home Devices & Topology — PHANTOM × Bulkhead',
      'reality-check': 'PHANTOM Reality Check & Evidence — PHANTOM × Bulkhead',
      'threat-monitor': 'Live Threat Monitor & Incidents — PHANTOM × Bulkhead',
      'simulator': 'Attack Simulator & Hackathon Demo — PHANTOM × Bulkhead',
      'automation-security': 'Automation Security & Approvals — PHANTOM × Bulkhead',
      'network': 'Network Security & Quarantine — PHANTOM × Bulkhead',
      'policies': 'Access Policies & Rules — PHANTOM × Bulkhead',
      'privacy-settings': 'Privacy & Household Governance — PHANTOM × Bulkhead',
      'login': 'Sign In — Bulkhead',
      'register': 'Create Account — Bulkhead'
    };
    document.title = titles[page] || 'PHANTOM × Bulkhead — Reality-Aware Smart Home Security';
  }, [page]);

  return (
    <div className="phantom-layout">
      {/* Global Interactive Command Palette (Ctrl+K) */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={target => { window.location.hash = `#/${target}`; }}
        onOpenTerminal={() => setTerminalOpen(true)}
        onOpenInvestigation={scId => setInvestigationTargetId(scId)}
      />

      {/* Forensic Deep Investigation Modal */}
      <InvestigationModal
        isOpen={Boolean(investigationTargetId)}
        onClose={() => setInvestigationTargetId(null)}
        targetId={investigationTargetId}
      />

      {/* Technical Event Terminal Drawer */}
      <TerminalDrawer
        isOpen={terminalOpen}
        onClose={() => setTerminalOpen(false)}
      />

      {/* Sidebar Navigation */}
      {!accountView && session.user && (
        <PhantomSidebar
          activePage={page}
          isMobileOpen={sidebarOpen}
          onCloseMobile={() => setSidebarOpen(false)}
        />
      )}

      {/* Main App Container */}
      <div className="phantom-body">
        {/* Top Header Bar */}
        <PhantomHeader
          onToggleSidebar={() => setSidebarOpen(open => !open)}
          onOpenNotifications={() => setNotificationsOpen(true)}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onToggleTerminal={() => setTerminalOpen(open => !open)}
        />

        {/* Global Notifications Drawer */}
        <NotificationDrawer
          isOpen={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
          onSelectIncident={id => setSelectedIncidentId(id)}
        />

        {/* Main Content View */}
        <main id="main-content" className="phantom-page-content" tabIndex={-1}>
          {accountView ? (
            <AccountPages key={routeHash} page={page as any} />
          ) : !session.user ? (
            <div data-active-page="true">
              <LandingIntro />
            </div>
          ) : (
            <>
              {error && (
                <div role="alert" className="app-error" style={{ marginBottom: '20px' }}>
                  {error} · Displayed telemetry may be stale.{' '}
                  <button type="button" className="app-link" onClick={refresh}>
                    Retry
                  </button>
                </div>
              )}

              {/* Page Views */}
              {page === 'overview' && <OverviewPage />}
              {page === 'smart-home' && <SmartHomePage />}
              {page === 'reality-check' && <PhantomRealityCheck />}
              {page === 'threat-monitor' && <ThreatMonitorPage />}
              {page === 'simulator' && <AttackSimulatorPage />}
              {page === 'automation-security' && <AutomationSecurityPage />}
              {page === 'network' && <NetworkSecurityPage />}
              {page === 'policies' && <PoliciesPage />}
              {page === 'privacy-settings' && <PrivacySettingsPage />}

              {page === 'not-found' && (
                <section className="phantom-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <h2 style={{ fontSize: '24px', margin: '0 0 10px' }}>Page Not Found</h2>
                  <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '20px' }}>
                    The requested view is not mapped in this cybersecurity center.
                  </p>
                  <a href="#/" className="phantom-btn-primary">
                    Return to Overview
                  </a>
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
