import React, { useState } from 'react';
import {
  Network, Shield, CircleDot, Router, KeyRound, ExternalLink,
  AlertTriangle, CheckCircle2, Lock, ArrowRight, Copy, Check
} from 'lucide-react';
import { useBulkhead, useSession } from '../lib/session';
import { post, errorText } from '../lib/api';
import HomeMap from './HomeMap';

export default function NetworkSecurityPage() {
  const { state, path, canWrite } = useBulkhead();
  const session = useSession();
  const [enrollmentToken, setEnrollmentToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [copied, setCopied] = useState(false);

  const capabilities = state?.capabilities;
  const isOwner = session.home?.role === 'Owner';

  // Request gateway agent enrollment token
  const handleGenerateEnrollment = async () => {
    setTokenLoading(true);
    setTokenError('');
    try {
      const res = await post(path('/integrations/gateway/enrollment'));
      setEnrollmentToken(res.enrollment_token);
    } catch (err) {
      setTokenError(errorText(err));
    } finally {
      setTokenLoading(false);
    }
  };

  const copyToken = () => {
    if (!enrollmentToken) return;
    navigator.clipboard.writeText(enrollmentToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="phantom-network">
      <header className="phantom-page-header">
        <div className="phantom-page-eyebrow">
          <Network size={13} />
          <span>NETWORK TOPOLOGY & GATEWAY QUARANTINE</span>
        </div>
        <h1 className="phantom-page-title">Network Security & Isolation</h1>
        <p className="phantom-page-subtitle">
          Map device peer connections, trace compromise reachability across zones, and inspect
          the restricted OpenWrt gateway quarantine adapter.
        </p>
      </header>

      {/* Interactive Topology Graph */}
      <section className="network-panel" style={{ height: '620px', marginBottom: '24px' }}>
        <div className="panel-heading">
          <div>
            <span className="section-eyebrow">Interactive Blast Radius Analyzer</span>
            <h2><Network size={18} /> Network Topology Graph</h2>
          </div>
          <span className="panel-tag">Select any device to highlight reachable blast radius</span>
        </div>
        <div className="network-panel__canvas">
          <HomeMap />
        </div>
        <div className="network-panel__caption">
          <CircleDot size={14} color="var(--accent)" />
          Click any device node to query <code>/api/v1/households/{'{id}'}/blast/{'{node_id}'}</code> and visualize peer propagation risks.
        </div>
      </section>

      {/* Gateway Agent Quarantine & Truth Boundary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
        {/* OpenWrt Quarantine Adapter Status */}
        <section className="phantom-card">
          <div className="phantom-card-header">
            <div>
              <h2 className="phantom-card-title">
                <Router size={18} color="var(--accent)" /> OpenWrt Router Gateway Adapter
              </h2>
              <span className="phantom-card-subtitle">
                Restricted hardware quarantine fixture for physical router testing
              </span>
            </div>
            <span className={`phantom-badge ${capabilities?.adapter_enabled ? 'phantom-badge--green' : 'phantom-badge--amber'}`}>
              {capabilities?.adapter_enabled ? 'Adapter Enabled' : 'Adapter Disabled (Simulation)'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12.5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--muted)' }}>Adapter Mode:</span>
              <strong>{capabilities?.execution_mode || 'simulation'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--muted)' }}>Dry-Run Guard:</span>
              <span>{capabilities?.dry_run !== false ? 'Active (Safe Mode)' : 'Disabled'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--muted)' }}>Physical Actuator Enforcement:</span>
              <span className="phantom-badge phantom-badge--gray">Restricted / Lab Fixture Only</span>
            </div>
          </div>

          <div style={{
            marginTop: '18px',
            padding: '12px 14px',
            borderRadius: '8px',
            background: 'var(--surface-raised)',
            border: '1px solid var(--border)',
            fontSize: '11.5px',
            color: 'var(--muted)',
            lineHeight: 1.5
          }}>
            <AlertTriangle size={14} color="var(--warning)" style={{ display: 'inline', marginRight: '6px' }} />
            <strong>Hardware Scope Disclaimer:</strong> The Bulkhead OpenWrt adapter manages only synthetic nftables rules (table <code>bulkhead</code>) on approved lab fixtures. It never controls arbitrary third-party smart locks or vendor cloud infrastructure.
          </div>
        </section>

        {/* Gateway Agent Enrollment */}
        <section className="phantom-card">
          <div className="phantom-card-header">
            <div>
              <h2 className="phantom-card-title">
                <KeyRound size={18} color="var(--accent)" /> Gateway Agent Enrollment
              </h2>
              <span className="phantom-card-subtitle">
                Generate single-use token to pair an authorized OpenWrt agent
              </span>
            </div>
          </div>

          {tokenError && <div role="alert" className="app-error" style={{ marginBottom: '14px' }}>{tokenError}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.5 }}>
              Owners can issue a 10-minute temporary enrollment token for the router agent running in your home lab.
            </p>

            {enrollmentToken ? (
              <div style={{
                padding: '12px',
                borderRadius: '8px',
                background: 'var(--surface-raised)',
                border: '1px solid var(--accent)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 600 }}>Enrollment Token (Expires in 10m):</span>
                <code style={{ fontSize: '11px', wordBreak: 'break-all', color: 'var(--text)' }}>
                  {enrollmentToken}
                </code>
                <button
                  type="button"
                  className="phantom-btn-secondary"
                  onClick={copyToken}
                  style={{ alignSelf: 'flex-start', marginTop: '4px', fontSize: '11px', padding: '4px 10px' }}
                >
                  {copied ? <Check size={12} color="var(--accent)" /> : <Copy size={12} />}
                  {copied ? 'Copied to Clipboard' : 'Copy Token'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="phantom-btn-secondary"
                onClick={handleGenerateEnrollment}
                disabled={tokenLoading || !isOwner}
                style={{ alignSelf: 'flex-start' }}
              >
                <KeyRound size={14} />
                {tokenLoading ? 'Generating...' : 'Issue Agent Enrollment Token'}
              </button>
            )}

            {!isOwner && (
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                * Only the household Owner may issue agent enrollment tokens.
              </span>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
