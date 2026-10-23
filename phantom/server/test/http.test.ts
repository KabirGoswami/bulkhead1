import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildApp } from '../src/app.ts'
import { loadConfig } from '../src/config.ts'
import type { DevicesResponse, HealthResponse, SnapshotResponse } from '../src/types/security.ts'

// This deliberately uses a TCP listener and real fetch(), not Fastify inject().
// It must fail rather than silently skip when socket binding is unavailable.
test('all three endpoints respond over a real HTTP socket', async t => {
  const app = buildApp(loadConfig({}), false)
  t.after(() => app.close())
  const address = await app.listen({ port: 0, host: '127.0.0.1' })
  async function read<T>(path: string): Promise<T> {
    const response = await fetch(`${address}${path}`, {
      headers: { Origin: 'http://localhost:5173' }, signal: AbortSignal.timeout(5000),
    })
    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type')!, /application\/json/)
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173')
    return await response.json() as T
  }
  const health = await read<HealthResponse>('/api/health')
  assert.equal(health.status, 'ok')
  assert.equal(health.version, '0.1.0')
  const devices = await read<DevicesResponse>('/api/v1/devices')
  const snapshot = await read<SnapshotResponse>('/api/v1/snapshot')
  assert.equal(devices.simulation, true)
  assert.equal(devices.devices.length, 4)
  assert.deepEqual(snapshot.devices, devices.devices)
  assert.equal(snapshot.findings.length, 3)
  assert.equal(snapshot.events.length, 8)
})
