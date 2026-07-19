import { Context } from 'effect'

import type { PdfWorkerEnv } from './types'

const missingWorkerBinding = (): never => {
  throw new Error('PdfWorkerEnv was not provided to the PDF worker runtime.')
}

export const WorkerEnv = Context.Reference<PdfWorkerEnv>('CvPdfWorkerEnv', {
  defaultValue: missingWorkerBinding,
})
