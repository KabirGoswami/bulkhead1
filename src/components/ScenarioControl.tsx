import React, { useState } from 'react';
import axios from 'axios';
import { Play, RotateCcw, Activity, AlertCircle, ShieldCheck } from 'lucide-react';

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
    <div className="p-4 rounded-lg border border-slate-700 bg-slate-800/50 space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Activity size={16} className="text-accent-blue" />
          Simulation Control
        </h3>

        <div className="grid grid-cols-1 gap-3">
          <button
            onClick={() => triggerScenario('A')}
            disabled={loading !== null}
            className="flex items-center justify-between p-3 rounded bg-slate-900 border border-slate-700 hover:border-accent-blue transition-all group text-left"
          >
            <div>
              <div className="text-sm font-bold text-white">Scenario A: Compromised Plug</div>
              <div className="text-xs text-slate-500">C&C Upload + Lateral Movement</div>
            </div>
            <Play size={16} className="text-slate-600 group-hover:text-accent-blue" />
          </button>

          <button
            onClick={() => triggerScenario('B')}
            disabled={loading !== null}
            className="flex items-center justify-between p-3 rounded bg-slate-900 border border-slate-700 hover:border-accent-blue transition-all group text-left"
          >
            <div>
              <div className="text-sm font-bold text-white">Scenario B: Stolen Creds</div>
              <div className="text-xs text-slate-500">Geo-anomaly + Unauthorized Unlock</div>
            </div>
            <Play size={16} className="text-slate-600 group-hover:text-accent-blue" />
          </button>

          <button
            onClick={() => triggerScenario('C')}
            disabled={loading !== null}
            className="flex items-center justify-between p-3 rounded bg-slate-900 border border-slate-700 hover:border-accent-blue transition-all group text-left"
          >
            <div>
              <div className="text-sm font-bold text-white">Scenario C: Benign Update</div>
              <div className="text-xs text-slate-500">Verified Vendor Volume Spike</div>
            </div>
            <Play size={16} className="text-slate-600 group-hover:text-accent-blue" />
          </button>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-700">
        <button
          onClick={resetScenario}
          disabled={loading !== null}
          className="w-full flex items-center justify-center gap-2 py-2 rounded bg-slate-700 hover:bg-slate-600 text-xs font-bold text-slate-300 transition-colors"
        >
          <RotateCcw size={14} />
          Reset Simulation
        </button>
      </div>
    </div>
  );
}
