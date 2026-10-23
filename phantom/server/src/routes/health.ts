import type { FastifyInstance } from 'fastify'
import type { HealthResponse } from '../types/security.ts'
import { SERVER_VERSION } from '../version.ts'

export async function healthRoutes(app: FastifyInstance) {
  app.get<{ Reply: HealthResponse }>('/api/health', async () => ({
    status: 'ok', service: 'phantom-api', version: SERVER_VERSION, simulation: true,
  }))
}
