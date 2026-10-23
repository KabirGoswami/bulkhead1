// Adapted from src/data/devices.ts and src/data/security.ts. No React/runtime frontend imports.
export type DeviceId = 'lock-01' | 'cam-01' | 'alarm-01' | 'net-01'
export type DeviceKind = 'lock' | 'camera' | 'alarm' | 'router'
export interface Device { id: DeviceId; name: string; location: string; kind: DeviceKind; reported: string; observed: string; risk: 'critical' | 'warning' | 'secure'; address: string; evidence: string; lastSeen: string; lastSeenAt: string }
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


export interface SimulationMetadata {
  simulation: true
  scenarioId: string
  capturedAt: string
}
export interface DevicesResponse extends SimulationMetadata { devices: Device[] }
export interface SnapshotResponse extends SecuritySnapshot, SimulationMetadata { devices: Device[] }
export interface HealthResponse { status: 'ok'; service: 'phantom-api'; version: string; simulation: true }
