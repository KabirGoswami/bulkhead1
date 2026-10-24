import React, { useState } from 'react';
import {
  Shield, Network, ShieldAlert, KeyRound, PlayCircle,
  Activity, ArrowRight, CheckCircle2, Clock,
  Cpu, Users, RefreshCw, Zap, Server
} from 'lucide-react';
import { useBulkhead, useSession } from '../lib/session';
import { post, errorText } from '../lib/api';
import InvestigationModal from './InvestigationModal';

export default function OverviewPage() {
  const { state, stream, refresh, liveEvents, path, canWrite } = useBulkhead();
  const session = useSession();
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState('');
  const [actionErr, setActionErr] = useState('');
  const [hoveredEventIdx, setHoveredEventIdx] = useState<number | null>(null);
  const [investigationIncident, setInvestigationIncident] = useState<any | null>(null);

  const exposureScore = state?.exposure_score ?? 0;
  const devices = state?.devices || [];
  const accounts = state?.accounts || [];
  const incidents = state?.incidents || [];
  const actions = state?.actions || [];
  const activeIncidents = incidents.filter((i: any) => i.status !== 'resolved');
  const pendingApprovals = incidents.filter((i: any) => i.status !== 'resolved' && i.alert?.response?.requires_confirmation);
  const protectedAutomations = actions.filter((a: any) => a.execution_mode === 'simulation');

  // Trigger quick scenarios from overview
  const runQuickScenario = async (scenarioId: string) => {
    setRunningAction(scenarioId);
    setActionMsg('');
    setActionErr('');
    try {
      await post(path(`/scenarios/${scenarioId}`));
      setActionMsg(`Scenario ${scenarioId} started successfully.`);
      await refresh();
    } catch (err) {
      setActionErr(errorText(err));
    } finally {
      setRunningAction(null);
    }
  };

  const resetScenario = async () => {
    setRunningAction('reset');
    setActionMsg('');
    setActionErr('');
    try {
      const res = await post(path('/scenarios/reset'));
      setActionMsg(res.message || 'Simulation reset.');
      await refresh();
    } catch (err) {
      setActionErr(errorText(err));
    } finally {
      setRunningAction(null);
    }
  };

  const latestIncident = activeIncidents[0] || incidents[0];

  return (
    <div className="phantom-overview">
      {/* Forensic Deep Investigation Modal */}
      <InvestigationModal
        isOpen={Boolean(investigationIncident)}
        onClose={() => setInvestigationIncident(null)}
        incident={investigationIncident}
      />

      <header className="phantom-page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '8px' }}>
          <div className="phantom-page-eyebrow" style={{ margin: 0 }}>
            <span>01 / SECURITY OVERVIEW</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className={`status-dot ${state?.worker?.healthy ? '' : 'status-dot--offline'}`} />
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-jb)', color: state?.worker?.healthy ? 'var(--verified)' : 'var(--muted)', letterSpacing: '0.5px' }}>
              {state?.worker?.healthy ? '[MONITORING ACTIVE] — ALL SENSORS CORRELATED' : '[MONITORING STANDBY] — TELEMETRY IDLE'}
            </span>
          </div>
        </div>
        <h1 className="phantom-page-title" style={{ fontSize: '34px', letterSpacing: '-1.5px', textTransform: 'uppercase' }}>
          {state?.worker?.healthy ? 'THE HOUSE IS UNDER WATCH.' : 'HOME SECURITY MONITORING IN STANDBY.'}
        </h1>
        <p className="phantom-page-subtitle">
          Continuous contextual integrity auditing for {session.home?.name || 'your household'}.
          Evaluating device identities, telemetry plausibility, and automated physical actions.
        </p>
      </header>

      {actionMsg && <div role="status" className="app-notice" style={{ marginBottom: '20px' }}>{actionMsg}</div>}
      {actionErr && <div role="alert" className="app-error" style={{ marginBottom: '20px' }}>{actionErr}</div>}

      {/* 6 Key Summary Cards with Hover Disclosures */}
      <section className="phantom-grid-6" aria-label="Key security metrics">
        {/* Card 1: Overall Security Status */}
        <article className="phantom-stat-card interactive-hover-card">
          <div className="phantom-stat-card__header">
            <span>Exposure Score</span>
            <Shield size={16} color="var(--accent)" />
          </div>
          <div className="phantom-stat-card__value">
            {state ? Math.round(exposureScore) : '—'}
            <span style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 400 }}>/100</span>
          </div>
          <div className="phantom-stat-card__sub">
            <span className={`phantom-badge ${exposureScore > 50 ? 'phantom-badge--amber' : 'phantom-badge--green'}`}>
              {exposureScore > 50 ? 'Elevated Exposure' : 'Low Baseline Risk'}
            </span>
          </div>
          <div className="hover-expand-tip">
            Deterministic risk weighting across all {devices.length} network endpoints.
          </div>
        </article>

        {/* Card 2: Connected Devices */}
        <article className="phantom-stat-card interactive-hover-card">
          <div className="phantom-stat-card__header">
            <span>Connected Devices</span>
            <Cpu size={16} color="var(--accent)" />
          </div>
          <div className="phantom-stat-card__value">{devices.length}</div>
          <div className="phantom-stat-card__sub">
            <span style={{ color: 'var(--muted)' }}>
              {devices.filter((d: any) => d.isolated).length} isolated · {accounts.length} linked accounts
            </span>
          </div>
          <div className="hover-expand-tip">
            Physical IoT devices in isolated subnet zones.
          </div>
        </article>

        {/* Card 3: Active Incidents */}
        <article className="phantom-stat-card interactive-hover-card">
          <div className="phantom-stat-card__header">
            <span>Active Incidents</span>
            <ShieldAlert size={16} color={activeIncidents.length ? 'var(--danger)' : 'var(--muted)'} />
          </div>
          <div className="phantom-stat-card__value" style={{ color: activeIncidents.length ? 'var(--danger)' : 'inherit' }}>
            {activeIncidents.length}
          </div>
          <div className="phantom-stat-card__sub">
            <span className={`phantom-badge ${activeIncidents.length ? 'phantom-badge--red' : 'phantom-badge--green'}`}>
              {activeIncidents.length ? `${activeIncidents.length} Unresolved` : 'Clean Baseline'}
            </span>
          </div>
          <div className="hover-expand-tip">
            Click to launch forensic investigation console.
          </div>
        </article>

        {/* Card 4: Live Telemetry Events */}
        <article className="phantom-stat-card interactive-hover-card">
          <div className="phantom-stat-card__header">
            <span>Live Stream Events</span>
            <Activity size={16} color="var(--accent)" />
          </div>
          <div className="phantom-stat-card__value">
            {liveEvents.length > 0 ? liveEvents.length : state?.sequence ?? '0'}
          </div>
          <div className="phantom-stat-card__sub">
            <span style={{ color: 'var(--muted)' }}>
              {stream === 'Live' ? 'Real-time WebSocket' : stream}
            </span>
          </div>
          <div className="hover-expand-tip">
            Continuous sequence buffer from smart home gateway.
          </div>
        </article>

        {/* Card 5: Protected Actions */}
        <article className="phantom-stat-card interactive-hover-card">
          <div className="phantom-stat-card__header">
            <span>Protected Automations</span>
            <KeyRound size={16} color="var(--accent)" />
          </div>
          <div className="phantom-stat-card__value">{protectedAutomations.length}</div>
          <div className="phantom-stat-card__sub">
            <span style={{ color: 'var(--muted)' }}>
              {actions.filter((a: any) => a.state === 'verified').length} verified active
            </span>
          </div>
          <div className="hover-expand-tip">
            Actions protected against blind single-sensor execution.
          </div>
        </article>

        {/* Card 6: Pending Approvals */}
        <article className="phantom-stat-card interactive-hover-card">
          <div className="phantom-stat-card__header">
            <span>Pending Approvals</span>
            <Clock size={16} color={pendingApprovals.length ? 'var(--warning)' : 'var(--muted)'} />
          </div>
          <div className="phantom-stat-card__value" style={{ color: pendingApprovals.length ? 'var(--warning)' : 'inherit' }}>
            {pendingApprovals.length}
          </div>
          <div className="phantom-stat-card__sub">
            <span className={`phantom-badge ${pendingApprovals.length ? 'phantom-badge--amber' : 'phantom-badge--green'}`}>
              {pendingApprovals.length ? `${pendingApprovals.length} Requires Owner Confirmation` : 'No Holds'}
            </span>
          </div>
          <div className="hover-expand-tip">
            Owner authorization requests for high-risk holds.
          </div>
        </article>
      </section>

      {/* Latest Incident Spotlight (if an incident exists) */}
      {latestIncident && (
        <section className="phantom-card incident-spotlight-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="incident-spotlight-icon">
                <ShieldAlert size={20} color="var(--danger)" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="phantom-badge phantom-badge--red">LATEST ANOMALY DETECTED</span>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-jb)' }}>
                    {new Date(latestIncident.created_at || Date.now()).toLocaleTimeString()}
                  </span>
                </div>
                <strong style={{ fontSize: '14px', marginTop: '2px', display: 'block' }}>
                  {latestIncident.title || 'Anomalous Lateral Flow from IoT Plug'}
                </strong>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                  {latestIncident.summary || 'Device attempted unverified connection to management port. Policy hold active.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              className="phantom-btn-primary"
              onClick={() => setInvestigationIncident(latestIncident)}
              style={{ padding: '8px 16px', fontSize: '12px' }}
            >
              Forensic Investigation <ArrowRight size={13} />
            </button>
          </div>
        </section>
      )}

      {/* Quick Action Shortcuts Bar */}
      <section className="phantom-card" style={{ padding: '18px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <span className="phantom-badge phantom-badge--green" style={{ marginBottom: '4px' }}>Fast Validation</span>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Quick Simulation & Verification Actions</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="phantom-btn-secondary"
              onClick={() => runQuickScenario('A')}
              disabled={runningAction !== null || !canWrite}
            >
              <Zap size={14} color="var(--warning)" />
              {runningAction === 'A' ? 'Starting...' : 'Trigger Plug Attack (A)'}
            </button>
            <button
              type="button"
              className="phantom-btn-secondary"
              onClick={() => runQuickScenario('B')}
              disabled={runningAction !== null || !canWrite}
            >
              <KeyRound size={14} color="var(--danger)" />
              {runningAction === 'B' ? 'Starting...' : 'Trigger Credential Takeover (B)'}
            </button>
            <button
              type="button"
              className="phantom-btn-secondary"
              onClick={resetScenario}
              disabled={runningAction !== null || !canWrite}
            >
              <RefreshCw size={14} />
              Reset
            </button>
            <a href="#/reality-check" className="phantom-btn-primary">
              PHANTOM Reality Check <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </section>

      {/* Main 2-Column Dashboard Area */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px' }}>
        {/* Left Column: Security Activity Timeline & Recent Threats */}
        <div>
          {/* Security Activity Timeline */}
          <section className="phantom-card">
            <div className="phantom-card-header">
              <div>
                <h2 className="phantom-card-title">
                  <Activity size={18} color="var(--accent)" /> Live Security Activity Timeline
                </h2>
                <span className="phantom-card-subtitle">Real-time device signals, access decisions, and simulation flows</span>
              </div>
              <span className="phantom-badge phantom-badge--green">
                {stream === 'Live' ? 'Live Stream' : 'Connecting'}
              </span>
            </div>

            <div style={{ maxHeight: '340px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {liveEvents.length > 0 ? (
                liveEvents.slice(0, 12).map((ev: any, idx: number) => {
                  const isBlocked = ev.blocked || ev.port === 8080 || ev.dst?.includes('evil-cnc');
                  const isHovered = hoveredEventIdx === idx;

                  return (
                    <div
                      key={idx}
                      onMouseEnter={() => setHoveredEventIdx(idx)}
                      onMouseLeave={() => setHoveredEventIdx(null)}
                      style={{
                        padding: '10px 14px',
                        background: isHovered ? '#161616' : 'var(--surface-raised)',
                        border: '1px solid',
                        borderColor: isHovered ? 'var(--accent)' : 'var(--border)',
                        borderLeft: isHovered ? '3px solid var(--accent)' : '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        transition: 'all 140ms ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className={`phantom-badge ${isBlocked ? 'phantom-badge--red' : 'phantom-badge--green'}`}>
                            {isBlocked ? 'BLOCKED' : ev.geo ? 'AUTH' : 'FLOW'}
                          </span>
                          <div>
                            <strong>{devices.find((d: any) => d.id === ev.src)?.name || ev.src || ev.account_id || 'System'}</strong>
                            <span style={{ color: 'var(--muted)', marginLeft: '6px', fontFamily: 'var(--font-jb)' }}>
                              {ev.dst ? `→ ${ev.dst}:${ev.port}` : ev.geo ? `geo: ${ev.geo} · ${ev.result}` : 'signal observed'}
                            </span>
                          </div>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-jb)' }}>
                          {ev.bytes ? `${(ev.bytes / 1024).toFixed(1)} KB` : new Date(ev.ts || Date.now()).toLocaleTimeString()}
                        </span>
                      </div>

                      {isHovered && (
                        <div style={{
                          paddingTop: '6px',
                          borderTop: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '10.5px',
                          fontFamily: 'var(--font-jb)',
                          color: 'var(--muted)'
                        }}>
                          <span>PROTOCOL: {ev.proto || 'TCP'}</span>
                          <span>SOURCE IP: {ev.src || '192.168.1.10'}</span>
                          <span>POLICY ACTION: {isBlocked ? 'TERMINATE FLOW' : 'ALLOW FLOW'}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--muted)', fontSize: '12px' }}>
                  <Activity size={24} style={{ opacity: 0.5, marginBottom: '8px' }} />
                  <p style={{ margin: 0 }}>Waiting for simulation ticks. Start a scenario to stream traffic.</p>
                </div>
              )}
            </div>
          </section>

          {/* Recent Threats Table */}
          <section className="phantom-card">
            <div className="phantom-card-header">
              <div>
                <h2 className="phantom-card-title">
                  <ShieldAlert size={18} color="var(--danger)" /> Recent Incidents & Threat Detections
                </h2>
                <span className="phantom-card-subtitle">Server-evaluated anomalies requiring automated or manual response</span>
              </div>
              <a href="#/threat-monitor" className="phantom-btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }}>
                View All ({incidents.length})
              </a>
            </div>

            {incidents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--muted)', fontSize: '12px' }}>
                <CheckCircle2 size={28} color="var(--accent)" style={{ marginBottom: '8px' }} />
                <p style={{ margin: 0 }}>No active threats detected. Household perimeter is nominal.</p>
              </div>
            ) : (
              <div className="phantom-table-wrap">
                <table className="phantom-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Target</th>
                      <th>Explanation</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidents.slice(0, 5).map((incident: any) => {
                      const alert = incident.alert;
                      const targetName = devices.find((d: any) => d.id === alert.node_id)?.name ||
                                        accounts.find((a: any) => a.id === alert.node_id)?.name ||
                                        alert.node_id;

                      return (
                        <tr key={incident.id}>
                          <td>
                            <span className={`phantom-badge ${incident.status === 'resolved' ? 'phantom-badge--green' : 'phantom-badge--red'}`}>
                              {incident.status}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600 }}>{targetName}</td>
                          <td style={{ color: 'var(--muted)', maxWidth: '280px' }}>
                            <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {alert.explanation}
                            </div>
                          </td>
                          <td>
                            <a
                              href="#/threat-monitor"
                              className="phantom-btn-secondary"
                              style={{ padding: '3px 8px', fontSize: '10.5px' }}
                            >
                              Inspect
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Smart Home Devices & Capabilities */}
        <div>
          {/* Smart Home Devices Grid */}
          <section className="phantom-card">
            <div className="phantom-card-header">
              <div>
                <h2 className="phantom-card-title">
                  <Network size={18} color="var(--accent)" /> Smart Home Inventory
                </h2>
                <span className="phantom-card-subtitle">{devices.length} verified devices registered</span>
              </div>
              <a href="#/smart-home" className="phantom-btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }}>
                Map View
              </a>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {devices.slice(0, 8).map((device: any) => (
                <div
                  key={device.id}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface-raised)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>{device.name}</span>
                    <span className={`phantom-badge ${device.isolated ? 'phantom-badge--red' : 'phantom-badge--green'}`} style={{ fontSize: '8.5px' }}>
                      {device.isolated ? 'Contained' : device.zone}
                    </span>
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'var(--muted)' }}>
                    {device.vendor} · {device.type}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Capabilities & Architecture Truth */}
          <section className="phantom-card">
            <div className="phantom-card-header">
              <h2 className="phantom-card-title">
                <Server size={18} color="var(--accent)" /> System Capabilities
              </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--muted)' }}>Execution Engine</span>
                <strong>Simulated Lab (Durable)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--muted)' }}>OpenWrt Adapter</span>
                <span>{state?.capabilities?.adapter_enabled ? 'Active' : 'Disabled (Simulation)'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--muted)' }}>Dry-Run Guard</span>
                <span>{state?.capabilities?.dry_run !== false ? 'Enabled (Safe)' : 'Enforced'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ color: 'var(--muted)' }}>Physical Device Control</span>
                <span className="phantom-badge phantom-badge--gray">Restricted / Lab Fixture</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
