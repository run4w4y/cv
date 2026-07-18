import type { BrowserWorker } from '@cloudflare/puppeteer'
import type {
  D1Database,
  KVNamespace,
  R2Bucket,
} from '@cloudflare/workers-types'

export type WorkerWorkflowStatus = {
  readonly error?: { readonly message: string; readonly name: string }
  readonly output?: unknown
  readonly status:
    | 'complete'
    | 'errored'
    | 'paused'
    | 'queued'
    | 'running'
    | 'terminated'
    | 'unknown'
    | 'waiting'
    | 'waitingForPause'
}

export type WorkerWorkflowInstance = {
  readonly id: string
  readonly status: () => Promise<WorkerWorkflowStatus>
}

export type WorkerWorkflow<Params> = {
  readonly create: (options: {
    readonly id?: string
    readonly params?: Params
  }) => Promise<WorkerWorkflowInstance>
  readonly get: (id: string) => Promise<WorkerWorkflowInstance>
}

export type WorkerFetcher = {
  readonly fetch: (request: Request) => Response | Promise<Response>
}

export type WorkerExecutionContext = {
  readonly waitUntil: (promise: Promise<unknown>) => void
}

export type ApplicationRegistryEnv = {
  readonly APPLICATION_REGISTRY_DB: D1Database
  readonly ASSETS?: WorkerFetcher
  readonly BROWSER?: BrowserWorker
  readonly CHATGPT_SESSIONS: KVNamespace
  readonly CV_OBJECTS: R2Bucket
  readonly CV_PDF_WORKFLOW?: WorkerWorkflow<unknown>
  readonly CHATGPT_SESSION_SECRET?: string
  readonly LISTING_CHECK_ARCHIVE_ENABLED?: string
  readonly LISTING_CHECK_BATCH_SIZE?: string
  readonly LISTING_CHECKS_ENABLED?: string
  readonly REGISTRY_API_TOKEN?: string
}

export type WorkerScheduledController = {
  readonly cron: string
  readonly scheduledTime: number
}
