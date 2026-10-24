import React, { useState } from 'react';
import {
  ShieldAlert, ShieldCheck, CheckCircle2, Clock, Search, Filter,
  ArrowUpDown, AlertTriangle, KeyRound, Radio, ExternalLink,
  ChevronDown, ChevronUp, Undo2, Lock, Unlock
} from 'lucide-react';
import { useBulkhead } from '../lib/session';
import { post, api, errorText } from '../lib/api';

export default function ThreatMonitorPage() {
  const { state, path, stream, refresh, canWrite } = useBulkhead();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'acknowledged' | 'resolved'>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [expandedIncident, setExpandedIncident] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Command keys for idempotency
  const [commandKeys] = useState(() => new Map<string, string>());

  const incidents = state?.incidents || [];
  const devices = state?.devices || [];
  const accounts = state?.accounts || [];
  const actions = state?.actions || [];

  // Filtering and sorting
  const filteredIncidents = incidents.filter((incident: any) => {
    const alert = incident.alert;
    const targetName = devices.find((d: any) => d.id === alert.node_id)?.name ||
                      accounts.find((a: any) => a.id === alert.node_id)?.name ||
                      alert.node_id;

    const matchesSearch = targetName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          alert.explanation.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          alert.reason_codes.some((c: string) => c.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || incident.status === statusFilter;
    const matchesSeverity = severityFilter === 'all' || alert.confidence?.toLowerCase() === severityFilter;

    return matchesSearch && matchesStatus && matchesSeverity;
  });

  // Action executor
  const executeAction = async (id: string, actionFn: () => Promise<any>, successMsg: string) => {
    setBusyId(id);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await actionFn();
      setSuccessMessage(successMsg);
      await refresh();
    } catch (err) {
      setErrorMessage(errorText(err));
    } finally {
      setBusyId(null);
    }
  };

  // Confirm containment or account revocation
  const handleConfirmAction = (incident: any) => {
    if (!commandKeys.has(incident.id)) {
      commandKeys.set(incident.id, crypto.randomUUID());
    }
    const cmdId = commandKeys.get(incident.id)!;
    const actionType = incident.alert?.response?.action;

    return executeAction(
      incident.id,
      () => post(path('/actions'), {
        incident_id: incident.id,
        action: actionType,
        policy_revision: state.policy_revision,
        command_id: cmdId
      }),
      `Confirmed simulated ${actionType === 'REVOKE' ? 'account revocation' : 'containment'} for incident.`
    );
  };

  // Undo action
  const handleUndoAction = (actionId: string, incidentId: string) => {
    return executeAction(
      actionId,
      async () => {
        const res = await post(path(`/actions/${actionId}/undo`));
        commandKeys.delete(incidentId);
        return res;
      },
      'Simulated action rolled back and access restored.'
    );
  };

  // Change incident status
  const handleStatusChange = (incidentId: string, newStatus: string) => {
    return executeAction(
      incidentId,
      () => api(path(`/incidents/${incidentId}`), {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      }),
      `Incident marked as ${newStatus}.`
    );
  };

  return (
    <div className="phantom-threats">
      <header className="phantom-page-header">
        <div className="phantom-page-eyebrow">
          <ShieldAlert size={13} />
          <span>SECURITY INCIDENT MANAGEMENT & AUDITING</span>
        </div>
        <h1 className="phantom-page-title">Live Threat Monitor</h1>
        <p className="phantom-page-subtitle">
          Real-time threat feed and audit trail. Review detector confidence, reason codes,
          policy responses, and execute authorized containment actions.
        </p>
      </header>

      {successMessage && <div role="status" className="app-notice" style={{ marginBottom: '20px' }}>{successMessage}</div>}
      {errorMessage && <div role="alert" className="app-error" style={{ marginBottom: '20px' }}>{errorMessage}</div>}

      {/* Filter and Search Bar */}
      <section className="phantom-card" style={{ padding: '16px 24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
          {/* Search Input */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--surface-raised)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '6px 12px',
            flex: 1,
            minWidth: '240px'
          }}>
            <Search size={15} color="var(--muted)" />
            <input
              type="text"
              placeholder="Search by target, reason code, or explanation..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text)',
                fontSize: '12.5px',
                width: '100%',
                outline: 'none'
              }}
            />
          </div>

          {/* Status Tabs */}
          <div style={{ display: 'flex', borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden' }}>
            {(['all', 'open', 'acknowledged', 'resolved'] as const).map(st => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                style={{
                  padding: '6px 12px',
                  background: statusFilter === st ? 'var(--accent)' : 'var(--surface-raised)',
                  color: statusFilter === st ? 'var(--accent-ink)' : 'var(--muted)',
                  border: 'none',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  textTransform: 'capitalize',
                  cursor: 'pointer'
                }}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Incidents List */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {filteredIncidents.length === 0 ? (
          <div className="phantom-card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
            <CheckCircle2 size={42} color="var(--accent)" style={{ marginBottom: '14px' }} />
            <h3 style={{ margin: '0 0 6px', fontSize: '16px', color: 'var(--text)' }}>No Threats Matched</h3>
            <p style={{ margin: 0, fontSize: '13px' }}>
              {incidents.length === 0
                ? 'Household monitoring active. Zero anomalies detected in nominal traffic.'
                : 'No incidents match the active filter criteria.'}
            </p>
          </div>
        ) : (
          filteredIncidents.map((incident: any) => {
            const alert = incident.alert;
            const targetName = devices.find((d: any) => d.id === alert.node_id)?.name ||
                              accounts.find((a: any) => a.id === alert.node_id)?.name ||
                              alert.node_id;

            const isExpanded = expandedIncident === incident.id;
            const relatedActions = actions.filter((a: any) => a.incident_id === incident.id);
            const activeAction = relatedActions.find((a: any) => ['applied', 'verified', 'planned'].includes(a.state));
            const isResolved = incident.status === 'resolved';

            return (
              <article
                key={incident.id}
                className="phantom-card"
                style={{
                  marginBottom: 0,
                  borderColor: isResolved ? 'var(--border)' : 'var(--danger)',
                  opacity: isResolved ? 0.75 : 1
                }}
              >
                {/* Header Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span className={`phantom-badge ${isResolved ? 'phantom-badge--green' : 'phantom-badge--red'}`}>
                        {incident.status.toUpperCase()}
                      </span>
                      <span className="phantom-badge phantom-badge--amber">
                        {alert.confidence} Confidence
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={11} /> {new Date(incident.created_at).toLocaleString()}
                      </span>
                    </div>
                    <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 600 }}>{targetName}</h3>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text)', lineHeight: 1.5 }}>
                      {alert.explanation}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="phantom-btn-secondary"
                    onClick={() => setExpandedIncident(isExpanded ? null : incident.id)}
                    style={{ padding: '6px 12px', fontSize: '11.5px' }}
                  >
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {isExpanded ? 'Collapse' : 'Inspect Details'}
                  </button>
                </div>

                {/* Reason Codes */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '12px' }}>
                  {alert.reason_codes.map((code: string, i: number) => (
                    <span key={i} className="phantom-badge phantom-badge--gray" style={{ fontFamily: 'monospace' }}>
                      {code}
                    </span>
                  ))}
                </div>

                {/* Response Recommendation Box */}
                <div style={{
                  marginTop: '16px',
                  padding: '14px 16px',
                  borderRadius: '8px',
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div>
                    <span style={{ fontSize: '10.5px', color: 'var(--muted)', textTransform: 'uppercase' }}>
                      Determined Policy Response
                    </span>
                    <div style={{ fontSize: '12.5px', color: 'var(--text)', fontWeight: 600, marginTop: '2px' }}>
                      {alert.response?.explanation || 'Automatic containment recommended.'}
                    </div>
                  </div>

                  {/* Containment Confirmation Button */}
                  {!isResolved && !activeAction && alert.response?.requires_confirmation && ['CONTAIN', 'REVOKE'].includes(alert.response?.action) && (
                    <button
                      type="button"
                      className="phantom-btn-danger"
                      onClick={() => handleConfirmAction(incident)}
                      disabled={!canWrite || busyId !== null}
                    >
                      <Lock size={14} />
                      Confirm {alert.response.action === 'REVOKE' ? 'Account Revocation' : 'Simulated Containment'}
                    </button>
                  )}

                  {/* Active Action Notice */}
                  {activeAction && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="phantom-badge phantom-badge--green">
                        ACTIVE: {activeAction.action_type} ({activeAction.state})
                      </span>
                      {canWrite && (
                        <button
                          type="button"
                          className="phantom-btn-secondary"
                          onClick={() => handleUndoAction(activeAction.id, incident.id)}
                          disabled={busyId !== null}
                          style={{ padding: '4px 10px', fontSize: '11px' }}
                        >
                          <Undo2 size={12} /> Undo & Restore
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Status Toggles & Workflow */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {incident.status === 'open' && (
                      <button
                        type="button"
                        className="phantom-signout-btn"
                        onClick={() => handleStatusChange(incident.id, 'acknowledged')}
                        disabled={!canWrite || busyId !== null}
                      >
                        Acknowledge
                      </button>
                    )}
                    <button
                      type="button"
                      className="phantom-signout-btn"
                      onClick={() => handleStatusChange(incident.id, incident.status === 'resolved' ? 'open' : 'resolved')}
                      disabled={!canWrite || busyId !== null}
                    >
                      {incident.status === 'resolved' ? 'Reopen Incident' : 'Mark Resolved'}
                    </button>
                  </div>

                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                    Fingerprint: <code>{incident.fingerprint?.slice(0, 14)}...</code>
                  </span>
                </div>

                {/* Expanded Details Drawer */}
                {isExpanded && (
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)', fontSize: '12px' }}>
                    <h4 style={{ margin: '0 0 8px', fontSize: '13px' }}>Audit & Actions History</h4>
                    {relatedActions.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {relatedActions.map((act: any) => (
                          <div key={act.id} style={{ padding: '8px 12px', background: 'var(--surface-raised)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Action {act.action_type} · State: {act.state} ({act.execution_mode})</span>
                            <span style={{ color: 'var(--muted)' }}>{act.created_at}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ margin: 0, color: 'var(--muted)' }}>No historical containment actions executed for this incident.</p>
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
