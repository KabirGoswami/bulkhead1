import React, { useState, useEffect } from 'react';
import {
  Search, Terminal, Play, Shield, Home, Cpu, KeyRound,
  SlidersHorizontal, Radio, X, ArrowRight, CornerDownLeft
} from 'lucide-react';
import { useBulkhead } from '../lib/session';
import { post } from '../lib/api';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: string) => void;
  onOpenTerminal: () => void;
  onOpenInvestigation: (scenarioId: string) => void;
}

export default function CommandPalette({
  isOpen,
  onClose,
  onNavigate,
  onOpenTerminal,
  onOpenInvestigation
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { path, refresh } = useBulkhead();

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const actions = [
    {
      id: 'nav-overview',
      category: 'Navigation',
      label: 'Go to Security Overview',
      shortcut: 'G O',
      action: () => { onNavigate('overview'); onClose(); }
    },
    {
      id: 'nav-smart-home',
      category: 'Navigation',
      label: 'Inspect Smart Home Device Map',
      shortcut: 'G S',
      action: () => { onNavigate('smart-home'); onClose(); }
    },
    {
      id: 'nav-reality-check',
      category: 'Navigation',
      label: 'Open PHANTOM Reality Check Engine',
      shortcut: 'G R',
      action: () => { onNavigate('reality-check'); onClose(); }
    },
    {
      id: 'nav-simulator',
      category: 'Navigation',
      label: 'Open Interactive Attack Simulator',
      shortcut: 'G A',
      action: () => { onNavigate('simulator'); onClose(); }
    },
    {
      id: 'nav-threat-monitor',
      category: 'Navigation',
      label: 'View Live Threat Monitor & Incidents',
      shortcut: 'G T',
      action: () => { onNavigate('threat-monitor'); onClose(); }
    },
    {
      id: 'nav-automation',
      category: 'Navigation',
      label: 'Review Automation Approvals & Policy Bounds',
      shortcut: 'G P',
      action: () => { onNavigate('automation-security'); onClose(); }
    },
    {
      id: 'nav-network',
      category: 'Navigation',
      label: 'Inspect Network Security & Quarantine',
      shortcut: 'G N',
      action: () => { onNavigate('network'); onClose(); }
    },
    {
      id: 'action-terminal',
      category: 'Tools',
      label: 'Toggle Technical Event Terminal Drawer',
      shortcut: '⌘ `',
      action: () => { onOpenTerminal(); onClose(); }
    },
    {
      id: 'action-investigate-a',
      category: 'Forensics',
      label: 'Investigate Scenario A (Lateral Plug Exploit)',
      shortcut: 'INV A',
      action: () => { onOpenInvestigation('backend-a'); onClose(); }
    },
    {
      id: 'action-investigate-b',
      category: 'Forensics',
      label: 'Investigate Scenario B (Credential Unlock Hijack)',
      shortcut: 'INV B',
      action: () => { onOpenInvestigation('backend-b'); onClose(); }
    },
    {
      id: 'action-run-a',
      category: 'Simulation',
      label: 'Execute Scenario A on Backend (Smart Plug)',
      shortcut: 'RUN A',
      action: async () => {
        try { await post(path('/scenarios/A')); await refresh(); } catch {}
        onClose();
      }
    },
    {
      id: 'action-run-b',
      category: 'Simulation',
      label: 'Execute Scenario B on Backend (Credential Takeover)',
      shortcut: 'RUN B',
      action: async () => {
        try { await post(path('/scenarios/B')); await refresh(); } catch {}
        onClose();
      }
    },
    {
      id: 'action-reset-sim',
      category: 'Simulation',
      label: 'Reset Simulation to Nominal Baseline',
      shortcut: 'RESET',
      action: async () => {
        try { await post(path('/scenarios/reset')); await refresh(); } catch {}
        onClose();
      }
    }
  ];

  const filtered = actions.filter(a =>
    a.label.toLowerCase().includes(query.toLowerCase()) ||
    a.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => (i + 1) % Math.max(1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => (i - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="cmd-palette-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Command Palette">
      <div className="cmd-palette-modal" onClick={e => e.stopPropagation()}>
        <div className="cmd-palette-input-wrap">
          <Search size={18} color="var(--accent)" />
          <input
            autoFocus
            type="text"
            className="cmd-palette-input"
            placeholder="Type a command or jump to page... (e.g. 'Simulator', 'Investigate', 'Terminal')"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
          />
          <button type="button" className="cmd-palette-close" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        <div className="cmd-palette-list">
          {filtered.length === 0 ? (
            <div className="cmd-palette-empty">No matching commands found.</div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  className={`cmd-palette-item ${isSelected ? 'is-selected' : ''}`}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className="cmd-palette-item-left">
                    <span className="cmd-palette-cat">{item.category}</span>
                    <span className="cmd-palette-label">{item.label}</span>
                  </div>
                  <div className="cmd-palette-item-right">
                    <kbd className="cmd-palette-key">{item.shortcut}</kbd>
                    <CornerDownLeft size={13} className="cmd-palette-enter" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="cmd-palette-footer">
          <span>Use <strong>↑↓</strong> to navigate</span>
          <span><strong>↵</strong> to select</span>
          <span><strong>ESC</strong> to close</span>
        </div>
      </div>
    </div>
  );
}
