export type DeviceId = 'lock-01' | 'cam-01' | 'alarm-01' | 'net-01'
export type DeviceKind = 'lock' | 'camera' | 'alarm' | 'router'
export interface Device { id: DeviceId; name: string; location: string; kind: DeviceKind; reported: string; observed: string; risk: 'critical' | 'warning' | 'secure'; address: string; evidence: string; lastSeen: string }
export const devices: Device[] = [
  { id: 'lock-01', name: 'Front door lock', location: 'Entryway', kind: 'lock', reported: 'Locked', observed: 'Door open', risk: 'critical', address: '192.168.1.21', evidence: 'The lock reports a secured deadbolt, but the contact sensor has remained open for 4 minutes. Last authenticated unlock: 14:28:06.', lastSeen: '2 seconds ago' },
  { id: 'cam-01', name: 'Living room camera', location: 'Living room', kind: 'camera', reported: 'Live feed', observed: 'Feed frozen', risk: 'warning', address: '192.168.1.34', evidence: 'Identical frame hashes across 126 consecutive frames. The device heartbeat is active, but its video timestamp has stopped advancing.', lastSeen: '3 seconds ago' },
  { id: 'alarm-01', name: 'Security hub', location: 'Main hallway', kind: 'alarm', reported: 'Armed', observed: 'Alarm disabled', risk: 'critical', address: '192.168.1.12', evidence: 'The app reports armed-away mode. The local hub returned a disarmed state following an unrecognized configuration request at 14:29:42.', lastSeen: '1 second ago' },
  { id: 'net-01', name: 'Home gateway', location: 'Utility room', kind: 'router', reported: 'Connected', observed: 'Verified secure', risk: 'secure', address: '192.168.1.1', evidence: 'DNS integrity, firmware signature, and outbound connections match the trusted baseline. No unexpected destinations detected.', lastSeen: '1 second ago' },
]
