import { cvPreviewUrl } from '@cv/application-registry-api-contract'
import type { PdfGenerationTriggerEvent } from '@cv/application-registry-events'
import type { PdfGenerationAttempt } from '@cv/application-registry-service'
import { Effect } from 'effect'

import { PdfGenerationPermanentError } from './model'
import { PdfArtifactPersistence, PdfRenderer } from './ports'

const publicationChanged = (message: string) =>
  new PdfGenerationPermanentError({
    cause: new Error(message),
    code: 'pdf_publication_changed',
    message,
  })

const validatePendingAttempt = Effect.fn(
  'PdfGeneration.validatePendingAttempt'
)(function* (
  request: PdfGenerationTriggerEvent,
  attempt: PdfGenerationAttempt
) {
  const { artifact, entry, link, revision } = attempt
  if (
    artifact.requestId !== request.eventId ||
    artifact.cvLinkId !== request.cvLinkId ||
    artifact.contentRevisionId !== request.contentRevisionId ||
    artifact.publicationVersion !== request.publicationVersion ||
    entry.id !== request.contentEntryId ||
    entry.applicationId !== request.applicationId ||
    revision.id !== artifact.contentRevisionId ||
    revision.contentEntryId !== entry.id
  ) {
    return yield* publicationChanged(
      'The PDF event does not match its persisted application and content revision.'
    )
  }
  if (
    link.id !== artifact.cvLinkId ||
    link.applicationId !== request.applicationId ||
    link.contentEntryId !== request.contentEntryId ||
    !link.enabled ||
    link.currentRevisionId !== artifact.contentRevisionId ||
    link.publicationVersion !== artifact.publicationVersion ||
    link.publicUrl !== artifact.qrTarget ||
    entry.approvedRevisionId !== artifact.contentRevisionId
  ) {
    return yield* publicationChanged(
      'The public CV publication no longer matches the pending PDF generation attempt.'
    )
  }
})

export const processPdfEvent = Effect.fn('PdfGeneration.processEvent')(
  function* (request: PdfGenerationTriggerEvent) {
    const persistence = yield* PdfArtifactPersistence
    const renderer = yield* PdfRenderer
    const attempt = yield* persistence.ensure(request)

    if (attempt.artifact.status === 'ready') return
    if (attempt.artifact.status === 'failed') return

    yield* validatePendingAttempt(request, attempt)
    const rendered = yield* renderer.render(cvPreviewUrl(attempt.link))
    const ready = yield* persistence.complete(
      request.applicationId,
      attempt.artifact.id,
      rendered.rendererVersion,
      rendered.bytes
    )
    if (
      ready.status !== 'ready' ||
      ready.publicationVersion !== attempt.artifact.publicationVersion ||
      ready.qrTarget !== attempt.artifact.qrTarget ||
      ready.contentRevisionId !== attempt.artifact.contentRevisionId
    ) {
      return yield* publicationChanged(
        'The completed PDF artifact does not match the event publication identity.'
      )
    }
  }
)

export const recordPdfGenerationFailure = Effect.fn(
  'PdfGeneration.recordPermanentFailure'
)(function* (
  request: PdfGenerationTriggerEvent,
  error: PdfGenerationPermanentError
) {
  const persistence = yield* PdfArtifactPersistence
  const attempt = yield* persistence.ensure(request)
  yield* persistence.fail(
    request.applicationId,
    attempt.artifact.id,
    error.code,
    error.message
  )
})

export const retryExhaustedError = () =>
  new PdfGenerationPermanentError({
    cause: new Error(
      'PDF generation exhausted its event-delivery retry budget.'
    ),
    code: 'pdf_retry_exhausted',
    message:
      'PDF generation did not complete before its event-delivery retries expired.',
  })
