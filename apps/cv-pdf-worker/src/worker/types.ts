import type { BrowserWorker } from '@cloudflare/puppeteer'
import type { D1Database, R2Bucket } from '@cloudflare/workers-types'

export type PdfWorkerEnv = {
  readonly APPLICATION_REGISTRY_DB: D1Database
  readonly BROWSER: BrowserWorker
  readonly CV_OBJECTS: R2Bucket
  readonly CV_PDF_DLQ_NAME: string
}
