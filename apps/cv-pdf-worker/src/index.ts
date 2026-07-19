import type { MessageBatch } from '@cloudflare/workers-types'

import { runPdfQueue } from './pdf/consumer'
import type { PdfWorkerEnv } from './worker/types'

export default {
  fetch: () => new Response('Not Found', { status: 404 }),
  queue: (batch: MessageBatch<unknown>, environment: PdfWorkerEnv) =>
    runPdfQueue(environment, batch),
}
