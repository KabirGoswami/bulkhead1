import React from 'react';
import {
  Shield, Bell, Radio, User, LogOut, Menu,
  Layers, CheckCircle2, AlertTriangle, Wifi, Server
} from 'lucide-react';
import { useBulkhead, useSession } from '../lib/session';
import ThemePicker from './ThemePicker';

interface PhantomHeaderProps {
  onToggleSidebar: () => void;
  onOpenNotifications: () => void;
  onOpenCommandPalette?: () => void;
  onToggleTerminal?: () => void;
}

export default function PhantomHeader({
  onToggleSidebar,
  onOpenNotifications,
  onOpenCommandPalette,
  onToggleTerminal
}: PhantomHeaderProps) {
  const { state, stream } = useBulkhead();
  const session = useSession();

  const isConnected = stream === 'Live' && state?.worker?.healthy;
  const incidents = state?.incidents || [];
  const unreadAlerts = incidents.filter((i: any) => i.status === 'open').length;

  return (
    <header className="phantom-topbar">
      <div className="phantom-topbar__left">
        {/* Mobile Sidebar Toggle Button */}
        <button
          type="button"
          className="phantom-mobile-toggle"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
        >
          <Menu size={18} />
        </button>

        {/* Active Household Selector */}
        {session.user && (
          <div className="phantom-household-picker">
            <span style={{ color: 'var(--muted)', fontSize: '11px' }}>Home:</span>
            <select
              value={session.home?.id || ''}
              onChange={e => session.choose(e.target.value)}
              aria-label="Active household selector"
            >
              {session.homes.map(h => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Live Stream / Connection Status Indicator */}
        <div className="phantom-status-indicator">
          <span className={`status-dot ${isConnected ? '' : 'status-dot--offline'}`} />
          <span>
            {isConnected ? 'Live · Worker Healthy' : `${stream} · ${state?.worker?.healthy ? 'Worker Healthy' : 'Worker Offline'}`}
          </span>
        </div>

        {/* Command Palette Trigger Button */}
        {onOpenCommandPalette && (
          <button
            type="button"
            className="phantom-cmd-trigger-btn"
            onClick={onOpenCommandPalette}
            title="Open Command Palette (Ctrl+K or Cmd+K)"
          >
            <span>Command Palette</span>
            <kbd>⌘K</kbd>
          </button>
        )}
      </div>

      <div className="phantom-topbar__right">
        {/* Technical Event Terminal Drawer Shortcut */}
        {onToggleTerminal && (
          <button
            type="button"
            className="phantom-btn-secondary"
            onClick={onToggleTerminal}
            style={{ padding: '5px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Toggle Live Event Terminal (Ctrl+` or Cmd+`)"
          >
            <Radio size={13} color="var(--accent)" />
            <span>Terminal</span>
          </button>
        )}

        {/* In-App Notifications Shortcut */}
        <button
          type="button"
          className="phantom-icon-btn"
          onClick={onOpenNotifications}
          aria-label="Open notifications"
          title="Security Notifications"
        >
          <Bell size={17} />
          {unreadAlerts > 0 && (
            <span className="phantom-icon-btn__badge">{unreadAlerts}</span>
          )}
        </button>

        {/* Theme Picker */}
        <ThemePicker />

        {/* User Profile & Role */}
        {session.user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="phantom-user-pill">
              <User size={13} color="var(--accent)" />
              <span style={{ fontWeight: 600 }}>{session.user.email}</span>
              <span className="phantom-user-role">{session.home?.role || 'Viewer'}</span>
            </div>
            <button
              type="button"
              className="phantom-signout-btn"
              onClick={() => session.logout()}
              title="Sign out of Bulkhead"
            >
              <LogOut size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} />
              Sign out
            </button>
          </div>
        ) : (
          <a href="#/login" className="phantom-btn-primary" style={{ padding: '6px 14px', fontSize: '12px' }}>
            Sign in
          </a>
        )}
      </div>
    </header>
  );
}
