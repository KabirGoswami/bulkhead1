import React, { useState, useEffect } from 'react';
import { api, post, errorText } from '../lib/api';
import { useBulkhead } from '../lib/session';
import { ArrowUpRight, LoaderCircle, ShieldCheck, ShieldAlert } from 'lucide-react';
import '../styles/inspector.css';



interface Finding {
  id: string;
  device_id?: string;
  account_id?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  explanation: string;
  fix_type: string;
  executable: boolean;
  fix_params: any;
}

export default function AccessHealth() {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const { path, state, canWrite, refresh } = useBulkhead();

  const fetchAudit = async () => {
    setLoading(true); setError('');
    try {
      const response = await api(path('/audit'));
      setFindings(response);
    } catch (error) {
      setError(errorText(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudit();
  }, [path, state?.policy_revision]);

  const handleFix = async (findingId: string) => {
    setBusy(findingId);
    try {
      await post(path('/audit/fix'), { finding_id: findingId });
      await refresh();
      await fetchAudit();
    } catch (error) {
      setError(errorText(error));
    } finally { setBusy(null); }
  };

  if (error) return <div role="alert" className="app-error">Audit unavailable: {error} <button className="app-link" onClick={fetchAudit}>Retry</button></div>;

  if (loading) {
    return (
      <div className="inspector-empty" role="status">
        <span className="inspector-empty-icon"><LoaderCircle size={28} className="inspector-spinner" /></span>
        <h3>Reading the signals</h3>
        <p>Analyzing home health...</p>
      </div>
    );
  }

  if (findings.length === 0) {
    return (
      <div className="inspector-empty" role="status">
        <span className="inspector-empty-icon"><ShieldCheck size={30} strokeWidth={1.5} /></span>
        <span className="inspector-eyebrow">Access health</span>
        <h3>No simulated access findings</h3>
        <p>No immediate access health risks detected.</p>
      </div>
    );
  }

  return (
    <div className="inspector-content">
      <div className="inspector-heading">
        <div>
          <span className="inspector-eyebrow">Know your exposure</span>
          <h3>Security Findings</h3>
        </div>
        <span className="inspector-count">{findings.length}<span className="inspector-sr-only"> Issues</span></span>
      </div>
      <p className="inspector-description">Small fixes. A stronger connected home.</p>

      <div className="inspector-card-list">
        {findings.map(f => (
          <article key={f.id} className={`finding-card finding-card--${f.severity}`}>
            <div className="inspector-card-meta">
              <span className={`inspector-badge inspector-badge--${f.severity}`}>
                <span className="inspector-badge-dot" />{f.severity}
              </span>
              <ShieldAlert size={15} className="finding-card-symbol" aria-hidden="true" />
            </div>
            <h4>{f.title}</h4>
            <p>{f.explanation}</p>
            {f.executable ? <button disabled={!canWrite || busy !== null} onClick={() => handleFix(f.id)} className="finding-fix-button" title="Apply Fix">
              <span>{busy === f.id ? "Applying…" : "Apply simulated fix"}</span><ArrowUpRight size={15} aria-hidden="true" />
            </button> : <p className="app-muted">Guidance: create separate vendor accounts in the vendor application. Bulkhead cannot perform this vendor operation.</p>}
          </article>
        ))}
      </div>
    </div>
  );
}
