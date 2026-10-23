import type { FastifyInstance } from 'fastify'
import type { SnapshotResponse } from '../types/security.ts'
import { getSimulationSnapshot } from '../simulation/fixtures.ts'

export async function snapshotRoutes(app: FastifyInstance) {
  app.get<{ Reply: SnapshotResponse }>('/api/v1/snapshot', async () => getSimulationSnapshot())
}
