import { devices, type DeviceId } from './devices'
export type { DeviceId } from './devices'

export type Severity = 'critical' | 'high' | 'medium'
export interface TrafficFlow {
  id: string; deviceId: DeviceId; destination: string; destinationName: string
  port: number; protocol: 'TLS' | 'HTTPS' | 'MQTT'; outboundKB: number
  windowSeconds: number; suspicious: boolean; reason: string
}
export interface SecurityFinding {
  id: string; title: string; deviceId: DeviceId; severity: Severity
  timestamp: string; confidence: number; assessment: string; evidence: string[]
  uncertainty: string; recommendation: string; eventIds: string[]
}
export interface IncidentEvent {
  id: string; timestamp: string; deviceId: DeviceId; title: string
  detail: string; category: 'baseline' | 'access' | 'discrepancy' | 'traffic'
  flowId?: string; findingId?: string
}
export interface ContainmentAction { id: string; deviceId: DeviceId; action: 'isolate' | 'restore'; timestamp: string }
export interface SecuritySnapshot { capturedAt: string; flows: TrafficFlow[]; findings: SecurityFinding[]; events: IncidentEvent[] }

export const snapshot: SecuritySnapshot = {
  capturedAt: '2026-10-24T14:32:08+05:30',
  flows: [
    { id: 'flow-lock', deviceId: 'lock-01', destination: '192.0.2.21', destinationName: 'Lock vendor relay · baseline', port: 443, protocol: 'HTTPS', outboundKB: 28, windowSeconds: 300, suspicious: false, reason: 'Periodic status synchronization matches the trusted baseline.' },
    { id: 'flow-camera', deviceId: 'cam-01', destination: '203.0.113.42', destinationName: 'Unrecognized destination', port: 8443, protocol: 'TLS', outboundKB: 18640, windowSeconds: 300, suspicious: true, reason: 'First-seen destination and 6.2× normal outbound volume. Encrypted payload content is unknown.' },
    { id: 'flow-hub', deviceId: 'alarm-01', destination: '192.0.2.12', destinationName: 'Security vendor relay · baseline', port: 8883, protocol: 'MQTT', outboundKB: 64, windowSeconds: 300, suspicious: false, reason: 'Expected hub telemetry endpoint. Destination alone does not explain the unexpected configuration request.' },
    { id: 'flow-gateway', deviceId: 'net-01', destination: '192.0.2.1', destinationName: 'Gateway update service · baseline', port: 443, protocol: 'HTTPS', outboundKB: 142, windowSeconds: 300, suspicious: false, reason: 'Signed firmware manifest check. Volume and timing match the baseline.' },
  ],
  findings: [
    { id: 'finding-door', deviceId: 'lock-01', title: 'Door state contradicts lock report', severity: 'critical', timestamp: '2026-10-24T14:28:08+05:30', confidence: 98, assessment: 'Confirmed state discrepancy. The physical entryway may be unsecured.', evidence: ['Deadbolt API reports locked; contact sensor reports open.', 'Contact remained open from 14:28:08 through the 14:32:08 capture.', 'An authenticated unlock was recorded at 14:28:06.'], uncertainty: 'A misaligned contact sensor or delayed lock telemetry could explain the mismatch. Intrusion is not established.', recommendation: 'Check the physical door first. Network isolation cannot close or lock it.', eventIds: ['event-unlock', 'event-door'] },
    { id: 'finding-camera', deviceId: 'cam-01', title: 'Possible camera data leakage', severity: 'high', timestamp: '2026-10-24T14:31:12+05:30', confidence: 78, assessment: 'An unusual outbound transfer overlaps a frozen camera feed. Investigate possible leakage.', evidence: ['18.64 MB sent to first-seen 203.0.113.42:8443 in the captured five-minute window.', 'Outbound volume is 6.2× the device baseline.', '126 consecutive frames repeat the same hash while the device heartbeat remains active.'], uncertainty: 'TLS hides payload contents. A vendor upload or firmware defect is possible; exfiltration is not confirmed.', recommendation: 'Review the destination and vendor activity. Consider isolating the camera while investigating.', eventIds: ['event-freeze', 'event-egress', 'event-correlation'] },
    { id: 'finding-hub', deviceId: 'alarm-01', title: 'Unrecognized hub configuration attempt', severity: 'high', timestamp: '2026-10-24T14:29:42+05:30', confidence: 87, assessment: 'A configuration change from an unrecognized client precedes an alarm-state discrepancy.', evidence: ['192.168.1.77 submitted a local configuration request at 14:29:42.', 'Client identity is absent from the saved trusted-client inventory.', 'The hub subsequently reports disarmed while the companion app still shows armed-away.'], uncertainty: 'The client could be a newly enrolled household device. Authorization and intent have not been verified.', recommendation: 'Verify the client with the household and check the alarm locally before isolating the hub.', eventIds: ['event-config', 'event-alarm'] },
  ],
  events: [
    { id: 'event-baseline', timestamp: '2026-10-24T14:27:08+05:30', deviceId: 'net-01', title: 'Trusted network baseline', detail: 'Four devices connected. Gateway signature and known vendor endpoints match the saved baseline.', category: 'baseline' },
    { id: 'event-unlock', timestamp: '2026-10-24T14:28:06+05:30', deviceId: 'lock-01', title: 'Authenticated door unlock', detail: 'A recognized household credential unlocked the front door. This event alone is expected activity.', category: 'access', findingId: 'finding-door' },
    { id: 'event-door', timestamp: '2026-10-24T14:28:08+05:30', deviceId: 'lock-01', title: 'Door sensor and lock disagree', detail: 'Contact sensor opens while the lock API reports secured. The mismatch persists through the capture.', category: 'discrepancy', findingId: 'finding-door' },
    { id: 'event-config', timestamp: '2026-10-24T14:29:42+05:30', deviceId: 'alarm-01', title: 'Unrecognized configuration client', detail: 'Local client 192.168.1.77 sends a configuration request. Its authorization is unknown.', category: 'access', findingId: 'finding-hub' },
    { id: 'event-alarm', timestamp: '2026-10-24T14:29:44+05:30', deviceId: 'alarm-01', title: 'Alarm state diverges', detail: 'Local hub reports disarmed; the app continues reporting armed-away. Temporal proximity is not proof of causation.', category: 'discrepancy', findingId: 'finding-hub' },
    { id: 'event-freeze', timestamp: '2026-10-24T14:30:02+05:30', deviceId: 'cam-01', title: 'Camera timestamp stops advancing', detail: 'Heartbeat remains active. Repeated frame hashes suggest a frozen or replayed feed; the cause is unverified.', category: 'discrepancy', findingId: 'finding-camera' },
    { id: 'event-egress', timestamp: '2026-10-24T14:30:18+05:30', deviceId: 'cam-01', title: 'New outbound camera destination', detail: 'TLS traffic begins to 203.0.113.42:8443, a destination absent from the saved baseline.', category: 'traffic', flowId: 'flow-camera', findingId: 'finding-camera' },
    { id: 'event-correlation', timestamp: '2026-10-24T14:31:12+05:30', deviceId: 'cam-01', title: 'Related signals flagged for review', detail: 'Frozen frames and unusual outbound volume are correlated. The lock and hub anomalies share the time window; a common attacker is not established.', category: 'traffic', flowId: 'flow-camera', findingId: 'finding-camera' },
  ],
}
export const timeLabel = (timestamp: string) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(timestamp))
export const volumeLabel = (kb: number) => kb >= 1000 ? `${(kb / 1000).toFixed(2)} MB` : `${kb} KB`
export const deviceName = (id: DeviceId) => devices.find(d => d.id === id)?.name ?? id

// Pure simulation state transition; replace with an API-backed action later.
export function applyContainment(current: ReadonlySet<DeviceId>, deviceId: DeviceId, action: ContainmentAction['action']): Set<DeviceId> {
  const next = new Set(current)
  if (deviceId === 'net-01') return next
  if (action === 'isolate') next.add(deviceId)
  else next.delete(deviceId)
  return next
}
