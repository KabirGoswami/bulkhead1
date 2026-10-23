import Fastify from 'fastify'
import cors from '@fastify/cors'
import { loadConfig, type ServerConfig } from './config.ts'
import { healthRoutes } from './routes/health.ts'
import { deviceRoutes } from './routes/devices.ts'
import { snapshotRoutes } from './routes/snapshot.ts'

// Construct independently of listen(), allowing injection tests and real HTTP tests.
export function buildApp(config: ServerConfig = loadConfig(), logging = true) {
  const app = Fastify({ logger: logging ? { level: config.logLevel } : false })
  app.register(cors, { origin: config.corsOrigins, methods: ['GET', 'HEAD'], credentials: false })
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('Cache-Control', 'no-store')
    return payload
  })
  app.register(healthRoutes)
  app.register(deviceRoutes)
  app.register(snapshotRoutes)
  return app
}
