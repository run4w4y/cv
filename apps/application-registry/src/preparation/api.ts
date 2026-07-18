import {
  type AppendContentRevisionRequest,
  ApplicationResponseSchema,
  ContentEntryResponseSchema,
  ContentRevisionResultResponseSchema,
  CvLinkResponseSchema,
  GeneratedArtifactResponseSchema,
  JobPostingSnapshotResponseSchema,
  OpaquePayloadResponseSchema,
  PdfWorkflowResponseSchema,
  ReadContentRevisionResponseSchema,
  ReadyPdfArtifactResponseSchema,
  type SetCvLinkAvailabilityRequest,
} from '@cv/application-registry-api-contract'
import type {
  ContentEntryKind,
  ContentRevisionSource,
} from '@cv/application-registry-entity'
import { FactsCatalogueV1Schema } from '@cv/contracts/facts'
import { Schema } from 'effect'

import {
  decodeJsonBase64,
  decodeUtf8Base64,
  encodeJsonBase64,
  encodeUtf8Base64,
} from './base64'

const OpaquePayloadSchema = OpaquePayloadResponseSchema

const ActiveFactsReleaseResponseSchema = Schema.Struct({
  channel: Schema.Struct({
    name: Schema.String,
    version: Schema.Number,
    activeReleaseId: Schema.optional(Schema.String),
  }),
  release: Schema.Struct({ id: Schema.String }),
  manifest: Schema.optional(OpaquePayloadSchema),
  catalogue: OpaquePayloadSchema,
  assets: Schema.optional(
    Schema.Array(
      Schema.Struct({
        assetId: Schema.optional(Schema.String),
        fileName: Schema.optional(Schema.String),
        data: Schema.String,
        mediaType: Schema.String,
      })
    )
  ),
})

type ActiveFactsReleaseResponse = Schema.Schema.Type<
  typeof ActiveFactsReleaseResponseSchema
>
export type JobPostingSnapshot = Schema.Schema.Type<
  typeof JobPostingSnapshotResponseSchema
>
type OpaquePayload = Schema.Schema.Type<typeof OpaquePayloadResponseSchema>
type Application = Schema.Schema.Type<typeof ApplicationResponseSchema>
export type ContentEntry = Schema.Schema.Type<typeof ContentEntryResponseSchema>
export type ContentRevisionResult = Schema.Schema.Type<
  typeof ContentRevisionResultResponseSchema
>
type ReadContentRevisionResponse = Schema.Schema.Type<
  typeof ReadContentRevisionResponseSchema
>
export type SavedContentRevision = ContentRevisionResult & {
  readonly value: unknown
}
export type CvLink = Schema.Schema.Type<typeof CvLinkResponseSchema>
export type GeneratedArtifact = Schema.Schema.Type<
  typeof GeneratedArtifactResponseSchema
>
export type PdfWorkflow = Schema.Schema.Type<typeof PdfWorkflowResponseSchema>

export class PreparationApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'PreparationApiError'
    this.status = status
  }
}

const errorMessage = (body: unknown, fallback: string): string => {
  if (typeof body !== 'object' || body === null) return fallback
  if ('message' in body && typeof body.message === 'string') {
    return body.message
  }
  return fallback
}

const responseBody = async (response: Response): Promise<unknown> => {
  const source = await response.text()
  if (source.length === 0) return null
  try {
    return JSON.parse(source)
  } catch {
    return source
  }
}

const requestJson = async <
  S extends Schema.Top & Schema.ConstraintDecoder<unknown>,
>(
  path: string,
  schema: S,
  init?: RequestInit
): Promise<S['Type']> => {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body === undefined
        ? {}
        : { 'content-type': 'application/json' }),
      ...init?.headers,
    },
  })
  const body = await responseBody(response)
  if (!response.ok) {
    throw new PreparationApiError(
      errorMessage(body, `Registry request failed (${response.status}).`),
      response.status
    )
  }
  return Schema.decodeUnknownPromise(schema)(body)
}

const applicationPath = (applicationId: string): string =>
  `/api/registry/v1/applications/${encodeURIComponent(applicationId)}`

const entryPath = (applicationId: string, entryId: string): string =>
  `${applicationPath(applicationId)}/content-entries/${encodeURIComponent(entryId)}`

const decodeOpaqueValue = (payload: OpaquePayload): unknown =>
  payload.mediaType.includes('json')
    ? decodeJsonBase64(payload.data)
    : decodeUtf8Base64(payload.data)

