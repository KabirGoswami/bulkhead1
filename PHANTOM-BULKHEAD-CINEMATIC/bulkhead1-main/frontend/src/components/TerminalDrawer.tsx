import React, { useState } from 'react';
import {
  Terminal, X, ChevronDown, ChevronUp, Copy, Check,
  Filter, Trash2, ArrowUpRight, Activity, CircleDot
} from 'lucide-react';
import { useBulkhead } from '../lib/session';

interface TerminalDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TerminalDrawer({ isOpen, onClose }: TerminalDrawerProps) {
  const { liveEvents, stream, state } = useBulkhead();
  const [filterQuery, setFilterQuery] = useState('');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const filtered = liveEvents.filter((ev: any) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      (ev.src && ev.src.toLowerCase().includes(q)) ||
      (ev.dst && ev.dst.toLowerCase().includes(q)) ||
      (ev.proto && ev.proto.toLowerCase().includes(q)) ||
      (ev.device_id && ev.device_id.toLowerCase().includes(q)) ||
      (ev.event_type && ev.event_type.toLowerCase().includes(q))
    );
  });

  const handleCopy = (json: string, idx: number) => {
    navigator.clipboard.writeText(json);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  return (
    <div className="terminal-drawer-container">
      {/* Drawer Header */}
      <div className="terminal-drawer-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Terminal size={16} color="var(--accent)" />
          <strong style={{ fontSize: '13px', letterSpacing: '0.5px' }}>
            PHANTOM TELEMETRY STREAM & EVENT INGRESS TERMINAL
          </strong>
          <span className="phantom-badge phantom-badge--green" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span className="status-dot" style={{ width: '6px', height: '6px' }} />
            {stream === 'Live' ? 'WEBSOCKET ACTIVE' : stream}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-jb)' }}>
            BUFFER: {liveEvents.length} FRAMES
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Quick Filter */}
          <div className="terminal-filter-box">
            <Filter size={12} color="var(--muted)" />
            <input
              type="text"
              placeholder="Filter IP, port, proto..."
              value={filterQuery}
              onChange={e => setFilterQuery(e.target.value)}
              className="terminal-filter-input"
            />
          </div>

          <button
            type="button"
            className="phantom-icon-btn"
            onClick={onClose}
            aria-label="Close terminal"
            title="Minimize terminal"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Terminal Output Body */}
      <div className="terminal-drawer-body">
        {filtered.length === 0 ? (
          <div className="terminal-empty-log">
            <span className="terminal-cursor">_</span>
            {liveEvents.length === 0
              ? 'No live ingress packets buffered yet. Start a simulation or wait for smart-home sensor ticks.'
              : 'No packets match the active filter.'}
          </div>
        ) : (
          filtered.slice(0, 50).map((ev: any, idx: number) => {
            const isBlocked = ev.blocked || ev.port === 8080 || ev.dst?.includes('evil-cnc');
            const isExpanded = expandedIndex === idx;
            const rawJson = JSON.stringify(ev, null, 2);

            return (
              <div key={idx} className={`terminal-log-row ${isBlocked ? 'is-blocked' : ''}`}>
                <div
                  className="terminal-row-summary"
                  onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                >
                  <span className="t-time">
                    {new Date(ev._timestamp || Date.now()).toISOString().substring(11, 23)}
                  </span>
                  <span className={`t-verdict ${isBlocked ? 'verdict-blocked' : 'verdict-allowed'}`}>
                    {isBlocked ? 'BLOCKED' : ev.geo ? 'AUTH_VERIFIED' : 'FLOW_OK'}
                  </span>
                  <span className="t-proto">{ev.proto || 'TCP'}</span>
                  <span className="t-endpoint">
                    {ev.src || '192.168.1.10'}:{ev.port || 443}
                    <span style={{ color: 'var(--muted)', margin: '0 4px' }}>→</span>
                    {ev.dst || 'benign-cloud'}
                  </span>
                  {ev.bytes && <span className="t-bytes">{(ev.bytes / 1024).toFixed(1)} KB</span>}

                  <div className="terminal-row-tools">
                    <button
                      type="button"
                      className="t-tool-btn"
                      onClick={e => { e.stopPropagation(); handleCopy(rawJson, idx); }}
                      title="Copy raw JSON"
                    >
                      {copiedIndex === idx ? <Check size={12} color="var(--verified)" /> : <Copy size={12} />}
                    </button>
                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="terminal-raw-json">
                    <pre>{rawJson}</pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
