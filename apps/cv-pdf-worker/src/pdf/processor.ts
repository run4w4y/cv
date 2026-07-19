import type { PdfGenerationRequested } from '@cv/application-registry-api-contract'
import type { PdfArtifactJob } from '@cv/application-registry-service'
import { Effect } from 'effect'

import { PdfJobPermanentError } from './model'
import { PdfArtifactPersistence, PdfRenderer } from './services'

const publicationChanged = (message: string) =>
  new PdfJobPermanentError({
    cause: new Error(message),
    code: 'pdf_publication_changed',
    message,
    publicationReason: 'The public CV changed before its PDF was completed.',
  })

const validatePendingJob = Effect.fn('PdfJob.validatePending')(function* (
  request: PdfGenerationRequested,
  job: PdfArtifactJob
) {
  const { artifact, entry, link, revision } = job
  if (
    artifact.id !== request.artifactId ||
    entry.id !== request.entryId ||
    entry.applicationId !== request.applicationId ||
    revision.id !== artifact.contentRevisionId ||
    revision.contentEntryId !== entry.id
  ) {
    return yield* publicationChanged(
      'The queued PDF job does not match its persisted application and content revision.'
    )
  }
  if (
    !link.enabled ||
    link.id !== artifact.cvLinkId ||
    link.applicationId !== request.applicationId ||
    link.contentEntryId !== request.entryId ||
    link.publishedRevisionId !== artifact.contentRevisionId ||
    link.publicationVersion !== artifact.publicationVersion ||
    link.publicUrl !== artifact.qrTarget ||
    entry.approvedRevisionId !== artifact.contentRevisionId
  ) {
    return yield* publicationChanged(
      'The public CV publication no longer matches the pending PDF job.'
    )
  }
})

export const processPdfJobEffect = Effect.fn('PdfJob.process')(function* (
  request: PdfGenerationRequested
) {
  const persistence = yield* PdfArtifactPersistence
  const renderer = yield* PdfRenderer
  const job = yield* persistence.load(request)

  if (job.artifact.status === 'ready') return
  if (job.artifact.status === 'failed') {
    yield* persistence.disable(
      request,
      job.artifact.publicationVersion,
      'PDF generation did not complete.'
    )
    return
  }

  yield* validatePendingJob(request, job)
  const bytes = yield* renderer.render(job.artifact.qrTarget)
  const ready = yield* persistence.complete(
    request.applicationId,
    request.artifactId,
    bytes
  )
  if (
    ready.status !== 'ready' ||
    ready.publicationVersion !== job.artifact.publicationVersion ||
    ready.qrTarget !== job.artifact.qrTarget ||
    ready.contentRevisionId !== job.artifact.contentRevisionId
  ) {
    return yield* publicationChanged(
      'The completed PDF artifact does not match the queued publication identity.'
    )
  }
})

export const recordPdfJobFailureEffect = Effect.fn(
  'PdfJob.recordPermanentFailure'
)(function* (request: PdfGenerationRequested, error: PdfJobPermanentError) {
  const persistence = yield* PdfArtifactPersistence
  const failed = yield* persistence.fail(
    request.applicationId,
    request.artifactId,
    error.code,
    error.message
  )
  yield* persistence.disable(
    request,
    failed.publicationVersion,
    error.publicationReason
  )
})

export const retryExhaustedError = () =>
  new PdfJobPermanentError({
    cause: new Error('PDF generation exhausted its Queue retry budget.'),
    code: 'pdf_retry_exhausted',
    message:
      'PDF generation did not complete before its Queue retries expired.',
    publicationReason: 'PDF generation did not complete.',
  })
