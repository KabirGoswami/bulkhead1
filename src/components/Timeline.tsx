import React, { useState, useEffect } from 'react';

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
          // Detection
          newEvents.push({
            type: 'DETECTION',
            timestamp: alert.timestamp,
            node_id: alert.node_id,
            message: `Anomalous activity detected on ${alert.node_id}`
          });
          // Explanation
          newEvents.push({
            type: 'EXPLANATION',
            timestamp: alert.timestamp,
            node_id: alert.node_id,
            message: alert.explanation
          });
          // Containment (if auto-acted)
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

  const getEventColor = (type: string) => {
    switch (type) {
      case 'DETECTION': return 'text-warn-amber';
      case 'EXPLANATION': return 'text-blue-400';
      case 'CONTAINMENT': return 'text-safe-green';
      case 'RECOVERY': return 'text-accent-blue';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-accent-blue animate-pulse" />
        Event Timeline
      </h3>

      <div className="relative pl-6 border-l-2 border-slate-700 space-y-8">
        {events.length === 0 ? (
          <div className="text-slate-500 text-sm italic">Waiting for simulation events...</div>
        ) : (
          events.map((event, i) => (
            <div key={i} className="relative">
              <div className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-dark-bg ${getEventColor(event.type).replace('text-', 'bg-')} bg-opacity-50`} />
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase tracking-tighter ${getEventColor(event.type)}`}>
                    {event.type}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {event.message}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
