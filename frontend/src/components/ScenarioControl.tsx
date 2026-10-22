import React, { useState } from 'react';
import axios from 'axios';
import { Play, RotateCcw, Activity, PlugZap, KeyRound, Download, LoaderCircle } from 'lucide-react';
import '../styles/controls.css';

const API_BASE = 'http://localhost:8000';

export default function ScenarioControl() {
  const [loading, setLoading] = useState<string | null>(null);

  const triggerScenario = async (id: string) => {
    setLoading(id);
    try {
      await axios.post(`${API_BASE}/scenario/${id}`);
    } catch (e) {
      console.error(`Failed to trigger scenario ${id}`, e);
    } finally {
      setLoading(null);
    }
  };

  const resetScenario = async () => {
    setLoading('reset');
    try {
      await axios.post(`${API_BASE}/scenario/reset`);
    } catch (e) {
      console.error("Failed to reset scenario", e);
    } finally {
      setLoading(null);
    }
  };

  return (
    <section className="scenario-lab" aria-labelledby="scenario-lab-heading">
      <div className="scenario-header">
        <div>
          <h2 id="scenario-lab-heading" className="scenario-heading">
            <Activity size={17} aria-hidden="true" /> Simulation lab
          </h2>
          <p className="scenario-description">Test your defenses in a controlled environment.</p>
        </div>
        <button
          type="button"
          onClick={resetScenario}
          disabled={loading !== null}
          className="scenario-reset"
        >
          {loading === 'reset'
            ? <LoaderCircle size={14} className="scenario-spinner" aria-hidden="true" />
            : <RotateCcw size={14} aria-hidden="true" />}
          Reset Simulation
        </button>
      </div>
      <div className="scenario-grid">
          <button
            type="button"
            aria-label="Scenario A: Compromised Plug"
            onClick={() => triggerScenario('A')}
            disabled={loading !== null}
            className="scenario-card scenario-card-a"
          >
            <span className="scenario-icon"><PlugZap size={20} aria-hidden="true" /></span>
            <div className="scenario-copy">
              <span className="scenario-eyebrow">Scenario A</span>
              <span className="scenario-title">Compromised Plug</span>
              <span className="scenario-detail">C&amp;C Upload + Lateral Movement</span>
            </div>
            <span className="scenario-play">{loading === 'A'
              ? <LoaderCircle size={15} className="scenario-spinner" aria-label="Starting scenario A" />
              : <Play size={14} aria-hidden="true" />}</span>
          </button>

          <button
            type="button"
            aria-label="Scenario B: Stolen Creds"
            onClick={() => triggerScenario('B')}
            disabled={loading !== null}
            className="scenario-card scenario-card-b"
          >
            <span className="scenario-icon"><KeyRound size={20} aria-hidden="true" /></span>
            <div className="scenario-copy">
              <span className="scenario-eyebrow">Scenario B</span>
              <span className="scenario-title">Stolen Creds</span>
              <span className="scenario-detail">Geo-anomaly + Unauthorized Unlock</span>
            </div>
            <span className="scenario-play">{loading === 'B'
              ? <LoaderCircle size={15} className="scenario-spinner" aria-label="Starting scenario B" />
              : <Play size={14} aria-hidden="true" />}</span>
          </button>

          <button
            type="button"
            aria-label="Scenario C: Benign Update"
            onClick={() => triggerScenario('C')}
            disabled={loading !== null}
            className="scenario-card scenario-card-c"
          >
            <span className="scenario-icon"><Download size={20} aria-hidden="true" /></span>
            <div className="scenario-copy">
              <span className="scenario-eyebrow">Scenario C</span>
              <span className="scenario-title">Benign Update</span>
              <span className="scenario-detail">Verified Vendor Volume Spike</span>
            </div>
            <span className="scenario-play">{loading === 'C'
              ? <LoaderCircle size={15} className="scenario-spinner" aria-label="Starting scenario C" />
              : <Play size={14} aria-hidden="true" />}</span>
          </button>
      </div>
    </section>
  );
}
