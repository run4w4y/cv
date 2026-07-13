import type { D1Database } from '@cloudflare/workers-types'

export type WorkerExecutionContext = {
  readonly waitUntil: (promise: Promise<unknown>) => void
}

export type ApplicationRegistryEnv = {
  readonly APPLICATION_REGISTRY_DB: D1Database
  readonly LISTING_CHECK_ARCHIVE_ENABLED?: string
  readonly LISTING_CHECK_BATCH_SIZE?: string
  readonly LISTING_CHECKS_ENABLED?: string
  readonly REGISTRY_API_TOKEN?: string
}

export type WorkerScheduledController = {
  readonly cron: string
  readonly scheduledTime: number
}
