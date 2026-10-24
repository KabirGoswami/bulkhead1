import React, { useState, useEffect } from 'react';
import {
  SlidersHorizontal, Shield, Mail, Users, UserPlus, Trash2,
  CheckCircle2, Clock, ShieldCheck, History, ExternalLink, Lock
} from 'lucide-react';
import { useBulkhead, useSession } from '../lib/session';
import { api, post, errorText } from '../lib/api';

export default function PrivacySettingsPage() {
  const { path, canWrite, refresh: refreshState } = useBulkhead();
  const session = useSession();

  // Settings State
  const [homeDetails, setHomeDetails] = useState<any | null>(null);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Invitation Form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'Admin' | 'Viewer'>('Viewer');
  const [isGuest, setIsGuest] = useState(false);
  const [guestHours, setGuestHours] = useState(24);
  const [inviteResult, setInviteResult] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  const isOwner = session.home?.role === 'Owner';

  // Load household and audit data
  useEffect(() => {
    setLoading(true);
    Promise.all([
      api(path('')),
      api(path('/audit-events'))
    ]).then(([details, audits]) => {
      setHomeDetails(details);
      setEmailNotifications(details.preferences?.email_notifications ?? true);
      setAuditEvents(Array.isArray(audits) ? audits : []);
    }).catch(err => {
      setErrorMsg(errorText(err));
    }).finally(() => {
      setLoading(false);
    });
  }, [path]);

  // Update notification preferences
  const handleToggleNotifications = async () => {
    const nextVal = !emailNotifications;
    setEmailNotifications(nextVal);
    setStatusMsg('');
    setErrorMsg('');
    try {
      await api(path('/preferences'), {
        method: 'PATCH',
        body: JSON.stringify({ email_notifications: nextVal })
      });
      setStatusMsg(`Email security notifications ${nextVal ? 'enabled' : 'disabled'}.`);
      await refreshState();
    } catch (err) {
      setEmailNotifications(!nextVal);
      setErrorMsg(errorText(err));
    }
  };

  // Send invitation
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviteLoading(true);
    setInviteResult(null);
    setErrorMsg('');
    setStatusMsg('');

    try {
      const res = await post(path('/invitations'), {
        email: inviteEmail,
        role: inviteRole,
        guest: isGuest,
        guest_hours: Number(guestHours)
      });
      setInviteResult(res.invite_url);
      setInviteEmail('');
      setStatusMsg(`Invitation created for ${inviteRole} access.`);
    } catch (err) {
      setErrorMsg(errorText(err));
    } finally {
      setInviteLoading(false);
    }
  };

  // Remove member
  const handleRemoveMember = async (membershipId: string) => {
    if (!confirm('Are you sure you want to revoke this membership?')) return;
    setStatusMsg('');
    setErrorMsg('');
    try {
      await api(path(`/members/${membershipId}`), { method: 'DELETE' });
      setStatusMsg('Membership revoked.');
      const updated = await api(path(''));
      setHomeDetails(updated);
    } catch (err) {
      setErrorMsg(errorText(err));
    }
  };

  return (
    <div className="phantom-settings">
      <header className="phantom-page-header">
        <div className="phantom-page-eyebrow">
          <SlidersHorizontal size={13} />
          <span>HOUSEHOLD GOVERNANCE & PRIVACY</span>
        </div>
        <h1 className="phantom-page-title">Privacy & Household Settings</h1>
        <p className="phantom-page-subtitle">
          Manage member permissions, notification policies, data retention boundaries,
          and inspect immutable audit logs.
        </p>
      </header>

      {statusMsg && <div role="status" className="app-notice" style={{ marginBottom: '20px' }}>{statusMsg}</div>}
      {errorMsg && <div role="alert" className="app-error" style={{ marginBottom: '20px' }}>{errorMsg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
        {/* Left Column: Privacy & Notifications + Member Governance */}
        <div>
          {/* Privacy & Notifications */}
          <section className="phantom-card">
            <div className="phantom-card-header">
              <div>
                <h2 className="phantom-card-title">
                  <ShieldCheck size={18} color="var(--accent)" /> Privacy & Notification Policies
                </h2>
                <span className="phantom-card-subtitle">
                  Configure incident alerts and verify telemetry privacy controls
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderRadius: '8px',
                background: 'var(--surface-raised)',
                border: '1px solid var(--border)'
              }}>
                <div>
                  <strong style={{ fontSize: '13px', display: 'block', marginBottom: '3px' }}>
                    Incident Email Dispatches
                  </strong>
                  <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                    Send verified alerts to registered household members via Resend/SMTP
                  </span>
                </div>
                <button
                  type="button"
                  className={emailNotifications ? 'phantom-btn-primary' : 'phantom-btn-secondary'}
                  onClick={handleToggleNotifications}
                  disabled={!canWrite}
                  style={{ padding: '6px 14px', fontSize: '11.5px' }}
                >
                  {emailNotifications ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              {/* Data Minimization Disclosure */}
              <div style={{
                padding: '14px 16px',
                borderRadius: '8px',
                background: 'var(--surface-raised)',
                border: '1px solid var(--border)',
                fontSize: '11.5px',
                color: 'var(--muted)',
                lineHeight: 1.5
              }}>
                <strong style={{ color: 'var(--text)', display: 'block', marginBottom: '4px' }}>
                  Privacy & Data Minimization:
                </strong>
                PHANTOM and Bulkhead only record non-sensitive metadata (timestamps, sequence numbers, reason codes). No raw video feeds, voice recordings, or unencrypted device keys are ever ingested or persisted.
              </div>
            </div>
          </section>

          {/* Household Members */}
          <section className="phantom-card">
            <div className="phantom-card-header">
              <div>
                <h2 className="phantom-card-title">
                  <Users size={18} color="var(--accent)" /> Household Membership
                </h2>
                <span className="phantom-card-subtitle">
                  Authorized residents and their access roles
                </span>
              </div>
              <span className="phantom-badge phantom-badge--green">
                Your Role: {session.home?.role}
              </span>
            </div>

            <div className="phantom-table-wrap">
              <table className="phantom-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Access Expiry</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {homeDetails?.members?.map((m: any) => (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 600 }}>{m.email}</td>
                      <td>
                        <span className={`phantom-badge ${m.role === 'Owner' ? 'phantom-badge--green' : m.role === 'Admin' ? 'phantom-badge--amber' : 'phantom-badge--gray'}`}>
                          {m.role}
                        </span>
                      </td>
                      <td style={{ color: 'var(--muted)', fontSize: '11.5px' }}>
                        {m.expires_at ? new Date(m.expires_at * 1000).toLocaleDateString() : 'Permanent'}
                      </td>
                      <td>
                        {isOwner && m.role !== 'Owner' && (
                          <button
                            type="button"
                            className="phantom-signout-btn"
                            onClick={() => handleRemoveMember(m.id)}
                            style={{ color: 'var(--danger)' }}
                          >
                            <Trash2 size={13} /> Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Right Column: Member Invitation + Audit Trail */}
        <div>
          {/* Member Invitation */}
          <section className="phantom-card">
            <div className="phantom-card-header">
              <div>
                <h2 className="phantom-card-title">
                  <UserPlus size={18} color="var(--accent)" /> Invite Household Member
                </h2>
                <span className="phantom-card-subtitle">
                  Issue secure scoped invitation link
                </span>
              </div>
            </div>

            <form onSubmit={handleSendInvite} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '5px' }}>
                  Recipient Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="family@household.local"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface-raised)',
                    color: 'var(--text)',
                    fontSize: '12.5px'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '5px' }}>
                    Access Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface-raised)',
                      color: 'var(--text)',
                      fontSize: '12px'
                    }}
                  >
                    <option value="Viewer">Viewer (Read-only)</option>
                    {isOwner && <option value="Admin">Admin (Controls allowed)</option>}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '5px' }}>
                    Guest Duration
                  </label>
                  <select
                    value={isGuest ? guestHours : 0}
                    onChange={e => {
                      const val = Number(e.target.value);
                      setIsGuest(val > 0);
                      if (val > 0) setGuestHours(val);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface-raised)',
                      color: 'var(--text)',
                      fontSize: '12px'
                    }}
                  >
                    <option value={0}>Permanent Member</option>
                    <option value={24}>24 Hours Guest</option>
                    <option value={72}>3 Days Guest</option>
                    <option value={168}>7 Days Guest</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="phantom-btn-primary"
                disabled={inviteLoading || !canWrite}
                style={{ justifyContent: 'center' }}
              >
                <Mail size={14} />
                {inviteLoading ? 'Generating Invitation...' : 'Send Household Invitation'}
              </button>

              {inviteResult && (
                <div style={{
                  padding: '12px',
                  borderRadius: '6px',
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--accent)',
                  fontSize: '11px'
                }}>
                  <strong style={{ color: 'var(--accent)', display: 'block', marginBottom: '4px' }}>
                    Invitation URL (Valid for 7 days):
                  </strong>
                  <code style={{ wordBreak: 'break-all', color: 'var(--text)' }}>{inviteResult}</code>
                </div>
              )}
            </form>
          </section>

          {/* Audit Event Trail */}
          <section className="phantom-card">
            <div className="phantom-card-header">
              <div>
                <h2 className="phantom-card-title">
                  <History size={18} color="var(--accent)" /> Immutable Audit Trail
                </h2>
                <span className="phantom-card-subtitle">
                  {auditEvents.length} recorded administrative events
                </span>
              </div>
            </div>

            <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {auditEvents.slice(0, 15).map((ev: any) => (
                <div
                  key={ev.id}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'var(--surface-raised)',
                    border: '1px solid var(--border)',
                    fontSize: '11px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <strong style={{ color: 'var(--text)', fontFamily: 'monospace' }}>{ev.kind}</strong>
                    <div style={{ color: 'var(--muted)', fontSize: '10px' }}>
                      actor: {ev.actor_id ? ev.actor_id.slice(0, 8) : 'system'}
                    </div>
                  </div>
                  <span style={{ color: 'var(--muted)', fontSize: '10px' }}>
                    {new Date(ev.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