export type PreparationContext = {
  readonly factsCatalogue: Schema.Schema.Type<typeof FactsCatalogueV1Schema>
  readonly factsReleaseId: string
  readonly factsRelease: ActiveFactsReleaseResponse
  readonly jobContext: unknown
  readonly jobSnapshot: JobPostingSnapshot
  readonly locale: string
}

export const readActiveFacts = (locale: string) =>
  requestJson(
    `/api/registry/v1/facts-releases/active?locale=${encodeURIComponent(locale)}`,
    ActiveFactsReleaseResponseSchema
  )

export const readLatestJobSnapshot = (applicationId: string) =>
  requestJson(
    `${applicationPath(applicationId)}/job-snapshots/latest`,
    JobPostingSnapshotResponseSchema
  )

export const captureJobPostingSnapshot = (applicationId: string) =>
  requestJson(
    `${applicationPath(applicationId)}/job-snapshots/capture`,
    JobPostingSnapshotResponseSchema,
    { method: 'POST' }
  )

export const manualJobContextMaxBytes = 256 * 1_024
export const manualJobContextFetcherVersion =
  'application-registry-management-job-context/v1'

const readLatestJobSnapshotOrNull = async (
  applicationId: string
): Promise<JobPostingSnapshot | null> => {
  try {
    return await readLatestJobSnapshot(applicationId)
  } catch (cause) {
    if (cause instanceof PreparationApiError && cause.status === 404) {
      return null
    }
    throw cause
  }
}

export const persistManualJobContext = async (
  applicationId: string,
  value: string
): Promise<JobPostingSnapshot> => {
  const normalized = value.trim()
  if (normalized.length === 0) {
    throw new PreparationApiError('Job context cannot be empty.', 400)
  }
  if (
    new TextEncoder().encode(normalized).byteLength > manualJobContextMaxBytes
  ) {
    throw new PreparationApiError(
      `Job context must not exceed ${manualJobContextMaxBytes} UTF-8 bytes.`,
      400
    )
  }

  const [application, latest] = await Promise.all([
    readApplication(applicationId),
    readLatestJobSnapshotOrNull(applicationId),
  ])
  const requestedUrl = latest?.requestedUrl ?? application.canonicalUrl
  const finalUrl = latest?.finalUrl ?? application.canonicalUrl

  return requestJson(
    `${applicationPath(applicationId)}/job-snapshots`,
    JobPostingSnapshotResponseSchema,
    {
      method: 'POST',
      body: JSON.stringify({
        fetcherVersion: manualJobContextFetcherVersion,
        finalUrl,
        normalized: {
          data: encodeUtf8Base64(normalized),
          mediaType: 'text/plain; charset=utf-8',
        },
        requestedUrl,
        status: 'provided',
      }),
    }
  )
}

export const readOrCaptureLatestJobSnapshot = async (
  applicationId: string
): Promise<JobPostingSnapshot> => {
  try {
    return await readLatestJobSnapshot(applicationId)
  } catch (cause) {
    if (cause instanceof PreparationApiError && cause.status === 404) {
      return captureJobPostingSnapshot(applicationId)
    }
    throw cause
  }
}

export const readApplication = (applicationId: string) =>
  requestJson(applicationPath(applicationId), ApplicationResponseSchema)

const preparationStartMaxAttempts = 3

export const startApplicationPreparation = async (
  applicationId: string
): Promise<Application> => {
  let application = await readApplication(applicationId)
  if (application.applicationStatus !== 'not_started') return application

  for (let attempt = 1; attempt <= preparationStartMaxAttempts; attempt += 1) {
    try {
      const updated = await requestJson(
        applicationPath(applicationId),
        ApplicationResponseSchema,
        {
          method: 'PATCH',
          body: JSON.stringify({
            applicationStatus: 'preparing',
            expectedVersion: application.version,
          }),
        }
      )
      if (updated.applicationStatus === 'not_started') {
        throw new PreparationApiError(
          'The application remained not started after beginning preparation.',
          409
        )
      }
      return updated
    } catch (cause) {
      if (!(cause instanceof PreparationApiError) || cause.status !== 409) {
        throw cause
      }

      application = await readApplication(applicationId)
      if (application.applicationStatus !== 'not_started') return application
      if (attempt === preparationStartMaxAttempts) throw cause
    }
  }

  throw new PreparationApiError(
    'The application could not leave not-started state.',
    409
  )
}

export const readJobSnapshotPayload = (
  applicationId: string,
  snapshotId: string,
  kind: 'normalized' | 'raw'
) =>
  requestJson(
    `${applicationPath(applicationId)}/job-snapshots/${encodeURIComponent(snapshotId)}/payloads/${kind}`,
    OpaquePayloadResponseSchema
  )

