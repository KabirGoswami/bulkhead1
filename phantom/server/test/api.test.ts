import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildApp } from '../src/app.ts'
import { loadConfig } from '../src/config.ts'
import type { DevicesResponse, HealthResponse, SnapshotResponse } from '../src/types/security.ts'
import { SERVER_VERSION } from '../src/version.ts'

const config = loadConfig({})

test('health returns JSON health, backend version, and simulation label', async t => {
  const app = buildApp(config, false)
  t.after(() => app.close())
  const response = await app.inject({ method: 'GET', url: '/api/health' })
  assert.equal(response.statusCode, 200)
  assert.match(response.headers['content-type']!, /application\/json/)
  assert.equal(response.headers['cache-control'], 'no-store')
  assert.deepEqual(response.json<HealthResponse>(), { status: 'ok', service: 'phantom-api', version: SERVER_VERSION, simulation: true })
})

test('devices returns the four expected simulated devices and stable capture metadata', async t => {
  const app = buildApp(config, false)
  t.after(() => app.close())
  const response = await app.inject('/api/v1/devices')
  assert.equal(response.statusCode, 200)
  const body = response.json<DevicesResponse>()
  assert.equal(body.simulation, true)
  assert.equal(body.devices.length, 4)
  assert.deepEqual(body.devices.map(d => d.id), ['lock-01', 'cam-01', 'alarm-01', 'net-01'])
  assert.equal(body.scenarioId, 'residence-01-capture-001')
  for (const device of body.devices) assert(Date.parse(device.lastSeenAt) <= Date.parse(body.capturedAt))
})

test('snapshot and device endpoints are deterministic and internally consistent', async t => {
  const app = buildApp(config, false)
  t.after(() => app.close())
  const response = await app.inject('/api/v1/snapshot')
  assert.equal(response.statusCode, 200)
  const body = response.json<SnapshotResponse>()
  const deviceResponse = (await app.inject('/api/v1/devices')).json<DevicesResponse>()
  assert.equal(body.simulation, true)
  assert.equal(body.capturedAt, deviceResponse.capturedAt)
  assert.equal(body.scenarioId, deviceResponse.scenarioId)
  assert.deepEqual(body.devices, deviceResponse.devices)
  assert.equal(body.flows.length, 4)
  assert.equal(body.findings.length, 3)
  assert.equal(body.events.length, 8)
  assert.deepEqual((await app.inject('/api/v1/snapshot')).json(), body)
  const ids = new Set(body.devices.map(d => d.id))
  for (const flow of body.flows) { assert(ids.has(flow.deviceId)); assert(flow.outboundKB > 0) }
  for (const finding of body.findings) {
    assert(ids.has(finding.deviceId))
    assert(finding.confidence >= 0 && finding.confidence <= 100)
    for (const id of finding.eventIds) assert(body.events.some(e => e.id === id && e.deviceId === finding.deviceId))
  }
  for (const [index, event] of body.events.entries()) {
    assert(ids.has(event.deviceId))
    assert(Date.parse(event.timestamp) <= Date.parse(body.capturedAt))
    if (index > 0) assert(Date.parse(event.timestamp) >= Date.parse(body.events[index - 1].timestamp))
    if (event.flowId) assert(body.flows.some(f => f.id === event.flowId && f.deviceId === event.deviceId))
    if (event.findingId) assert(body.findings.some(f => f.id === event.findingId))
  }
})

test('CORS allows local Vite origins and rejects unlisted origins', async t => {
  const app = buildApp(config, false)
  t.after(() => app.close())
  for (const origin of config.corsOrigins) {
    const response = await app.inject({ url: '/api/v1/devices', headers: { origin } })
    assert.equal(response.statusCode, 200)
    assert.equal(response.headers['access-control-allow-origin'], origin)
  }
  const denied = await app.inject({ url: '/api/v1/devices', headers: { origin: 'https://unlisted.example' } })
  assert.equal(denied.headers['access-control-allow-origin'], undefined)
  const preflight = await app.inject({ method: 'OPTIONS', url: '/api/v1/devices', headers: { origin: config.corsOrigins[0], 'access-control-request-method': 'GET' } })
  assert.equal(preflight.statusCode, 204)
  assert.equal(preflight.headers['access-control-allow-origin'], config.corsOrigins[0])
  assert.match(preflight.headers['access-control-allow-methods']!, /GET/)
})

test('unimplemented mutation routes are absent', async t => {
  const app = buildApp(config, false)
  t.after(() => app.close())
  const response = await app.inject({ method: 'POST', url: '/api/v1/devices/cam-01/containment', payload: { action: 'isolate' } })
  assert.equal(response.statusCode, 404)
})
