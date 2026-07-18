import {
  ApplicationRegistryApi,
  BadRequestError,
  ConflictError,
  InternalServerError,
  NotFoundError,
  ServiceUnavailableError,
} from '@cv/application-registry-api-contract'
import {
  AnnotationsService,
  type ApplicationRegistryError,
  ApplicationsService,
  applicationRejectedDisableReason,
  CapturesService,
  CompensationsService,
  ContentEntriesService,
  CvPublicationsService,
  EventsService,
  FactsReleasesService,
  JobPostingSnapshotsService,
  ListingChecksService,
  OpaqueObjectsService,
  PdfArtifactsService,
} from '@cv/application-registry-service'
import { Effect, Match } from 'effect'
import { HttpApiBuilder } from 'effect/unstable/httpapi'
import { prepareJobPostingCapture } from '../../job-posting/capture'
import {
  getPdfWorkflow,
  PdfWorkflowConfigurationError,
  PdfWorkflowStartError,
  startPdfWorkflow,
} from '../../pdf/trigger'
import { WorkerEnv } from '../../worker/bindings'
import {
  decodeBase64,
  decodeOpaquePayload,
  encodeBase64,
} from '../opaque-payload'

const toApiError = Match.type<ApplicationRegistryError>().pipe(
  Match.tag('RegistryBadRequestError', (error) =>
    BadRequestError.make({ message: error.message })
  ),
  Match.tag('RegistryNotFoundError', (error) =>
    NotFoundError.make({ message: error.message })
  ),
  Match.tag('RegistryConflictError', (error) =>
    ConflictError.make({ message: error.message })
  ),
  Match.tag('RegistryQueryTooComplexError', (error) =>
    BadRequestError.make({ message: error.message })
  ),
  Match.tag('RegistryDatabaseError', (error) =>
    InternalServerError.make({ message: error.message })
  ),
  Match.tag('RegistryArtifactError', (error) =>
    InternalServerError.make({ message: error.message })
  ),
  Match.tag('FactsReleaseObjectNotFoundError', (error) =>
    BadRequestError.make({ message: error.message })
  ),
  Match.tag('FactsReleaseObjectMetadataError', (error) =>
    BadRequestError.make({ message: error.message })
  ),
  Match.exhaustive
)

const expose = <A>(effect: Effect.Effect<A, ApplicationRegistryError>) =>
  effect.pipe(Effect.mapError(toApiError))

const exposePdfWorkflow = <A>(operation: () => Promise<A>) =>
  Effect.tryPromise({
    try: operation,
    catch: (error) => {
      if (error instanceof PdfWorkflowConfigurationError) {
        return ServiceUnavailableError.make({ message: error.message })
      }
      if (error instanceof PdfWorkflowStartError) {
        return ConflictError.make({ message: error.message })
      }
      return InternalServerError.make({
        message:
          error instanceof Error ? error.message : 'PDF Workflow failed.',
      })
    },
  })

const syncCvLinksForStatus = (
  cvPublications: CvPublicationsService,
  applicationId: string,
  nextStatus: string
) =>
  (nextStatus === 'rejected'
    ? cvPublications.disableForApplication(
        applicationId,
        applicationRejectedDisableReason
      )
    : cvPublications.restoreAfterRejection(applicationId)
  ).pipe(
    Effect.asVoid,
    // The application transition has already committed. Public resolution
    // independently reconciles this derived link state and fails closed for a
    // rejected application, so a transient repair failure must not turn a
    // successful status update into a stale-version retry trap.
    Effect.catch((error) => Effect.logWarning(error.message))
  )

