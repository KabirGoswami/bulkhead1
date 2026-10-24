import React, { useState } from 'react';
import {
  ShieldAlert, X, Activity
} from 'lucide-react';
import { useBulkhead } from '../lib/session';

interface InvestigationModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId?: string | null;
  incident?: any | null;
}

export default function InvestigationModal({
  isOpen,
  onClose,
  targetId,
  incident
}: InvestigationModalProps) {
  const { state } = useBulkhead();
  const [activeTab, setActiveTab] = useState<'correlation' | 'evidence' | 'policy' | 'telemetry'>('correlation');

  if (!isOpen) return null;

  // Derive target data from state incidents or simulated target
  const allIncidents = state?.incidents || [];
  const selectedIncident = incident || allIncidents.find((i: any) => i.id === targetId) || allIncidents[0] || {
    id: 'inc_investigation_01',
    created_at: new Date().toISOString(),
    status: 'open',
    severity: 'critical',
    title: 'Unauthorized Lateral Ingress & Cloud Actuator Contradiction',
    summary: 'A virtual unlock command was requested while multi-sensor correlation detected contradictory physical contact and missing occupant presence.',
    alert: {
      source: 'Living Room Smart Plug (plug_1)',
      fingerprint: 'sha256:88fa2900bc192',
      reason_codes: ['ANOMALOUS_LATERAL_FLOW', 'SPOOFED_INGRESS_NONCE', 'MISSING_PIR_CORROBORATION'],
      response: {
        action: 'HOLD_AND_REVOKE',
        requires_confirmation: true,
        quarantine_node: 'node_plug_1'
      }
    }
  };

  const devices = state?.devices || [];
  const involvedDevice = devices.find((d: any) => d.id === selectedIncident?.alert?.quarantine_node) || devices[0];

  return (
    <div className="investigation-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="investigation-modal-container" onClick={e => e.stopPropagation()}>
        {/* Modal Top Header */}
        <div className="investigation-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="investigation-badge-icon">
              <ShieldAlert size={20} color="var(--danger)" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="phantom-badge phantom-badge--red">INVESTIGATION MODE</span>
                <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                  ID: {selectedIncident.id}
                </span>
                <span className="phantom-badge phantom-badge--amber">
                  SEVERITY: {selectedIncident.severity || 'HIGH'}
                </span>
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 650, margin: '4px 0 0', letterSpacing: '-0.4px', color: 'var(--text)' }}>
                {selectedIncident.title || 'Security Anomaly Deep Forensic Trace'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            className="phantom-icon-btn"
            onClick={onClose}
            aria-label="Close investigation mode"
            style={{
              background: 'var(--surface-hover)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--muted)',
              cursor: 'pointer',
              padding: '6px'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="investigation-tabs">
          <button
            type="button"
            className={`inv-tab-btn ${activeTab === 'correlation' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('correlation')}
          >
            Multi-Sensor Correlation
          </button>
          <button
            type="button"
            className={`inv-tab-btn ${activeTab === 'evidence' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('evidence')}
          >
            Sensor Evidence Matrix
          </button>
          <button
            type="button"
            className={`inv-tab-btn ${activeTab === 'policy' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('policy')}
          >
            Policy Decision Boundary
          </button>
          <button
            type="button"
            className={`inv-tab-btn ${activeTab === 'telemetry' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('telemetry')}
          >
            Raw Ingress Telemetry
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="investigation-body">
          {activeTab === 'correlation' && (
            <div className="inv-grid-2">
              {/* Left Column: Visual Focal Graph */}
              <div className="phantom-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="phantom-card-header">
                  <h3 className="phantom-card-title" style={{ color: 'var(--text)' }}>
                    <Activity size={16} color="var(--accent)" /> Real-Time Cross-Sensor Graph
                  </h3>
                  <span className="phantom-badge phantom-badge--green">Correlated</span>
                </div>

                <div className="inv-graph-stage">
                  {/* Visual Node Graph */}
                  <div className="inv-node inv-node--source">
                    <span className="inv-node-label">SOURCE INGRESS</span>
                    <strong>{selectedIncident.alert?.source || 'Device Telemetry'}</strong>
                    <span className="inv-node-sub">Port 8080 · Inbound Packet</span>
                  </div>

                  <div className="inv-connector-line is-danger">
                    <span>ANOMALOUS FLOW</span>
                  </div>

                  <div className="inv-node inv-node--gate">
                    <span className="inv-node-label">POLICY GATE</span>
                    <strong>PHANTOM Engine</strong>
                    <span className="inv-node-sub">Contextual Cross-Check</span>
                  </div>

                  <div className="inv-connector-line is-warning">
                    <span>HELD / ISOLATED</span>
                  </div>

                  <div className="inv-node inv-node--target">
                    <span className="inv-node-label">VIRTUAL ACTUATOR</span>
                    <strong>Target Physical Lock</strong>
                    <span className="inv-node-sub" style={{ color: 'var(--verified)' }}>
                      HELD SECURE (NO BREACH)
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: '20px', padding: '14px', background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.8px' }}>
                    Contextual Incident Summary
                  </div>
                  <p style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.5, color: 'var(--text)' }}>
                    {selectedIncident.summary || 'Telemetry from device contradicted physical sensor realities. Action was held at the policy boundary.'}
                  </p>
                </div>
              </div>

              {/* Right Column: Reason Codes & Blast Radius */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="phantom-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--muted)' }}>
                    Detector Reason Codes
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(selectedIncident.alert?.reason_codes || ['ANOMALOUS_LATERAL_FLOW', 'SPOOFED_INGRESS_NONCE']).map((code: string) => (
                      <div key={code} style={{ padding: '8px 12px', background: 'var(--surface-raised)', borderLeft: '3px solid var(--accent)', borderRadius: '4px', fontSize: '11.5px', fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>
                        <strong>{code}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="phantom-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--muted)' }}>
                    Containment & Blast Radius
                  </h4>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.6 }}>
                    <p style={{ margin: '0 0 8px' }}>
                      Affected Node: <strong style={{ color: 'var(--text)' }}>{involvedDevice?.name || 'Smart Plug'}</strong> ({involvedDevice?.ip || '192.168.1.10'})
                    </p>
                    <p style={{ margin: '0 0 8px' }}>
                      Quarantine Status: <span className="phantom-badge phantom-badge--green">ISOLATED VIA POLICY</span>
                    </p>
                    <p style={{ margin: 0 }}>
                      Lateral Reach: <strong style={{ color: 'var(--text)' }}>Contained at boundary</strong>. Router management ports shielded.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'evidence' && (
            <div className="phantom-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <h3 className="phantom-card-title" style={{ marginBottom: '16px', color: 'var(--text)' }}>
                Multi-Sensor Physical Evidence Corroboration
              </h3>
              <div className="evidence-matrix">
                <div className="evidence-sensor-pill" style={{ borderLeft: '3px solid var(--danger)', background: 'var(--surface-raised)', borderRadius: '8px' }}>
                  <div className="evidence-sensor-pill__top">
                    <span className="evidence-sensor-name" style={{ color: 'var(--text)' }}>Front Door Contact</span>
                    <span className="phantom-badge phantom-badge--red">Conflicting</span>
                  </div>
                  <span className="evidence-sensor-reading" style={{ color: 'var(--muted)' }}>Claimed: OPEN via Inbound Packet</span>
                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--muted)' }}>
                    Message received with valid credentials, but missing physical corroboration.
                  </p>
                </div>

                <div className="evidence-sensor-pill" style={{ borderLeft: '3px solid var(--warning)', background: 'var(--surface-raised)', borderRadius: '8px' }}>
                  <div className="evidence-sensor-pill__top">
                    <span className="evidence-sensor-name" style={{ color: 'var(--text)' }}>Hallway PIR Motion</span>
                    <span className="phantom-badge phantom-badge--amber">Contradiction</span>
                  </div>
                  <span className="evidence-sensor-reading" style={{ color: 'var(--muted)' }}>Observed: NO MOTION (0.00 lux)</span>
                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--muted)' }}>
                    Physical motion sensor registered zero movement within expected 15-second arrival window.
                  </p>
                </div>

                <div className="evidence-sensor-pill" style={{ borderLeft: '3px solid var(--verified)', background: 'var(--surface-raised)', borderRadius: '8px' }}>
                  <div className="evidence-sensor-pill__top">
                    <span className="evidence-sensor-name" style={{ color: 'var(--text)' }}>Deadbolt Physical Lock</span>
                    <span className="phantom-badge phantom-badge--green">Holding State</span>
                  </div>
                  <span className="evidence-sensor-reading" style={{ color: 'var(--muted)' }}>State: Physically Engaged</span>
                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--muted)' }}>
                    Mechanical latch remains safely locked. Virtual command was held prior to actuation.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'policy' && (
            <div className="phantom-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <h3 className="phantom-card-title" style={{ marginBottom: '12px', color: 'var(--text)' }}>
                Autonomous Policy Enforcement & Approval Trace
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '12.5px' }}>
                <div style={{ padding: '12px', background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  <strong style={{ color: 'var(--text)' }}>Policy Rule Triggered:</strong> <code style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>RULE_SUSPICIOUS_INGRESS_HOLD_ACTUATOR</code>
                  <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '11.5px' }}>
                    When credential geo-anomalies or conflicting sensor states occur, motorized locks are held and the associated vendor link is queued for revocation.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ padding: '12px', background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                    <span style={{ fontSize: '10.5px', color: 'var(--muted)' }}>SERVER RESPONSE</span>
                    <div style={{ fontSize: '14px', fontWeight: 650, color: 'var(--warning)', marginTop: '4px' }}>
                      REQUIRES OWNER APPROVAL
                    </div>
                  </div>
                  <div style={{ padding: '12px', background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                    <span style={{ fontSize: '10.5px', color: 'var(--muted)' }}>ACTUATOR STATE</span>
                    <div style={{ fontSize: '14px', fontWeight: 650, color: 'var(--verified)', marginTop: '4px' }}>
                      UNCHANGED (SECURED)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'telemetry' && (
            <div className="phantom-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <h3 className="phantom-card-title" style={{ marginBottom: '12px', color: 'var(--text)' }}>
                Raw Ingress Packet Forensic Dump
              </h3>
              <pre style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '16px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text)',
                overflowX: 'auto',
                lineHeight: 1.6
              }}>
{JSON.stringify({
  incident_id: selectedIncident.id,
  timestamp: selectedIncident.created_at,
  source_device: selectedIncident.alert?.source,
  fingerprint: selectedIncident.alert?.fingerprint,
  reason_codes: selectedIncident.alert?.reason_codes,
  policy_decision: selectedIncident.alert?.response?.action || 'HOLD',
  requires_confirmation: selectedIncident.alert?.response?.requires_confirmation,
  quarantine_enforced: true,
  virtual_actuator_blocked: true
}, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="investigation-footer" style={{ borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px' }}>
          <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
            FORENSIC AUDIT RECORD · CRYPTOGRAPHIC NONCE VALIDATED
          </span>
          <button
            type="button"
            className="app-button"
            onClick={onClose}
            style={{
              background: 'var(--accent)',
              color: 'var(--accent-ink)',
              border: 'none',
              borderRadius: '7px',
              fontWeight: 600,
              padding: '8px 18px',
              cursor: 'pointer'
            }}
          >
            Close Investigation View
          </button>
        </div>
      </div>
    </div>
  );
}
