export interface ServerConfig {
  host: string
  port: number
  corsOrigins: string[]
  logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent'
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const portText = env.SERVER_PORT ?? env.PORT ?? '3001'
  const port = Number(portText)
  if (!/^\d+$/.test(portText) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SERVER_PORT (or PORT) must be an integer from 1 to 65535')
  }
  const host = (env.SERVER_HOST ?? '127.0.0.1').trim()
  if (!host) throw new Error('SERVER_HOST cannot be empty')
  const corsOrigins = (env.CORS_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',').map(origin => origin.trim()).filter(Boolean)
  if (!corsOrigins.length) throw new Error('CORS_ORIGINS must contain at least one HTTP(S) origin')
  for (const origin of corsOrigins) {
    let url: URL
    try { url = new URL(origin) } catch { throw new Error(`Invalid CORS origin: ${origin}`) }
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
      throw new Error(`CORS_ORIGINS entries must be exact HTTP(S) origins without paths: ${origin}`)
    }
  }
  const logLevel = env.LOG_LEVEL ?? 'info'
  if (!['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'].includes(logLevel)) {
    throw new Error('LOG_LEVEL is invalid')
  }
  return { host, port, corsOrigins: [...new Set(corsOrigins)], logLevel: logLevel as ServerConfig['logLevel'] }
}
