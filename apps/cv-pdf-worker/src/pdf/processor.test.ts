import { describe, expect, test } from 'bun:test'
import type { Message } from '@cloudflare/workers-types'
import type { PdfGenerationRequested } from '@cv/application-registry-api-contract'
import type {
  ContentEntry,
  ContentRevision,
  CvLink,
  GeneratedArtifact,
} from '@cv/application-registry-entity'
import type { PdfArtifactJob } from '@cv/application-registry-service'
import { Effect, Layer } from 'effect'

import { PdfJobPermanentError, PdfJobTransientError } from './model'
import { consumePdfMessageEffect, retryDelaySeconds } from './consumer'
import { processPdfJobEffect, recordPdfJobFailureEffect } from './processor'
import {
  type PdfArtifactPersistenceShape,
  PdfArtifactPersistence,
  type PdfRendererShape,
  PdfRenderer,
} from './services'

const recordedAt = '2026-07-19T00:00:00.000Z'

const entry: ContentEntry = {
  applicationId: 'application-1',
  approvedRevisionId: 'revision-1',
  createdAt: recordedAt,
  headRevisionId: 'revision-1',
  id: 'entry-1',
  kind: 'cv',
  locale: 'en',
  state: 'approved',
  updatedAt: recordedAt,
  version: 3,
}

const revision: ContentRevision = {
  byteLength: 1_024,
  contentEntryId: entry.id,
  contractId: 'cv',
  contractVersion: '1',
  createdAt: recordedAt,
  factsReleaseId: null,
  id: 'revision-1',
  jobSnapshotId: null,
  mediaType: 'application/json',
  objectKey: 'content/revision-1',
  operationId: 'revision-operation-1',
  parentRevisionId: null,
  revisionNumber: 1,
  sha256: 'revision-sha',
  source: 'human',
}

const link: CvLink = {
  applicationId: entry.applicationId,
  contentEntryId: entry.id,
  createdAt: recordedAt,
  disabledAt: null,
  disabledReason: null,
  enabled: true,
  id: 'link-1',
  publicationVersion: 2,
  publishedRevisionId: revision.id,
  publicUrl: 'https://cv.example.test/c/public-token',
  token: 'public-token',
  updatedAt: recordedAt,
  version: 2,
}

const artifact: GeneratedArtifact = {
  byteLength: null,
  contentRevisionId: revision.id,
  createdAt: recordedAt,
  cvLinkId: link.id,
  errorCode: null,
  errorMessage: null,
  generatedAt: null,
  id: 'artifact-1',
  kind: 'pdf',
  mediaType: null,
  objectKey: null,
  publicationVersion: link.publicationVersion,
  qrTarget: link.publicUrl,
  rendererVersion: 'renderer-v1',
  requestId: 'pdf-request-1',
  sha256: null,
  status: 'pending',
  updatedAt: recordedAt,
}

const request: PdfGenerationRequested = {
  _tag: 'PdfGenerationRequested',
  applicationId: entry.applicationId,
  artifactId: artifact.id,
  entryId: entry.id,
  version: 1,
}

const job = (
  artifactOverrides: Partial<GeneratedArtifact> = {},
  linkOverrides: Partial<CvLink> = {}
): PdfArtifactJob => ({
  artifact: { ...artifact, ...artifactOverrides },
  entry,
  link: { ...link, ...linkOverrides },
  revision,
})

const unused = (operation: string): never => {
  throw new Error(`Unexpected ${operation} call.`)
}

const persistence = (
  overrides: Partial<PdfArtifactPersistenceShape> = {}
): PdfArtifactPersistenceShape => ({
  complete: () => unused('complete'),
  disable: () => unused('disable'),
  fail: () => unused('fail'),
  load: () => Effect.succeed(job()),
  ...overrides,
})

const renderer = (
  overrides: Partial<PdfRendererShape> = {}
): PdfRendererShape => ({
  render: () => unused('render'),
  ...overrides,
})

const run = <A, E>(
  effect: Effect.Effect<A, E, PdfArtifactPersistence | PdfRenderer>,
  persistenceService: PdfArtifactPersistenceShape,
  rendererService: PdfRendererShape
) =>
  effect.pipe(
    Effect.provide(
      Layer.merge(
        Layer.succeed(
          PdfArtifactPersistence,
          PdfArtifactPersistence.of(persistenceService)
        ),
        Layer.succeed(PdfRenderer, PdfRenderer.of(rendererService))
      )
    ),
    Effect.runPromise
  )

const queueMessage = (body: unknown, attempts = 1) => {
  let acknowledgements = 0
  const retryDelays: (number | undefined)[] = []
  const message: Message<unknown> = {
    ack: () => {
      acknowledgements += 1
    },
    attempts,
    body,
    id: 'queue-message-1',
    retry: (options) => {
      retryDelays.push(options?.delaySeconds)
    },
    timestamp: new Date(recordedAt),
  }

  return {
    acknowledgements: () => acknowledgements,
    message,
    retryDelays,
  }
}

