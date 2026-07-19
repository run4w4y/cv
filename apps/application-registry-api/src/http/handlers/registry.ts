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
  CompensationsService,
  ContentEntriesService,
  CvPublicationsService,
  CvAnalyticsService,
  EventsService,
  FactsReleasesService,
  JobPostingCaptureService,
  JobPostingSnapshotsService,
  ListingChecksService,
  OpaqueObjectsService,
  PdfArtifactsService,
} from '@cv/application-registry-service'
import { Effect, Match } from 'effect'
import { HttpApiBuilder } from 'effect/unstable/httpapi'
import { dispatchPdfJob, pdfJobResponse } from '../../worker/pdf-queue'
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
  Match.tag('RegistryAnalyticsError', (error) =>
    ServiceUnavailableError.make({ message: error.message })
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
      const compensations = yield* CompensationsService
      const contentEntries = yield* ContentEntriesService
      const cvPublications = yield* CvPublicationsService
      const cvAnalytics = yield* CvAnalyticsService
      const events = yield* EventsService
      const factsReleases = yield* FactsReleasesService
      const jobCapture = yield* JobPostingCaptureService
      const jobSnapshots = yield* JobPostingSnapshotsService
      const listingChecks = yield* ListingChecksService
      const opaqueObjects = yield* OpaqueObjectsService
      const pdfArtifacts = yield* PdfArtifactsService

      return handlers.handleAll({
        createApplication: ({ payload }) =>
          expose(applications.create(payload)),
        upsertApplication: ({ payload }) =>
          expose(applications.upsert(payload)),
        getCvAnalytics: ({ query }) => expose(cvAnalytics.read(query)),
        listApplications: ({ query }) => expose(applications.list(query)),
        listApplicationFacets: () => expose(applications.facets()),
        getApplication: ({ params }) => expose(applications.find(params.id)),
        patchApplication: ({ params, payload }) =>
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
          ),
        updateManagedApplication: ({ params, payload }) =>
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
          ),
        deleteApplication: ({ params, query }) =>
          expose(applications.remove(params.id, query.expectedVersion)),
        listApplicationCompensations: ({ params, query }) =>
          expose(compensations.listByApplication(params.id, query.currency)),
        replaceAnnualCompensation: ({ params, payload }) =>
          expose(compensations.replaceAnnual(params.id, payload)),
        listApplicationEvents: ({ params }) =>
          expose(events.listByApplication(params.id)),
        appendApplicationEvent: ({ params, payload }) =>
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
          ),
        listApplicationAnnotations: ({ params }) =>
          expose(annotations.list(params.id)),
        listApplicationLabels: ({ params }) =>
          expose(annotations.list(params.id)).pipe(
            Effect.map(({ labels }) => ({ items: labels }))
          ),
        replaceApplicationLabels: ({ params, payload }) =>
          expose(
            applications.replaceLabels(
              params.id,
              payload.labels,
              payload.expectedVersion
            )
          ),
        addApplicationNote: ({ params, payload }) =>
          expose(annotations.addNote(params.id, payload)),
        listEvents: ({ query }) => expose(events.list(query)),
        listApplicationListingChecks: ({ params }) =>
          expose(listingChecks.listByApplication(params.id)),
        resolveApplicationListingAvailability: ({ params, payload }) =>
          expose(listingChecks.resolveAvailability(params.id, payload)),
        submitListingCheckFindings: ({ payload }) =>
          expose(listingChecks.submitFindings(payload)),
        getListingCheckRun: ({ params }) =>
          expose(listingChecks.findRun(params.id)),
        putOpaqueObject: ({ payload }) =>
          expose(
            decodeBase64(payload.data).pipe(
              Effect.flatMap((bytes) => opaqueObjects.put(bytes))
            )
          ),
        registerFactsRelease: ({ payload }) =>
          expose(factsReleases.register(payload)),
        getFactsRelease: ({ params }) =>
          expose(factsReleases.find(params.releaseId)),
        activateFactsRelease: ({ params, payload }) =>
          expose(
            factsReleases.activate(
              params.channel,
              payload.releaseId,
              payload.expectedVersion
            )
          ),
        getActiveFactsRelease: ({ query }) =>
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
                locale: active.catalog.locale,
                mediaType: active.catalog.mediaType,
                sha256: active.catalog.sha256,
              },
              locales: active.catalogs.map(({ locale }) => locale),
              channel: active.channel,
              release: active.release,
            }))
          ),
        persistJobPostingSnapshot: ({ params, payload }) =>
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

              return yield* jobSnapshots.persist(params.id, {
                ...payload,
                normalized,
                raw,
              })
            })
          ),
        captureJobPostingSnapshot: ({ params }) =>
          expose(jobCapture.capture(params.id)),
        getLatestJobPostingSnapshot: ({ params }) =>
          expose(jobSnapshots.latest(params.id)),
        getJobPostingSnapshot: ({ params }) =>
          expose(jobSnapshots.find(params.id, params.snapshotId)),
        getJobPostingSnapshotPayload: ({ params }) =>
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
          ),
        ensureContentEntry: ({ params, payload }) =>
          expose(contentEntries.ensure(params.id, payload)),
        getContentEntry: ({ params }) =>
          expose(contentEntries.find(params.id, params.entryId)),
        listContentRevisions: ({ params }) =>
          expose(contentEntries.listRevisions(params.id, params.entryId)).pipe(
            Effect.map((items) => ({ items }))
          ),
        appendContentRevision: ({ params, payload }) =>
          expose(
            decodeOpaquePayload(payload.payload).pipe(
              Effect.flatMap((decoded) =>
                contentEntries.appendRevision(params.id, params.entryId, {
                  ...payload,
                  payload: decoded,
                })
              )
            )
          ),
        readContentRevision: ({ params }) =>
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
          ),
        approveContentRevision: ({ params, payload }) =>
          expose(
            contentEntries.approveRevision(params.id, params.entryId, payload)
          ),
        publishCv: ({ params, payload }) =>
          expose(cvPublications.publish(params.id, params.entryId, payload)),
        getCvLink: ({ params }) =>
          expose(cvPublications.findByEntry(params.id, params.entryId)),
        setCvLinkAvailability: ({ params, payload }) =>
          expose(
            cvPublications.setAvailability(params.id, params.entryId, payload)
          ),
        disableApplicationCvLinks: ({ params, payload }) =>
          expose(
            cvPublications.disableForApplication(params.id, payload.reason)
          ).pipe(Effect.map((count) => ({ count }))),
        getCurrentPdfArtifact: ({ params, query }) =>
          expose(
            pdfArtifacts.findCurrent(
              params.id,
              params.entryId,
              query.rendererVersion
            )
          ),
        readCurrentPdfArtifact: ({ params, query }) =>
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
          ),
        startPdfJob: ({ params, payload }) =>
          expose(
            Effect.gen(function* () {
              const artifact = yield* pdfArtifacts.startJob(
                params.id,
                params.entryId,
                payload
              )
              yield* dispatchPdfJob(artifact.id).pipe(
                Effect.provideService(PdfArtifactsService, pdfArtifacts),
                Effect.catch((error) =>
                  Effect.logWarning('PdfQueue.immediate_dispatch_failed', {
                    artifactId: artifact.id,
                    message: error.message,
                  })
                )
              )
              return pdfJobResponse(artifact)
            })
          ),
        getPdfJob: ({ params }) =>
          expose(
            pdfArtifacts
              .findJob(params.id, params.entryId, params.jobId)
              .pipe(Effect.map(({ artifact }) => pdfJobResponse(artifact)))
          ),
      })
    })
)
