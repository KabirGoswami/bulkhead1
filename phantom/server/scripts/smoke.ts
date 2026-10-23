import assert from 'node:assert/strict'
import type { DevicesResponse, HealthResponse, SnapshotResponse } from '../src/types/security.ts'

const baseUrl = process.env.API_BASE_URL ?? 'http://127.0.0.1:3001'
async function read<T>(path: string): Promise<T> {
  const response = await fetch(new URL(path, baseUrl), {
    headers: { Origin: 'http://localhost:5173' }, signal: AbortSignal.timeout(5000),
  })
  assert.equal(response.status, 200, `${path} must return HTTP 200`)
  assert.match(response.headers.get('content-type')!, /application\/json/)
  const json = await response.json() as T
  console.log(`HTTP ${response.status} ${path}`)
  return json
}
const health = await read<HealthResponse>('/api/health')
assert.equal(health.status, 'ok')
assert.equal(health.version, '0.1.0')
const devices = await read<DevicesResponse>('/api/v1/devices')
assert.equal(devices.simulation, true)
assert.equal(devices.devices.length, 4)
const snapshot = await read<SnapshotResponse>('/api/v1/snapshot')
assert.equal(snapshot.simulation, true)
assert.deepEqual(snapshot.devices, devices.devices)
assert.equal(snapshot.capturedAt, devices.capturedAt)
assert.equal(snapshot.findings.length, 3)
assert.equal(snapshot.events.length, 8)
console.log(`PASS: ${devices.devices.length} devices, ${snapshot.flows.length} flows, ${snapshot.findings.length} findings, ${snapshot.events.length} events; backend ${health.version}, simulation only.`)
