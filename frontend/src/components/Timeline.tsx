import { useEffect, useState } from 'react';
import { api, errorText } from '../lib/api';
import { useBulkhead } from '../lib/session';
import '../styles/inspector.css';

export default function Timeline() {
  const { state, path, stream } = useBulkhead();
  const [events, setEvents] = useState<any[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    api(path('/audit-events'), { signal: controller.signal }).then(rows => { setEvents(rows); setError(''); })
      .catch(err => { if (!controller.signal.aborted) setError(errorText(err)); });
    return () => controller.abort();
  }, [path, state?.sequence]);
  return <div className="inspector-content"><div className="inspector-heading"><div><span className="inspector-eyebrow">Actor-attributed history</span><h3>Event Timeline</h3></div><span className="inspector-count">{events.length}</span></div><p className="inspector-description">{stream} · Persistent history includes manual actions and recovery.</p>
    {error && <p role="alert" className="app-error">History unavailable: {error}</p>}
    <ol className="app-timeline">{events.map(event => <li key={event.id}><time dateTime={event.timestamp}>{new Date(event.timestamp).toLocaleString()}</time><p>{event.kind.replaceAll('.', ' · ')}</p><span className="app-muted">Actor: {event.actor_id || 'Background worker'}</span><p>{event.data.explanation || Object.entries(event.data).map(([k,v]) => `${k}: ${v}`).join(' · ')}</p></li>)}</ol>
    {!events.length && !error && <p>Waiting for household history…</p>}
  </div>;
}
