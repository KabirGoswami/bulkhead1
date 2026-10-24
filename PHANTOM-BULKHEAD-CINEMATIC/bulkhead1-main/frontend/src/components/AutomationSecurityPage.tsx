import React, { useState } from 'react';
import {
  KeyRound, Shield, CheckCircle2, Clock, AlertTriangle,
  Lock, Unlock, Undo2, XCircle, UserCheck, ShieldAlert
} from 'lucide-react';
import { useBulkhead, useSession } from '../lib/session';
import { post, errorText } from '../lib/api';

export default function AutomationSecurityPage() {
  const { state, path, canWrite, refresh } = useBulkhead();
  const session = useSession();
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [commandKeys] = useState(() => new Map<string, string>());

  const actions = state?.actions || [];
  const incidents = state?.incidents || [];
  const devices = state?.devices || [];
  const accounts = state?.accounts || [];

  // Incidents that currently require Owner/Admin confirmation (Pending Approval Challenges)
  const pendingApprovals = incidents.filter((i: any) =>
    i.status !== 'resolved' &&
    i.alert?.response?.requires_confirmation &&
    ['CONTAIN', 'REVOKE'].includes(i.alert?.response?.action) &&
    !actions.some((a: any) => a.incident_id === i.id && ['applied', 'verified', 'planned'].includes(a.state))
  );

  const isOwnerOrAdmin = session.home?.role === 'Owner' || session.home?.role === 'Admin';

  // Execute approval (POST /actions)
  const handleApprove = async (incident: any) => {
    if (!commandKeys.has(incident.id)) {
      commandKeys.set(incident.id, crypto.randomUUID());
    }
    const cmdId = commandKeys.get(incident.id)!;
    const actionType = incident.alert?.response?.action;

    setBusyActionId(incident.id);
    setErrorMessage('');
    setStatusMessage('');

    try {
      await post(path('/actions'), {
        incident_id: incident.id,
        action: actionType,
        policy_revision: state.policy_revision,
        command_id: cmdId
      });
      setStatusMessage(`Approved and verified action ${actionType} for ${incident.id}.`);
      await refresh();
    } catch (err) {
      setErrorMessage(errorText(err));
    } finally {
      setBusyActionId(null);
    }
  };

  // Reject / Dismiss challenge
  const handleReject = async (incident: any) => {
    setBusyActionId(incident.id);
    setErrorMessage('');
    setStatusMessage('');

    try {
      // Marking incident acknowledged or resolved rejects the proposed action
      await post(path(`/incidents/${incident.id}`), { status: 'acknowledged' });
      setStatusMessage('Approval challenge declined; incident marked acknowledged.');
      await refresh();
    } catch (err) {
      setErrorMessage(errorText(err));
    } finally {
      setBusyActionId(null);
    }
  };

  // Undo action
  const handleUndo = async (actionId: string, incidentId: string) => {
    setBusyActionId(actionId);
    setErrorMessage('');
    setStatusMessage('');

    try {
      await post(path(`/actions/${actionId}/undo`));
      commandKeys.delete(incidentId);
      setStatusMessage('Action undone; virtual access restored.');
      await refresh();
    } catch (err) {
      setErrorMessage(errorText(err));
    } finally {
      setBusyActionId(null);
    }
  };

  return (
    <div className="phantom-automation">
      <header className="phantom-page-header">
        <div className="phantom-page-eyebrow">
          <KeyRound size={13} />
          <span>SENSITIVE AUTOMATION POLICIES & APPROVAL WORKFLOWS</span>
        </div>
        <h1 className="phantom-page-title">Automation Security & Approvals</h1>
        <p className="phantom-page-subtitle">
          High-impact smart home automations must not execute without verified corroboration.
          Review pending approval challenges and inspect the causal decision history.
        </p>
      </header>

      {statusMessage && <div role="status" className="app-notice" style={{ marginBottom: '20px' }}>{statusMessage}</div>}
      {errorMessage && <div role="alert" className="app-error" style={{ marginBottom: '20px' }}>{errorMessage}</div>}

      {/* Role Notice */}
      {!isOwnerOrAdmin && (
        <div style={{
          padding: '12px 18px',
          borderRadius: '8px',
          background: 'var(--surface-raised)',
          border: '1px solid var(--border)',
          marginBottom: '24px',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertTriangle size={16} color="var(--warning)" />
          <span>
            You are logged in with <strong>{session.home?.role || 'Viewer'}</strong> access.
            Viewers have read-only visibility. Approvals require an Owner or Admin session.
          </span>
        </div>
      )}

      {/* Section 1: Pending Approval Cards */}
      <section className="phantom-card">
        <div className="phantom-card-header">
          <div>
            <h2 className="phantom-card-title">
              <Clock size={18} color={pendingApprovals.length ? 'var(--warning)' : 'var(--accent)'} />
              Pending Approval Challenges ({pendingApprovals.length})
            </h2>
            <span className="phantom-card-subtitle">
              Automated policy decisions held pending explicit resident authorization
            </span>
          </div>
          <span className={`phantom-badge ${pendingApprovals.length ? 'phantom-badge--amber' : 'phantom-badge--green'}`}>
            {pendingApprovals.length ? 'Attention Required' : 'All Automations Nominal'}
          </span>
        </div>

        {pendingApprovals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
            <CheckCircle2 size={36} color="var(--accent)" style={{ marginBottom: '10px' }} />
            <h4 style={{ margin: '0 0 4px', fontSize: '14px', color: 'var(--text)' }}>No Pending Challenges</h4>
            <p style={{ margin: 0, fontSize: '12px' }}>
              No sensitive commands or containment actions are currently awaiting approval.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {pendingApprovals.map((incident: any) => {
              const alert = incident.alert;
              const targetName = devices.find((d: any) => d.id === alert.node_id)?.name ||
                                accounts.find((a: any) => a.id === alert.node_id)?.name ||
                                alert.node_id;

              return (
                <div
                  key={incident.id}
                  style={{
                    padding: '18px 20px',
                    borderRadius: '10px',
                    border: '1px solid var(--warning)',
                    background: 'color-mix(in srgb, var(--warning) 6%, var(--surface))',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <span className="phantom-badge phantom-badge--amber" style={{ marginBottom: '6px' }}>
                        HELD FOR CONFIRMATION
                      </span>
                      <h3 style={{ margin: '4px 0 2px', fontSize: '15px', fontWeight: 700 }}>
                        {alert.response?.action === 'REVOKE' ? 'Revoke Account Access' : 'Network Containment'}: {targetName}
                      </h3>
                      <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text)' }}>
                        {alert.explanation}
                      </p>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'monospace' }}>
                      Revision: {state.policy_revision}
                    </span>
                  </div>

                  <div style={{
                    padding: '10px 14px',
                    borderRadius: '6px',
                    background: 'var(--surface-raised)',
                    fontSize: '11.5px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}>
                    <span><strong>Reason:</strong> {alert.response?.explanation}</span>
                    <span style={{ color: 'var(--muted)' }}>Approver: Owner / Admin required</span>
                  </div>

                  {/* Approval Actions */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
                    <button
                      type="button"
                      className="phantom-btn-secondary"
                      onClick={() => handleReject(incident)}
                      disabled={!isOwnerOrAdmin || busyActionId !== null}
                    >
                      <XCircle size={14} />
                      Decline & Acknowledge
                    </button>
                    <button
                      type="button"
                      className="phantom-btn-primary"
                      onClick={() => handleApprove(incident)}
                      disabled={!isOwnerOrAdmin || busyActionId !== null}
                    >
                      <CheckCircle2 size={14} />
                      {busyActionId === incident.id ? 'Authorizing...' : 'Authorize Action'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Section 2: Decision & Execution History */}
      <section className="phantom-card">
        <div className="phantom-card-header">
          <div>
            <h2 className="phantom-card-title">
              <Shield size={18} color="var(--accent)" /> Decision & Execution History
            </h2>
            <span className="phantom-card-subtitle">
              Audit log of server-mediated actions and virtual actuator modifications
            </span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
            {actions.length} Historical Records
          </span>
        </div>

        {actions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--muted)', fontSize: '12px' }}>
            <p style={{ margin: 0 }}>No automated or manual actions recorded in this household.</p>
          </div>
        ) : (
          <div className="phantom-table-wrap">
            <table className="phantom-table">
              <thead>
                <tr>
                  <th>Action Type</th>
                  <th>Target Node</th>
                  <th>State</th>
                  <th>Mode</th>
                  <th>Command ID</th>
                  <th>Time</th>
                  <th>Controls</th>
                </tr>
              </thead>
              <tbody>
                {actions.map((act: any) => {
                  const targetName = devices.find((d: any) => d.id === act.node_id)?.name ||
                                    accounts.find((a: any) => a.id === act.node_id)?.name ||
                                    act.node_id;

                  const canUndo = ['applied', 'verified'].includes(act.state) && act.execution_mode === 'simulation';

                  return (
                    <tr key={act.id}>
                      <td>
                        <strong style={{ fontSize: '12px' }}>{act.action_type}</strong>
                      </td>
                      <td>{targetName}</td>
                      <td>
                        <span className={`phantom-badge ${
                          act.state === 'verified' || act.state === 'applied' ? 'phantom-badge--green' :
                          act.state === 'rolled_back' ? 'phantom-badge--gray' : 'phantom-badge--amber'
                        }`}>
                          {act.state}
                        </span>
                      </td>
                      <td style={{ color: 'var(--muted)', fontSize: '11.5px' }}>{act.execution_mode}</td>
                      <td>
                        <code style={{ fontSize: '10.5px', color: 'var(--muted)' }}>
                          {act.id?.slice(0, 16)}...
                        </code>
                      </td>
                      <td style={{ color: 'var(--muted)', fontSize: '11px' }}>
                        {act.created_at}
                      </td>
                      <td>
                        {canUndo && canWrite && (
                          <button
                            type="button"
                            className="phantom-btn-secondary"
                            onClick={() => handleUndo(act.id, act.incident_id)}
                            disabled={busyActionId !== null}
                            style={{ padding: '3px 8px', fontSize: '10.5px' }}
                          >
                            <Undo2 size={11} /> Rollback
                          </button>
                        )}
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
  );
}
