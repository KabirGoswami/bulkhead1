import type { SecurityFinding } from './security'
export const RADAR_CYCLE_SECONDS = 14
// Bearings run clockwise from north, matching the SVG beam's initial orientation.
export function radarPosition(finding: SecurityFinding, index: number) {
  const bearing = (20 + index * 120) % 360
  const radians = bearing * Math.PI / 180
  const radius = 96 + (100 - finding.confidence) * 1.4
  return { bearing, x: 200 + Math.sin(radians) * radius, y: 200 - Math.cos(radians) * radius, pulseDelay: bearing / 360 * RADAR_CYCLE_SECONDS }
}
export interface FindingCorrelation { id: string; findingIds: string[]; supportingEventIds: string[]; description: string; uncertainty: string }
// This relation is explicitly described by event-correlation in the captured scenario.
// It is a time-window association, not a claim of shared malicious origin.
export const findingCorrelations: FindingCorrelation[] = [{
  id: 'shared-capture-window', findingIds: ['finding-camera', 'finding-door', 'finding-hub'], supportingEventIds: ['event-correlation'],
  description: 'Camera, lock, and hub anomalies occur in the same captured time window.',
  uncertainty: 'Timing alone does not establish causation or a common attacker.',
}]
