import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { AlertTriangle, CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

interface Finding {
  id: string;
  device_id?: string;
  account_id?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  explanation: string;
  fix_type: string;
  fix_params: any;
}

export default function AccessHealth() {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAudit = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/audit`);
      setFindings(response.data);
    } catch (error) {
      console.error("Audit fetch failed", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudit();
  }, []);

  const handleFix = async (findingId: string) => {
    try {
      await axios.post(`${API_BASE}/audit/fix?finding_id=${findingId}`);
      await fetchAudit();
    } catch (error) {
      console.error("Fix failed", error);
    }
  };

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case 'critical': return 'text-critical-red bg-critical-red/10 border-critical-red/20';
      case 'high': return 'text-warn-amber bg-warn-amber/10 border-warn-amber/20';
      case 'medium': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue"></div>
        <p>Analyzing home health...</p>
      </div>
    );
  }

  if (findings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-12">
        <div className="p-4 rounded-full bg-safe-green/10 text-safe-green">
          <ShieldCheck size={48} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">All Systems Secure</h3>
          <p className="text-slate-400 text-sm">No immediate access health risks detected.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="text-warn-amber" size={20} />
          Security Findings
        </h3>
        <span className="px-2 py-1 rounded bg-slate-800 text-xs font-mono text-slate-400 border border-slate-700">
          {findings.length} Issues
        </span>
      </div>

      <div className="space-y-3">
        {findings.map(f => (
          <div
            key={f.id}
            className="p-4 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 transition-colors group"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${getSeverityColor(f.severity)}`}>
                    {f.severity}
                  </span>
                  <h4 className="text-sm font-bold text-slate-200">{f.title}</h4>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {f.explanation}
                </p>
              </div>
              <button
                onClick={() => handleFix(f.id)}
                className="shrink-0 p-2 rounded bg-accent-blue/10 text-accent-blue hover:bg-accent-blue hover:text-white transition-all"
                title="Apply Fix"
              >
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
