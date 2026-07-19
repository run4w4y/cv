import type {
  D1Database,
  KVNamespace,
  Queue,
  R2Bucket,
} from '@cloudflare/workers-types'
import type { PdfGenerationRequested } from '@cv/application-registry-api-contract'

export type WorkerFetcher = {
  readonly fetch: (request: Request) => Response | Promise<Response>
}

export type WorkerExecutionContext = {
  readonly waitUntil: (promise: Promise<unknown>) => void
}

export type ApplicationRegistryEnv = {
  readonly APPLICATION_REGISTRY_DB: D1Database
  readonly ASSETS?: WorkerFetcher
  readonly CHATGPT_SESSIONS: KVNamespace
  readonly CV_OBJECTS: R2Bucket
  readonly CV_PDF_QUEUE?: Queue<PdfGenerationRequested>
  readonly CHATGPT_SESSION_SECRET?: string
  readonly CLOUDFLARE_ANALYTICS_API_TOKEN: string
  readonly CLOUDFLARE_GRAPHQL_ENDPOINT?: string
  readonly CLOUDFLARE_ZONE_ID: string
  readonly CV_WEB_HOST: string
  readonly LISTING_CHECK_ARCHIVE_ENABLED?: string
  readonly LISTING_CHECK_BATCH_SIZE?: string
  readonly LISTING_CHECKS_ENABLED?: string
  readonly REGISTRY_API_TOKEN?: string
}

export type WorkerScheduledController = {
  readonly cron: string
  readonly scheduledTime: number
}
