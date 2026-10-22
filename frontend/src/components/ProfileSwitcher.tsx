import React, { useState } from 'react';
import axios from 'axios';
import { UserRound } from 'lucide-react';
import '../styles/controls.css';

const API_BASE = 'http://localhost:8000';

export default function ProfileSwitcher() {
  const [profile, setProfile] = useState('Admin');

  const handleProfileChange = async (newProfile: string) => {
    setProfile(newProfile);
    try {
      await axios.post(`${API_BASE}/profile`, { profile: newProfile });
    } catch (e) {
      console.error("Failed to change profile", e);
    }
  };

  return (
    <div className="profile-switcher">
      <span className="profile-label"><UserRound size={14} aria-hidden="true" /> Profile</span>
      <div className="profile-options" role="group" aria-label="User profile">
        {['Admin', 'Family', 'Work', 'Solo'].map(p => (
          <button
            key={p}
            type="button"
            onClick={() => handleProfileChange(p)}
            aria-pressed={profile === p}
            className={`profile-option${profile === p ? ' profile-option-active' : ''}`}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
