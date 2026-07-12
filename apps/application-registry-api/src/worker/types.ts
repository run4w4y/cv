import type { D1Database } from '@cloudflare/workers-types'

export type WorkerExecutionContext = {
  readonly waitUntil: (promise: Promise<unknown>) => void
}

export type ApplicationRegistryEnv = {
  readonly APPLICATION_REGISTRY_DB: D1Database
  readonly REGISTRY_API_TOKEN?: string
}
