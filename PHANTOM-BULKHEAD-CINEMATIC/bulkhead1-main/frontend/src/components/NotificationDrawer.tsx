import React, { useState, useEffect } from 'react';
import { X, Bell, ShieldAlert, CheckCircle2, Clock, Mail, ExternalLink } from 'lucide-react';
import { useBulkhead } from '../lib/session';
import { api } from '../lib/api';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectIncident?: (incidentId: string) => void;
}

export default function NotificationDrawer({ isOpen, onClose, onSelectIncident }: NotificationDrawerProps) {
  const { state, path } = useBulkhead();
  const [emailJobs, setEmailJobs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'alerts' | 'emails'>('alerts');

  useEffect(() => {
    if (!isOpen) return;
    api(path('/integrations/notifications'))
      .then(res => setEmailJobs(Array.isArray(res) ? res : []))
      .catch(() => setEmailJobs([]));
  }, [isOpen, path]);

  if (!isOpen) return null;

  const incidents = state?.incidents || [];
  const openIncidents = incidents.filter((i: any) => i.status !== 'resolved');

  return (
    <div className="phantom-drawer-overlay" onClick={onClose}>
      <aside
        className="phantom-drawer"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label="Security notifications"
      >
        <div className="phantom-drawer__header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'var(--accent-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)'
            }}>
              <Bell size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Security Center</h3>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                {openIncidents.length} active alerts · {emailJobs.length} dispatched notices
              </span>
            </div>
          </div>
          <button
            type="button"
            className="phantom-icon-btn"
            onClick={onClose}
            aria-label="Close notification panel"
          >
            <X size={16} />
          </button>
        </div>

        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          padding: '0 20px',
          background: 'var(--surface-raised)'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('alerts')}
            style={{
              padding: '12px 14px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'alerts' ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === 'alerts' ? 'var(--text)' : 'var(--muted)',
              fontWeight: activeTab === 'alerts' ? 600 : 500,
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Active Incidents ({openIncidents.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('emails')}
            style={{
              padding: '12px 14px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'emails' ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === 'emails' ? 'var(--text)' : 'var(--muted)',
              fontWeight: activeTab === 'emails' ? 600 : 500,
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Email Outbox ({emailJobs.length})
          </button>
        </div>

        <div className="phantom-drawer__content">
          {activeTab === 'alerts' ? (
            incidents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
                <CheckCircle2 size={36} color="var(--accent)" style={{ marginBottom: '12px' }} />
                <h4 style={{ margin: '0 0 6px', color: 'var(--text)', fontSize: '14px' }}>All Clear</h4>
                <p style={{ margin: 0, fontSize: '12px' }}>No security alerts recorded for this household.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {incidents.slice(0, 15).map((incident: any) => {
                  const alert = incident.alert;
                  const isResolved = incident.status === 'resolved';
                  const targetName = state?.devices?.find((d: any) => d.id === alert.node_id)?.name ||
                                    state?.accounts?.find((a: any) => a.id === alert.node_id)?.name ||
                                    alert.node_id;

                  return (
                    <article
                      key={incident.id}
                      style={{
                        padding: '14px',
                        borderRadius: '10px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface-raised)',
                        opacity: isResolved ? 0.65 : 1
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span className={`phantom-badge ${isResolved ? 'phantom-badge--green' : 'phantom-badge--red'}`}>
                          {incident.status}
                        </span>
                        <span style={{ fontSize: '10.5px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={11} /> {new Date(incident.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <h4 style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: 600 }}>{targetName}</h4>
                      <p style={{ margin: '0 0 10px', fontSize: '11.5px', color: 'var(--muted)', lineHeight: 1.4 }}>
                        {alert.explanation}
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '10.5px', color: 'var(--muted)', fontFamily: 'monospace' }}>
                          {alert.confidence} confidence
                        </span>
                        <a
                          href="#/threat-monitor"
                          onClick={() => {
                            onClose();
                            if (onSelectIncident) onSelectIncident(incident.id);
                          }}
                          style={{
                            fontSize: '11px',
                            color: 'var(--accent)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontWeight: 600
                          }}
                        >
                          View details <ExternalLink size={11} />
                        </a>
                      </div>
                    </article>
                  );
                })}
              </div>
            )
          ) : (
            emailJobs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
                <Mail size={36} style={{ marginBottom: '12px', opacity: 0.5 }} />
                <h4 style={{ margin: '0 0 6px', color: 'var(--text)', fontSize: '14px' }}>No Pending Dispatches</h4>
                <p style={{ margin: 0, fontSize: '12px' }}>Verified email notifications are sent via Resend/SMTP.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {emailJobs.map((job: any) => (
                  <div
                    key={job.id}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface-raised)',
                      fontSize: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span className={`phantom-badge ${job.state === 'complete' ? 'phantom-badge--green' : job.state === 'failed' ? 'phantom-badge--red' : 'phantom-badge--amber'}`}>
                        {job.state}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        Attempts: {job.attempts}
                      </span>
                    </div>
                    <code style={{ fontSize: '10.5px', color: 'var(--muted)' }}>{job.id}</code>
                    {job.error && (
                      <p style={{ margin: '6px 0 0', fontSize: '11px', color: 'var(--danger)' }}>
                        Error: {job.error}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </aside>
    </div>
  );
}
