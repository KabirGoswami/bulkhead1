import { lazy, Suspense, useCallback, useState } from 'react'
const NetworkMonitor = lazy(() => import('./NetworkMonitor').then(module => ({ default: module.NetworkMonitor })))
import { ThreatIntelligence } from './ThreatIntelligence'
import { IncidentTimeline } from './IncidentTimeline'
import { ContainmentPanel } from './ContainmentPanel'
import { applyContainment, snapshot, type DeviceId, type ContainmentAction, type IncidentEvent } from '../../data/security'
import './workspace.css'
interface Props { isolated: Set<DeviceId>; onIsolatedChange: (value: Set<DeviceId>) => void }
function goTo(id: string) { document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }) }
export function SecurityWorkspace({ isolated, onIsolatedChange }: Props) {
  const [selected, setSelected] = useState<DeviceId>('cam-01')
  const [eventId, setEventId] = useState(snapshot.events[0].id)
  const [actions, setActions] = useState<ContainmentAction[]>([])
  const onEvent = useCallback((event: IncidentEvent) => { setEventId(event.id); setSelected(event.deviceId) }, [])
  function inspect(id: DeviceId) { setSelected(id); goTo('network-monitor') }
  function selectEvent(id: string) { const event = snapshot.events.find(e => e.id === id); if(event) onEvent(event); goTo('incident-timeline') }
  function act(id: DeviceId, action: 'isolate' | 'restore') {
    if (id === 'net-01') return
    onIsolatedChange(applyContainment(isolated, id, action))
    setActions(previous => [...previous, { id: crypto.randomUUID(), deviceId: id, action, timestamp: new Date().toISOString() }])
  }
  return <div className="security-workspace"><Suspense fallback={<div className="workspace-section" role="status">Loading network monitor…</div>}><NetworkMonitor selected={selected} onSelect={setSelected} isolated={isolated} event={snapshot.events.find(e => e.id === eventId) ?? null}/></Suspense><ThreatIntelligence isolated={isolated} onInspect={inspect} onEvent={selectEvent}/><IncidentTimeline eventId={eventId} onSelect={onEvent} onInspect={inspect}/><ContainmentPanel selected={selected} onSelect={setSelected} isolated={isolated} onAction={act} actions={actions}/><p className="workspace-disclosure">PHANTOM / SCENARIO 01 · All telemetry, destinations, findings, and containment actions are simulated. Reloading resets the workspace.</p></div>
}
