import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadConfig } from '../src/config.ts'
import { getSimulationSnapshot } from '../src/simulation/fixtures.ts'

test('fixture captures are deterministic, isolated copies with valid references', () => {
  const snapshot = getSimulationSnapshot()
  const another = getSimulationSnapshot()
  assert.deepEqual(another, snapshot)
  another.devices[0].name = 'changed'
  another.findings[0].evidence.length = 0
  assert.deepEqual(getSimulationSnapshot(), snapshot)
  assert.equal(snapshot.simulation, true)
  assert.equal(snapshot.devices.length, 4)
  const ids = new Set(snapshot.devices.map(d => d.id))
  for (const device of snapshot.devices) assert(Date.parse(device.lastSeenAt) <= Date.parse(snapshot.capturedAt))
  for (const flow of snapshot.flows) assert(ids.has(flow.deviceId))
  for (const finding of snapshot.findings) {
    assert(ids.has(finding.deviceId))
    for (const id of finding.eventIds) assert(snapshot.events.some(e => e.id === id && e.deviceId === finding.deviceId))
  }
  for (const [index, event] of snapshot.events.entries()) {
    assert(ids.has(event.deviceId))
    if (index) assert(Date.parse(event.timestamp) >= Date.parse(snapshot.events[index - 1].timestamp))
    assert(Date.parse(event.timestamp) <= Date.parse(snapshot.capturedAt))
  }
})

test('configuration supports local Vite origins and explicit overrides', () => {
  assert.equal(loadConfig({}).port, 3001)
  assert.deepEqual(loadConfig({}).corsOrigins, ['http://localhost:5173', 'http://127.0.0.1:5173'])
  const config = loadConfig({ SERVER_PORT: '4200', SERVER_HOST: 'localhost', CORS_ORIGINS: 'http://localhost:5174', LOG_LEVEL: 'warn' })
  assert.equal(config.port, 4200)
  assert.equal(config.host, 'localhost')
  assert.equal(config.logLevel, 'warn')
  assert.deepEqual(config.corsOrigins, ['http://localhost:5174'])
  assert.equal(loadConfig({ PORT: '4201' }).port, 4201)
})

test('invalid server settings fail before startup', () => {
  for (const port of ['', '0', '65536', '1.5', 'nonsense']) assert.throws(() => loadConfig({ SERVER_PORT: port }))
  for (const origin of ['', '*', 'http://localhost:5173/path', 'file:///tmp/file']) assert.throws(() => loadConfig({ CORS_ORIGINS: origin }))
  assert.throws(() => loadConfig({ SERVER_HOST: '' }))
  assert.throws(() => loadConfig({ LOG_LEVEL: 'invalid' }))
})
