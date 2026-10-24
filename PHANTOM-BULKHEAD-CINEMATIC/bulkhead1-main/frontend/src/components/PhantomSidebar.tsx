import React from 'react';
import {
  Shield, LayoutDashboard, Home, ShieldAlert, Fingerprint,
  PlayCircle, KeyRound, Network, SlidersHorizontal, X,
  Radio, Cpu, CheckCircle2, ChevronRight, UserCog
} from 'lucide-react';
import { useBulkhead, useSession } from '../lib/session';

interface PhantomSidebarProps {
  activePage: string;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export interface NavItem {
  id: string;
  label: string;
  icon: any;
  href: string;
  badge?: string;
  badgeColor?: string;
}

export const COMMAND_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, href: '#/' },
  { id: 'smart-home', label: 'Smart Home', icon: Home, href: '#/smart-home' },
  { id: 'threat-monitor', label: 'Threat Monitor', icon: ShieldAlert, href: '#/threat-monitor' },
];

export const SECURITY_ITEMS: NavItem[] = [
  { id: 'reality-check', label: 'PHANTOM Reality Check', icon: Fingerprint, href: '#/reality-check', badge: 'CORE', badgeColor: 'red' },
  { id: 'simulator', label: 'Attack Simulator', icon: PlayCircle, href: '#/simulator', badge: 'SIM', badgeColor: 'amber' },
  { id: 'automation-security', label: 'Automation Security', icon: KeyRound, href: '#/automation-security' },
  { id: 'network', label: 'Network Security', icon: Network, href: '#/network' },
  { id: 'policies', label: 'Policies', icon: Shield, href: '#/policies' },
];

export const SYSTEM_ITEMS: NavItem[] = [
  { id: 'privacy-settings', label: 'Privacy & Settings', icon: SlidersHorizontal, href: '#/privacy-settings' },
  { id: 'household', label: 'Household / Account', icon: UserCog, href: '#/household' },
];

export default function PhantomSidebar({ activePage, isMobileOpen, onCloseMobile }: PhantomSidebarProps) {
  const { state } = useBulkhead();
  const session = useSession();
  const exposureScore = state?.exposure_score ?? 0;
  const incidents = state?.incidents || [];
  const openAlerts = incidents.filter((i: any) => i.status === 'open').length;

  const renderNavGroup = (title: string, items: NavItem[]) => (
    <div className="phantom-nav-group" key={title}>
      <span className="phantom-nav-section-label">{title}</span>
      {items.map(item => {
        const Icon = item.icon;
        const isActive = activePage === item.id || (item.id === 'overview' && activePage === 'overview');
        const showAlertBadge = item.id === 'threat-monitor' && openAlerts > 0;

        return (
          <a
            key={item.id}
            href={item.href}
            className={`phantom-nav-item ${isActive ? 'is-active' : ''}`}
            onClick={onCloseMobile}
          >
            <Icon size={16} strokeWidth={1.75} />
            <span className="phantom-nav-text">{item.label}</span>
            {item.badge ? (
              <span className={`phantom-nav-item__badge phantom-badge phantom-badge--${item.badgeColor || 'red'}`}>
                {item.badge}
              </span>
            ) : showAlertBadge ? (
              <span className="phantom-nav-item__badge phantom-badge phantom-badge--red">
                {openAlerts}
              </span>
            ) : null}
          </a>
        );
      })}
    </div>
  );

  return (
    <aside className={`phantom-sidebar ${isMobileOpen ? 'is-mobile-open' : ''}`}>
      {/* Brand Header */}
      <div className="phantom-sidebar__brand">
        <a href="#/" className="phantom-brand-logo" onClick={onCloseMobile}>
          <div className="phantom-brand-icon">
            <svg width="22" height="22" viewBox="0 0 46 46" fill="none">
              <path d="M23 0V19.5" stroke="#C81B1C" strokeWidth="3" />
              <path d="M14 10.2L23 19.2L32 10.2" stroke="#C81B1C" strokeWidth="3" />
              <path d="M46 23H26.5" stroke="#FFF" strokeWidth="3" />
              <path d="M35.8 14L26.8 23L35.8 32" stroke="#FFF" strokeWidth="3" />
              <path d="M23 46V26.5" stroke="#C81B1C" strokeWidth="3" />
              <path d="M32 35.8L23 26.8L14 35.8" stroke="#C81B1C" strokeWidth="3" />
              <path d="M0 23H19.5" stroke="#FFF" strokeWidth="3" />
              <path d="M10.2 32L19.2 23L10.2 14" stroke="#FFF" strokeWidth="3" />
            </svg>
          </div>
          <div className="phantom-brand-title">
            <strong>
              PHANTOM
              <span style={{ color: 'var(--accent)', fontSize: '11px', margin: '0 2px' }}>×</span>
              BULKHEAD
            </strong>
            <span>REALITY-AWARE DEFENSE</span>
          </div>
        </a>

        {isMobileOpen && (
          <button
            type="button"
            className="phantom-icon-btn"
            onClick={onCloseMobile}
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Navigation Groups */}
      <nav className="phantom-nav" aria-label="Cybersecurity center navigation">
        {renderNavGroup('COMMAND', COMMAND_ITEMS)}
        {renderNavGroup('SECURITY', SECURITY_ITEMS)}
        {renderNavGroup('SYSTEM', SYSTEM_ITEMS)}
      </nav>

      {/* Footer Exposure Summary Meter */}
      <div className="phantom-sidebar__footer">
        <div className="phantom-sidebar-score">
          <span className="phantom-sidebar-score-label">HOME EXPOSURE</span>
          <span className="phantom-sidebar-score-val" style={{ color: exposureScore > 50 ? 'var(--warning)' : 'var(--accent)' }}>
            {state ? `${Math.round(exposureScore)}/100` : '—'}
          </span>
        </div>
        <div className="phantom-sidebar-bar">
          <div
            className="phantom-sidebar-bar-fill"
            style={{
              width: `${Math.min(100, Math.max(0, exposureScore))}%`,
              background: exposureScore > 50 ? 'var(--warning)' : 'var(--accent)'
            }}
          />
        </div>
        <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--muted)', fontFamily: 'var(--font-jb)' }}>
          <span>STATUS</span>
          <span style={{ color: state?.worker?.healthy ? 'var(--verified)' : 'var(--danger)' }}>
            {state?.worker?.healthy ? 'MONITORING ACTIVE' : 'WORKER STANDBY'}
          </span>
        </div>
      </div>
    </aside>
  );
}