export const loadPreparationContext = async (
  applicationId: string,
  locale: string
): Promise<PreparationContext> => {
  const [jobSnapshot, factsRelease] = await Promise.all([
    readOrCaptureLatestJobSnapshot(applicationId),
    readActiveFacts(locale),
  ])
  if (jobSnapshot.status === 'failed') {
    throw new PreparationApiError(
      jobSnapshot.errorMessage ?? 'The latest job snapshot failed.',
      409
    )
  }
  const jobPayloadKind =
    jobSnapshot.normalizedObjectKey !== null
      ? 'normalized'
      : jobSnapshot.rawObjectKey !== null
        ? 'raw'
        : null
  if (jobPayloadKind === null) {
    throw new PreparationApiError(
      'The latest job snapshot does not contain a readable payload.',
      409
    )
  }
  const jobPayload = await readJobSnapshotPayload(
    applicationId,
    jobSnapshot.id,
    jobPayloadKind
  )
  const factsCatalogue = await Schema.decodeUnknownPromise(
    FactsCatalogueV1Schema
  )(decodeOpaqueValue(factsRelease.catalogue))

  return {
    factsCatalogue,
    factsReleaseId: factsRelease.release.id,
    factsRelease,
    jobContext: decodeOpaqueValue(jobPayload),
    jobSnapshot,
    locale,
  }
}

export const ensureContentEntry = (
  applicationId: string,
  kind: ContentEntryKind,
  locale: string
) =>
  requestJson(
    `${applicationPath(applicationId)}/content-entries`,
    ContentEntryResponseSchema,
    {
      method: 'POST',
      body: JSON.stringify({ kind, locale }),
    }
  )

export type BuildRevisionRequestInput = {
  readonly contractId: string
  readonly contractVersion: string
  readonly entry: ContentEntry
  readonly factsReleaseId: string
  readonly jobSnapshotId: string
  readonly operationId: string
  readonly source: ContentRevisionSource
  readonly value: unknown
}

export const buildAppendRevisionRequest = (
  input: BuildRevisionRequestInput
): AppendContentRevisionRequest => ({
  contractId: input.contractId,
  contractVersion: input.contractVersion,
  expectedVersion: input.entry.version,
  factsReleaseId: input.factsReleaseId,
  jobSnapshotId: input.jobSnapshotId,
  operationId: input.operationId,
  payload: {
    data: encodeJsonBase64(input.value),
    mediaType: 'application/json',
  },
  source: input.source,
})

export const appendContentRevision = (
  applicationId: string,
  entry: ContentEntry,
  request: AppendContentRevisionRequest
) =>
  requestJson(
    `${entryPath(applicationId, entry.id)}/revisions`,
    ContentRevisionResultResponseSchema,
    { method: 'POST', body: JSON.stringify(request) }
  )

export const readContentRevision = async (
  applicationId: string,
  entryId: string,
  revisionId: string
): Promise<SavedContentRevision> => {
  const result: ReadContentRevisionResponse = await requestJson(
    `${entryPath(applicationId, entryId)}/revisions/${encodeURIComponent(revisionId)}`,
    ReadContentRevisionResponseSchema
  )
  return {
    entry: result.entry,
    revision: result.revision,
    value: decodeOpaqueValue(result.payload),
  }
}

export const readContentHead = (
  applicationId: string,
  entry: ContentEntry
): Promise<SavedContentRevision | null> =>
  entry.headRevisionId === null
    ? Promise.resolve(null)
    : readContentRevision(applicationId, entry.id, entry.headRevisionId)

export const approveContentRevision = (
  applicationId: string,
  result: ContentRevisionResult
) =>
  requestJson(
    `${entryPath(applicationId, result.entry.id)}/approval`,
    ContentRevisionResultResponseSchema,
    {
      method: 'POST',
      body: JSON.stringify({
        expectedVersion: result.entry.version,
        revisionId: result.revision.id,
      }),
    }
  )

export const publishCv = (
  applicationId: string,
  result: ContentRevisionResult,
  publicBaseUrl: string
) =>
  requestJson(
    `${entryPath(applicationId, result.entry.id)}/publication`,
    CvLinkResponseSchema,
    {
      method: 'POST',
      body: JSON.stringify({
        expectedContentVersion: result.entry.version,
        publicBaseUrl,
      }),
    }
  )

export const readCvLink = (applicationId: string, entryId: string) =>
  requestJson(
    `${entryPath(applicationId, entryId)}/publication`,
    CvLinkResponseSchema
  )

