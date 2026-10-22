import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShieldAlert, ShieldCheck, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import AccessHealth from './components/AccessHealth';
import HomeMap from './components/HomeMap';
import AlertFeed from './components/AlertFeed';
import ScenarioControl from './components/ScenarioControl';
import Timeline from './components/Timeline';
import ProfileSwitcher from './components/ProfileSwitcher';

const API_BASE = 'http://localhost:8000';

export default function App() {
  const [activeTab, setActiveTab] = useState('health');
  const [exposureScore, setExposureScore] = useState(0);
  const [simulationActive, setSimulationActive] = useState(true);

  useEffect(() => {
    const fetchScore = async () => {
      try {
        const res = await axios.get(`${API_BASE}/state`);
        setExposureScore(res.data.exposure_score);
      } catch (e) { console.error(e); }
    };
    fetchScore();
    const interval = setInterval(fetchScore, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top Bar */}
      <header className="h-16 border-b border-slate-700 bg-dark-card flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <ShieldAlert className="text-accent-blue" />
            Bulkhead
          </h1>
          <div className="px-2 py-1 rounded bg-slate-800 text-xs font-mono text-slate-400 border border-slate-600 uppercase tracking-widest">
            Simulation Mode
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="flex flex-col items-end">
            <span className="text-xs text-slate-400 uppercase font-semibold">Home Exposure Score</span>
            <span className={`text-2xl font-mono font-bold ${exposureScore > 50 ? 'text-critical-red' : 'text-safe-green'}`}>
              {Math.round(exposureScore)}/100
            </span>
          </div>
          <div className="h-10 w-px bg-slate-700" />
          <div className="flex items-center gap-3">
            <ProfileSwitcher />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left: Home Map & Controls */}
        <div className="flex-1 bg-dark-bg relative border-r border-slate-700 flex flex-col">
          <div className="flex-1 relative">
            <HomeMap />
          </div>
          <div className="p-6 bg-dark-card/50 border-t border-slate-700">
            <div className="max-w-md mx-auto">
              <ScenarioControl />
            </div>
          </div>
        </div>

        {/* Right: Panels */}
        <div className="w-1/3 bg-dark-card flex flex-col overflow-hidden">
          <div className="flex border-b border-slate-700">
            <button
              onClick={() => setActiveTab('health')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'health' ? 'bg-slate-800 text-white border-b-2 border-accent-blue' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Access Health
            </button>
            <button
              onClick={() => setActiveTab('alerts')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'alerts' ? 'bg-slate-800 text-white border-b-2 border-accent-blue' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Alerts
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'timeline' ? 'bg-slate-800 text-white border-b-2 border-accent-blue' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Timeline
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'health' && <AccessHealth />}
            {activeTab === 'alerts' && <AlertFeed />}
            {activeTab === 'timeline' && <Timeline />}
          </div>
        </main>
      </div>
    </div>
  );
}
