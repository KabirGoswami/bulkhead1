import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShieldAlert, ShieldCheck, AlertTriangle, CheckCircle2, Undo2, ShieldOff, Shield } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

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
    const ws = new WebSocket(`ws://${API_BASE}/ws`);
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
      // In a real system, this would be a specific /action endpoint
      // For the demo, we'll simulate a containment via the audit fix if applicable,
      // or a custom action endpoint. Let's assume we add a /action endpoint soon.
      await axios.post(`${API_BASE}/action/confirm`, { alert_id: alertId, node_id: nodeId, action: 'CONTAIN' });
      // Optimistically update UI or wait for state broadcast
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

  const getConfidenceColor = (conf: string) => {
    switch (conf) {
      case 'high': return 'text-critical-red bg-critical-red/10 border-critical-red/20';
      case 'medium': return 'text-warn-amber bg-warn-amber/10 border-warn-amber/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ShieldAlert className="text-critical-red" size={20} />
          Security Alerts
        </h3>
        <span className="px-2 py-1 rounded bg-slate-800 text-xs font-mono text-slate-400 border border-slate-700">
          {alerts.length} Events
        </span>
      </div>

      <div className="space-y-3">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500 text-center">
            <ShieldCheck size={48} className="mb-4 opacity-20" />
            <p>No threats detected.</p>
            <p className="text-xs opacity-50">Monitoring simulated traffic...</p>
          </div>
        ) : (
          alerts.map(alert => (
            <div key={alert.id} className="p-4 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 transition-colors group">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${getConfidenceColor(alert.confidence)}`}>
                      {alert.confidence} Confidence
                    </span>
                    <span className="text-xs font-mono text-slate-500">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-200 mb-1">{alert.node_id}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed mb-3">
                    {alert.explanation}
                  </p>

                  {alert.action_taken === 'CONTAINED' ? (
                    <div className="flex items-center gap-2 text-safe-green text-[10px] font-bold uppercase tracking-wider">
                      <Shield size={12} />
                      Auto-Contained
                    </div>
                  ) : alert.response ? (
                    <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-700">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-500 uppercase font-bold">Suggested Action</span>
                        <span className="text-xs text-slate-300">{alert.response.explanation}</span>
                      </div>
                      <button
                        onClick={() => handleConfirmAction(alert.id, alert.node_id)}
                        className="px-3 py-1 rounded bg-accent-blue text-white text-xs font-bold hover:bg-blue-600 transition-colors"
                      >
                        Confirm
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