export const RegistryHandlersLayer = HttpApiBuilder.group(
  ApplicationRegistryApi,
  'registry',
  (handlers) =>
    Effect.gen(function* () {
      const annotations = yield* AnnotationsService
      const applications = yield* ApplicationsService
      const captures = yield* CapturesService
      const compensations = yield* CompensationsService
      const contentEntries = yield* ContentEntriesService
      const cvPublications = yield* CvPublicationsService
      const events = yield* EventsService
      const factsReleases = yield* FactsReleasesService
      const jobSnapshots = yield* JobPostingSnapshotsService
      const listingChecks = yield* ListingChecksService
      const opaqueObjects = yield* OpaqueObjectsService
      const pdfArtifacts = yield* PdfArtifactsService

      return handlers
        .handle('createApplication', ({ payload }) =>
          expose(applications.create(payload))
        )
        .handle('upsertApplication', ({ payload }) =>
          expose(applications.upsert(payload))
        )
        .handle('createCapture', ({ payload }) =>
          expose(captures.capture(payload))
        )
        .handle('listApplications', ({ query }) =>
          expose(applications.list(query))
        )
        .handle('listApplicationFacets', () => expose(applications.facets()))
        .handle('getApplication', ({ params }) =>
          expose(applications.find(params.id))
        )
        .handle('patchApplication', ({ params, payload }) =>
          expose(
            Effect.gen(function* () {
              const updated = yield* applications.patch(params.id, payload)
              yield* syncCvLinksForStatus(
                cvPublications,
                updated.id,
                updated.applicationStatus
              )
              return updated
            })
          )
        )
        .handle('updateManagedApplication', ({ params, payload }) =>
          expose(
            Effect.gen(function* () {
              const updated = yield* applications.updateManaged(
                params.id,
                payload
              )
              yield* syncCvLinksForStatus(
                cvPublications,
                updated.application.id,
                updated.application.applicationStatus
              )
              return updated
            })
          )
        )
        .handle('deleteApplication', ({ params, query }) =>
          expose(applications.remove(params.id, query.expectedVersion))
        )
        .handle('listApplicationCaptures', ({ params }) =>
          expose(captures.listByApplication(params.id))
        )
        .handle('listApplicationCompensations', ({ params, query }) =>
          expose(compensations.listByApplication(params.id, query.currency))
        )
        .handle('replaceAnnualCompensation', ({ params, payload }) =>
          expose(compensations.replaceAnnual(params.id, payload))
        )
        .handle('listApplicationEvents', ({ params }) =>
          expose(events.listByApplication(params.id))
        )
        .handle('appendApplicationEvent', ({ params, payload }) =>
          expose(
            Effect.gen(function* () {
              const result = yield* events.append(params.id, payload)
              yield* syncCvLinksForStatus(
                cvPublications,
                result.application.id,
                result.application.applicationStatus
              )
              return result
            })
          )
        )
        .handle('listApplicationAnnotations', ({ params }) =>
          expose(annotations.list(params.id))
        )
        .handle('listApplicationLabels', ({ params }) =>
          expose(annotations.list(params.id)).pipe(
            Effect.map(({ labels }) => ({ items: labels }))
          )
        )
        .handle('replaceApplicationLabels', ({ params, payload }) =>
          expose(
            applications.replaceLabels(
              params.id,
              payload.labels,
              payload.expectedVersion
            )
          )
        )
        .handle('addApplicationNote', ({ params, payload }) =>
          expose(annotations.addNote(params.id, payload))
        )
        .handle('listEvents', ({ query }) => expose(events.list(query)))
        .handle('listApplicationListingChecks', ({ params }) =>
          expose(listingChecks.listByApplication(params.id))
        )
        .handle(
          'resolveApplicationListingAvailability',
          ({ params, payload }) =>
            expose(listingChecks.resolveAvailability(params.id, payload))
        )
        .handle('submitListingCheckFindings', ({ payload }) =>
          expose(listingChecks.submitFindings(payload))
        )
        .handle('getListingCheckRun', ({ params }) =>
          expose(listingChecks.findRun(params.id))
        )
        .handle('putOpaqueObject', ({ payload }) =>
          expose(
            decodeBase64(payload.data).pipe(
              Effect.flatMap((bytes) => opaqueObjects.put(bytes))
            )
          )
        )
        .handle('registerFactsRelease', ({ payload }) =>
          expose(factsReleases.register(payload))
        )
        .handle('getFactsRelease', ({ params }) =>
          expose(factsReleases.find(params.releaseId))
        )
        .handle('activateFactsRelease', ({ params, payload }) =>
          expose(
            factsReleases.activate(
              params.channel,
              payload.releaseId,
              payload.expectedVersion
            )
          )
        )
        .handle('getActiveFactsRelease', ({ query }) =>
          expose(
            factsReleases.readActive(
              query.channel ?? 'production',
              query.locale
            )
          ).pipe(
            Effect.map((active) => ({
              assets: active.assetContents.map(({ asset, bytes }) => ({
                assetId: asset.assetId,
                data: encodeBase64(bytes),
                fileName: asset.fileName,
                mediaType: asset.mediaType,
                sha256: asset.sha256,
              })),
              catalogue: {
                data: encodeBase64(active.catalogBytes),
                locale: 'en' as const,
                mediaType: active.catalog.mediaType,
                sha256: active.catalog.sha256,
              },
              channel: active.channel,
              release: active.release,
            }))
          )
        )
        .handle('persistJobPostingSnapshot', ({ params, payload }) =>
          expose(
            Effect.gen(function* () {
              const [raw, normalized] = yield* Effect.all([
                payload.raw
                  ? decodeOpaquePayload(payload.raw)
                  : Effect.succeed(payload.raw),
                payload.normalized
                  ? decodeOpaquePayload(payload.normalized)
                  : Effect.succeed(payload.normalized),
              ])

              return yield* jobSnapshots.persist(
                params.id,
                payload.status === 'failed'
                  ? {
                      ...payload,
                      normalized,
                      raw,
                    }
                  : {
                      ...payload,
                      normalized,
                      raw,
                    }
              )
            })
          )
        )
        .handle('captureJobPostingSnapshot', ({ params }) =>
          expose(
            Effect.gen(function* () {
              const application = yield* applications.find(params.id)
              const capture = yield* prepareJobPostingCapture(
                application.canonicalUrl
              )
              return yield* jobSnapshots.persist(application.id, capture)
            })
          )
        )
        .handle('getLatestJobPostingSnapshot', ({ params }) =>
          expose(jobSnapshots.latest(params.id))
        )
        .handle('getJobPostingSnapshot', ({ params }) =>
          expose(jobSnapshots.find(params.id, params.snapshotId))
        )
        .handle('getJobPostingSnapshotPayload', ({ params }) =>
          expose(
            Effect.gen(function* () {
              const snapshot = yield* jobSnapshots.find(
                params.id,
                params.snapshotId
              )
              const bytes = yield* jobSnapshots.readPayload(
                params.id,
                params.snapshotId,
                params.kind
              )
              const mediaType =
                params.kind === 'raw'
                  ? snapshot.rawMediaType
                  : snapshot.normalizedMediaType
              return {
                data: encodeBase64(bytes),
                mediaType: mediaType ?? 'application/octet-stream',
              }
            })
          )
        )
        .handle('ensureContentEntry', ({ params, payload }) =>
          expose(contentEntries.ensure(params.id, payload))
        )
        .handle('getContentEntry', ({ params }) =>
          expose(contentEntries.find(params.id, params.entryId))
        )
        .handle('listContentRevisions', ({ params }) =>
          expose(contentEntries.listRevisions(params.id, params.entryId)).pipe(
            Effect.map((items) => ({ items }))
          )
        )
        .handle('appendContentRevision', ({ params, payload }) =>
          expose(
            decodeOpaquePayload(payload.payload).pipe(
              Effect.flatMap((decoded) =>
                contentEntries.appendRevision(params.id, params.entryId, {
                  ...payload,
                  payload: decoded,
                })
              )
            )
          )
        )
        .handle('readContentRevision', ({ params }) =>
          expose(
            contentEntries
              .readRevision(params.id, params.entryId, params.revisionId)
              .pipe(
                Effect.map(({ bytes, entry, revision }) => ({
                  entry,
                  payload: {
                    data: encodeBase64(bytes),
                    mediaType: revision.mediaType,
                  },
                  revision,
                }))
              )
          )
        )
        .handle('approveContentRevision', ({ params, payload }) =>
          expose(
            contentEntries.approveRevision(params.id, params.entryId, payload)
          )
        )
        .handle('publishCv', ({ params, payload }) =>
          expose(cvPublications.publish(params.id, params.entryId, payload))
        )
        .handle('getCvLink', ({ params }) =>
          expose(cvPublications.findByEntry(params.id, params.entryId))
        )
        .handle('setCvLinkAvailability', ({ params, payload }) =>
          expose(
            cvPublications.setAvailability(params.id, params.entryId, payload)
          )
        )
        .handle('disableApplicationCvLinks', ({ params, payload }) =>
          expose(
            cvPublications.disableForApplication(params.id, payload.reason)
          ).pipe(Effect.map((count) => ({ count })))
        )
        .handle('beginPdfArtifact', ({ params, payload }) =>
          expose(pdfArtifacts.begin(params.id, params.entryId, payload))
        )
        .handle('completePdfArtifact', ({ params, payload }) =>
          expose(
            decodeBase64(payload.data).pipe(
              Effect.flatMap((bytes) =>
                pdfArtifacts.complete(params.id, params.artifactId, bytes)
              )
            )
          )
        )
        .handle('failPdfArtifact', ({ params, payload }) =>
          expose(
            pdfArtifacts.fail(
              params.id,
              params.artifactId,
              payload.errorCode,
              payload.errorMessage
            )
          )
        )
        .handle('getCurrentPdfArtifact', ({ params, query }) =>
          expose(
            pdfArtifacts.findCurrent(
              params.id,
              params.entryId,
              query.rendererVersion
            )
          )
        )
        .handle('readCurrentPdfArtifact', ({ params, query }) =>
          expose(
            pdfArtifacts
              .readCurrent(params.id, params.entryId, query.rendererVersion)
              .pipe(
                Effect.map(({ artifact, bytes }) => ({
                  artifact,
                  payload: {
                    data: encodeBase64(bytes),
                    mediaType: artifact.mediaType ?? 'application/pdf',
                  },
                }))
              )
          )
        )
        .handle('startPdfWorkflow', ({ params, payload }) =>
          expose(cvPublications.findByEntry(params.id, params.entryId)).pipe(
            Effect.flatMap((publication) =>
              WorkerEnv.pipe(
                Effect.flatMap((workerEnv) =>
                  exposePdfWorkflow(() =>
                    startPdfWorkflow(workerEnv, {
                      applicationId: publication.applicationId,
                      entryId: publication.contentEntryId,
                      expectedPublicationVersion:
                        payload.expectedPublicationVersion,
                      publication,
                      rendererVersion: payload.rendererVersion,
                    })
                  )
                )
              )
            )
          )
        )
        .handle('getPdfWorkflow', ({ params }) =>
          expose(contentEntries.find(params.id, params.entryId)).pipe(
            Effect.flatMap(() =>
              WorkerEnv.pipe(
                Effect.flatMap((workerEnv) =>
                  exposePdfWorkflow(() =>
                    getPdfWorkflow(workerEnv, params.workflowId)
                  )
                )
              )
            )
          )
        )
    })
)
