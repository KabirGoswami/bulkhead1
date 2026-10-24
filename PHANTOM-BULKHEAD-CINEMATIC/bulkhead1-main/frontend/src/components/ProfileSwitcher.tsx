import React, { useState } from 'react';
import { post, errorText } from '../lib/api';
import { useBulkhead } from '../lib/session';
import { UserRound } from 'lucide-react';
import '../styles/controls.css';



export default function ProfileSwitcher() {
  const { state, path, refresh, canWrite } = useBulkhead();
  const profile = state?.profile;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleProfileChange = async (newProfile: string) => {
    setBusy(true); setError('');
    try {
      await post(path('/profile'), { profile: newProfile });
      await refresh();
    } catch (e) {
      setError(errorText(e));
    } finally { setBusy(false); }
  };

  return (
    <div className="profile-switcher">
      <span className="profile-label"><UserRound size={14} aria-hidden="true" /> Profile</span>
      <div className="profile-options" role="group" aria-label="Response profile">
        {['Admin', 'Family', 'Work', 'Solo'].map(p => (
          <button
            key={p}
            type="button"
            disabled={busy || !canWrite || !state}
            onClick={() => handleProfileChange(p)}
            aria-pressed={profile === p}
            className={`profile-option${profile === p ? ' profile-option-active' : ''}`}
          >
            {p}
          </button>
        ))}
      </div>
      {error && <span role="alert" className="app-error">{error}</span>}
    </div>
  );
}
