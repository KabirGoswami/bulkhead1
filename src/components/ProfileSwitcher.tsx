import React, { useState } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:8000';

export default function ProfileSwitcher() {
  const [profile, setProfile] = useState('Admin');

  const handleProfileChange = async (newProfile: string) => {
    setProfile(newProfile);
    try {
      // Note: In a real app, this would be a POST /profile endpoint.
      // For the demo, we'll assume the backend has a global current_profile.
      await axios.post(`${API_BASE}/profile`, { profile: newProfile });
    } catch (e) {
      console.error("Failed to change profile", e);
    }
  };

  return (
    <div className="p-4 rounded-lg border border-slate-700 bg-slate-800/50 space-y-4">
      <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
        User Profile
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {['Admin', 'Family', 'Work', 'Solo'].map(p => (
          <button
            key={p}
            onClick={() => handleProfileChange(p)}
            className={`px-3 py-2 rounded text-xs font-bold transition-all ${
              profile === p
                ? 'bg-accent-blue text-white border-accent-blue'
                : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
            } border`}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
