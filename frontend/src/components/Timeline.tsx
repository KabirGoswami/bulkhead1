import React, { useState, useEffect } from 'react';
import { Activity, Search, ShieldCheck, RotateCcw, Radio } from 'lucide-react';
import '../styles/inspector.css';

interface TimelineEvent {
  type: 'DETECTION' | 'EXPLANATION' | 'CONTAINMENT' | 'RECOVERY';
  timestamp: string;
  node_id: string;
  message: string;
}

export default function Timeline() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8000/ws`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'SIM_TICK' && data.payload.alerts) {
        const newEvents: TimelineEvent[] = [];
        data.payload.alerts.forEach((alert: any) => {
          newEvents.push({
            type: 'DETECTION',
            timestamp: alert.timestamp,
            node_id: alert.node_id,
            message: `Anomalous activity detected on ${alert.node_id}`
          });
          newEvents.push({
            type: 'EXPLANATION',
            timestamp: alert.timestamp,
            node_id: alert.node_id,
            message: alert.explanation
          });
          if (alert.action_taken === 'CONTAINED') {
            newEvents.push({
              type: 'CONTAINMENT',
              timestamp: alert.timestamp,
              node_id: alert.node_id,
              message: `Node ${alert.node_id} has been automatically contained.`
            });
          }
        });
        setEvents(prev => [...newEvents, ...prev]);
      }
    };
    return () => ws.close();
  }, []);

  const eventIcons = { DETECTION: Activity, EXPLANATION: Search, CONTAINMENT: ShieldCheck, RECOVERY: RotateCcw };

  return (
    <div className="inspector-content">
      <div className="inspector-heading">
        <div>
          <span className="inspector-eyebrow">The full sequence</span>
          <h3>Event Timeline</h3>
        </div>
        <span className="inspector-count">{events.length}<span className="inspector-sr-only"> Events</span></span>
      </div>
      <p className="inspector-description">From first signal to containment.</p>

      {events.length === 0 ? (
        <div className="inspector-empty inspector-empty--inset">
          <span className="inspector-empty-icon"><Activity size={30} strokeWidth={1.5} /></span>
          <h4>A clear view of every event</h4>
          <p>Waiting for simulation events...</p>
          <span className="inspector-stream-label"><Radio size={12} aria-hidden="true" /> Simulation event stream</span>
        </div>
      ) : (
        <ol className="event-timeline">
          {events.map((event, i) => {
            const Icon = eventIcons[event.type];
            return (
              <li key={i} className={`event-entry event-entry--${event.type.toLowerCase()}`}>
                <span className="event-entry-marker"><Icon size={13} aria-hidden="true" /></span>
                <div className="event-entry-meta">
                  <span className="event-entry-type">{event.type}</span>
                  <time dateTime={event.timestamp}>{new Date(event.timestamp).toLocaleTimeString()}</time>
                </div>
                <p>{event.message}</p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