export const setCvLinkAvailability = (
  applicationId: string,
  entryId: string,
  input: SetCvLinkAvailabilityRequest
) =>
  requestJson(
    `${entryPath(applicationId, entryId)}/publication/availability`,
    CvLinkResponseSchema,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    }
  )

export const startPdfWorkflow = (
  applicationId: string,
  entryId: string,
  expectedPublicationVersion: number,
  rendererVersion: string
) =>
  requestJson(
    `${entryPath(applicationId, entryId)}/pdf-workflow`,
    PdfWorkflowResponseSchema,
    {
      method: 'POST',
      body: JSON.stringify({
        expectedPublicationVersion,
        rendererVersion,
      }),
    }
  )

export const readPdfWorkflow = (
  applicationId: string,
  entryId: string,
  workflowId: string
) =>
  requestJson(
    `${entryPath(applicationId, entryId)}/pdf-workflow/${encodeURIComponent(workflowId)}`,
    PdfWorkflowResponseSchema
  )

export type WaitForPdfWorkflowOptions = {
  readonly intervalMs?: number
  readonly maxAttempts?: number
  readonly sleep?: (durationMs: number) => Promise<void>
}

const defaultSleep = (durationMs: number) =>
  new Promise<void>((resolve) => globalThis.setTimeout(resolve, durationMs))

export const waitForPdfWorkflow = async (
  applicationId: string,
  entryId: string,
  initial: PdfWorkflow,
  options: WaitForPdfWorkflowOptions = {}
): Promise<PdfWorkflow> => {
  const intervalMs = options.intervalMs ?? 1_500
  const maxAttempts = options.maxAttempts ?? 320
  const sleep = options.sleep ?? defaultSleep
  let current = initial

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (current.status === 'complete') {
      if (current.artifactId === null) {
        throw new PreparationApiError(
          'PDF Workflow completed without a ready artifact.',
          502
        )
      }
      return current
    }
    if (current.status === 'errored' || current.status === 'terminated') {
      throw new PreparationApiError(
        current.errorMessage ?? `PDF Workflow ${current.status}.`,
        502
      )
    }

    await sleep(intervalMs)
    current = await readPdfWorkflow(applicationId, entryId, current.workflowId)
  }

  throw new PreparationApiError(
    'PDF generation is still running. Publishing can be resumed safely.',
    504
  )
}

export const readCurrentPdf = (
  applicationId: string,
  entryId: string,
  rendererVersion?: string
) => {
  const path = `${entryPath(applicationId, entryId)}/pdf-artifacts/current/content`
  const read = (version?: string) =>
    requestJson(
      version ? `${path}?rendererVersion=${encodeURIComponent(version)}` : path,
      ReadyPdfArtifactResponseSchema
    )
  return rendererVersion
    ? read(rendererVersion).catch((cause) =>
        cause instanceof PreparationApiError && cause.status === 404
          ? read()
          : Promise.reject(cause)
      )
    : read()
}

export const readCurrentPdfArtifact = (
  applicationId: string,
  entryId: string,
  rendererVersion?: string
) => {
  const path = `${entryPath(applicationId, entryId)}/pdf-artifacts/current`
  const read = (version?: string) =>
    requestJson(
      version ? `${path}?rendererVersion=${encodeURIComponent(version)}` : path,
      GeneratedArtifactResponseSchema
    )
  return rendererVersion
    ? read(rendererVersion).catch((cause) =>
        cause instanceof PreparationApiError && cause.status === 404
          ? read()
          : Promise.reject(cause)
      )
    : read()
}

export type PublishedCvState = {
  readonly artifact: GeneratedArtifact
  readonly link: CvLink
}

export const readPublishedCvState = async (
  applicationId: string,
  entryId: string,
  rendererVersion?: string
): Promise<PublishedCvState | null> => {
  try {
    const [link, artifact] = await Promise.all([
      readCvLink(applicationId, entryId),
      readCurrentPdfArtifact(applicationId, entryId, rendererVersion),
    ])
    return artifact.status === 'ready' &&
      artifact.cvLinkId === link.id &&
      artifact.publicationVersion === link.publicationVersion &&
      artifact.qrTarget === link.publicUrl
      ? { artifact, link }
      : null
  } catch (cause) {
    if (cause instanceof PreparationApiError && cause.status === 404) {
      return null
    }
    throw cause
  }
}

export const publicCvBaseUrl = (): string => {
  const configured = import.meta.env.VITE_CV_PUBLIC_BASE_URL
  const value =
    typeof configured === 'string' && configured.trim().length > 0
      ? configured
      : `${window.location.origin}/c`
  return value.replace(/\/+$/u, '')
}
