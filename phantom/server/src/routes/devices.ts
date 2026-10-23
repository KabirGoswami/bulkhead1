import type { FastifyInstance } from 'fastify'
import type { DevicesResponse } from '../types/security.ts'
import { getSimulationSnapshot } from '../simulation/fixtures.ts'

export async function deviceRoutes(app: FastifyInstance) {
  app.get<{ Reply: DevicesResponse }>('/api/v1/devices', async () => {
    const { simulation, scenarioId, capturedAt, devices } = getSimulationSnapshot()
    return { simulation, scenarioId, capturedAt, devices }
  })
}
