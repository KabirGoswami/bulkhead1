import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowUpRight, ShieldCheck, Shield, Radio } from 'lucide-react';
import '../styles/inspector.css';

const API_BASE = 'http://localhost:8000';
const WS_BASE = 'ws://localhost:8000';

interface Alert {
  id: string;
  node_id: string;
  confidence: 'low' | 'medium' | 'high';
  reason_codes: string[];
  explanation: string;
  timestamp: string;
  action_taken?: string;
  response?: {
    level: number;
    action: string;
    requires_confirmation: boolean;
    can_auto_act: boolean;
    explanation: string;
  };
}

export default function AlertFeed() {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE}/ws`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'SIM_TICK' && data.payload.alerts) {
        setAlerts(prev => [...data.payload.alerts, ...prev].slice(0, 50));
      }
    };
    return () => ws.close();
  }, []);

  const handleConfirmAction = async (alertId: string, nodeId: string) => {
    try {
      await axios.post(`${API_BASE}/action/confirm`, { alert_id: alertId, node_id: nodeId, action: 'CONTAIN' });
    } catch (e) {
      console.error("Action failed", e);
    }
  };

  const handleUndo = async (actionId: string) => {
    try {
      await axios.post(`${API_BASE}/action/undo`, { action_id: actionId });
    } catch (e) {
      console.error("Undo failed", e);
    }
  };

  return (
    <div className="inspector-content">
      <div className="inspector-heading">
        <div>
          <span className="inspector-eyebrow">Stay a step ahead</span>
          <h3>Security Alerts</h3>
        </div>
        <span className="inspector-count">{alerts.length}<span className="inspector-sr-only"> Events</span></span>
      </div>
      <p className="inspector-description">Detection and response, as they happen.</p>

      {alerts.length === 0 ? (
        <div className="inspector-empty inspector-empty--inset">
          <span className="inspector-empty-icon"><ShieldCheck size={30} strokeWidth={1.5} /></span>
          <h4>No threats detected.</h4>
          <p>Monitoring simulated traffic...</p>
          <span className="inspector-stream-label"><Radio size={12} aria-hidden="true" /> Simulation event stream</span>
        </div>
      ) : (
        <div className="inspector-card-list">
          {alerts.map(alert => (
            <article key={alert.id} className="alert-card">
              <div className="inspector-card-meta">
                <span className={`inspector-badge inspector-badge--${alert.confidence === 'high' ? 'critical' : alert.confidence === 'medium' ? 'high' : 'low'}`}>
                  <span className="inspector-badge-dot" />{alert.confidence} Confidence
                </span>
                <time dateTime={alert.timestamp}>{new Date(alert.timestamp).toLocaleTimeString()}</time>
              </div>
              <h4>{alert.node_id}</h4>
              <p>{alert.explanation}</p>

              {alert.action_taken === 'CONTAINED' ? (
                <div className="alert-contained"><Shield size={14} aria-hidden="true" /><span>Auto-Contained</span></div>
              ) : alert.response ? (
                <div className="alert-response">
                  <span className="inspector-eyebrow">Suggested Action</span>
                  <p>{alert.response.explanation}</p>
                  <button onClick={() => handleConfirmAction(alert.id, alert.node_id)} className="alert-confirm-button">
                    Confirm<ArrowUpRight size={15} aria-hidden="true" />
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