describe('PDF Queue job processor', () => {
  test('renders the pinned public URL and completes the pending artifact', async () => {
    const renderedUrls: string[] = []
    const completions: Uint8Array[] = []
    const bytes = new Uint8Array([1, 2, 3])

    await run(
      processPdfJobEffect(request),
      persistence({
        complete: (_applicationId, _artifactId, completedBytes) => {
          completions.push(completedBytes)
          return Effect.succeed({
            ...artifact,
            byteLength: completedBytes.byteLength,
            generatedAt: recordedAt,
            mediaType: 'application/pdf',
            objectKey: 'artifacts/artifact-1.pdf',
            sha256: 'pdf-sha',
            status: 'ready',
          })
        },
      }),
      renderer({
        render: (publicUrl) => {
          renderedUrls.push(publicUrl)
          return Effect.succeed(bytes)
        },
      })
    )

    expect(renderedUrls).toEqual([link.publicUrl])
    expect(completions).toEqual([bytes])
  })

  test('acknowledges duplicate delivery of an already-ready artifact without rendering', async () => {
    let renderCalls = 0

    await run(
      processPdfJobEffect(request),
      persistence({ load: () => Effect.succeed(job({ status: 'ready' })) }),
      renderer({
        render: () => {
          renderCalls += 1
          return Effect.succeed(new Uint8Array())
        },
      })
    )

    expect(renderCalls).toBe(0)
  })

  test('rejects a stale publication as a typed permanent failure', async () => {
    const error = await run(
      processPdfJobEffect(request).pipe(Effect.flip),
      persistence({
        load: () =>
          Effect.succeed(
            job({}, { publicationVersion: link.publicationVersion + 1 })
          ),
      }),
      renderer()
    )

    expect(error).toBeInstanceOf(PdfJobPermanentError)
    expect(error).toMatchObject({
      _tag: 'PdfJobPermanentError',
      code: 'pdf_publication_changed',
    })
  })

  test('preserves typed transient render failures for Queue retry', async () => {
    const transient = new PdfJobTransientError({
      cause: new Error('Browser capacity unavailable.'),
      code: 'pdf_render_failed',
      message: 'Browser capacity unavailable.',
      retryAfterSeconds: 20,
    })

    const error = await run(
      processPdfJobEffect(request).pipe(Effect.flip),
      persistence(),
      renderer({ render: () => Effect.fail(transient) })
    )

    expect(error).toBe(transient)
  })

  test('records a permanent failure and disables only its pinned publication', async () => {
    const failures: string[][] = []
    const disabled: [number, string][] = []
    const permanent = new PdfJobPermanentError({
      cause: new Error('The CV exceeds one page.'),
      code: 'cv_page_overflow',
      message: 'The CV exceeds one page.',
      publicationReason: 'CV content exceeds one A4 page.',
    })

    await run(
      recordPdfJobFailureEffect(request, permanent),
      persistence({
        disable: (_request, version, reason) => {
          disabled.push([version, reason])
          return Effect.void
        },
        fail: (_applicationId, artifactId, code, message) => {
          failures.push([artifactId, code, message])
          return Effect.succeed({
            ...artifact,
            errorCode: code,
            errorMessage: message,
            status: 'failed',
          })
        },
      }),
      renderer()
    )

    expect(failures).toEqual([[artifact.id, permanent.code, permanent.message]])
    expect(disabled).toEqual([
      [artifact.publicationVersion, permanent.publicationReason],
    ])
  })
})

describe('PDF Queue message consumer', () => {
  test('acknowledges invalid versioned messages without touching persistence', async () => {
    const queued = queueMessage({ version: 99 })

    await run(
      consumePdfMessageEffect(queued.message, false),
      persistence(),
      renderer()
    )

    expect(queued.acknowledgements()).toBe(1)
    expect(queued.retryDelays).toEqual([])
  })

  test('retries typed transient failures with the requested delay', async () => {
    const queued = queueMessage(request, 2)
    const transient = new PdfJobTransientError({
      cause: new Error('Browser rate limited.'),
      code: 'pdf_render_failed',
      message: 'Browser rate limited.',
      retryAfterSeconds: 37,
    })

    await run(
      consumePdfMessageEffect(queued.message, false),
      persistence({ load: () => Effect.fail(transient) }),
      renderer()
    )

    expect(queued.acknowledgements()).toBe(0)
    expect(queued.retryDelays).toEqual([37])
    expect(retryDelaySeconds(5)).toBe(300)
  })

  test('turns dead-letter delivery into a durable terminal failure', async () => {
    const queued = queueMessage(request)
    const recordedCodes: string[] = []

    await run(
      consumePdfMessageEffect(queued.message, true),
      persistence({
        disable: () => Effect.void,
        fail: (_applicationId, _artifactId, errorCode, errorMessage) => {
          recordedCodes.push(errorCode)
          return Effect.succeed({
            ...artifact,
            errorCode,
            errorMessage,
            status: 'failed',
          })
        },
      }),
      renderer()
    )

    expect(recordedCodes).toEqual(['pdf_retry_exhausted'])
    expect(queued.acknowledgements()).toBe(1)
    expect(queued.retryDelays).toEqual([])
  })
})
