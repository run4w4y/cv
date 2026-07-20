import {
  ApplicationRegistryApi,
  BadRequestError,
  ConflictError,
  InternalServerError,
  NotFoundError,
  ServiceUnavailableError,
} from '@cv/application-registry-api-contract'
import {
  ActivitiesService,
  AnnotationsService,
  type ApplicationRegistryError,
  ApplicationsService,
  applicationRejectedDisableReason,
  CompensationsService,
  ContentEntriesService,
  CvAnalyticsService,
  CvPublicationsService,
  JobPostingCaptureService,
  JobPostingSnapshotsService,
  ListingChecksService,
  OpaqueObjectsService,
  PdfArtifactsService,
} from '@cv/application-registry-service'
import { Effect, Match } from 'effect'
import { HttpApiBuilder } from 'effect/unstable/httpapi'
import { invalidateCvCache } from '../../worker/cv-cache'
import { dispatchPdfJob, pdfJobResponse } from '../../worker/pdf-queue'

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
  Match.exhaustive
)

const expose = <A>(effect: Effect.Effect<A, ApplicationRegistryError>) =>
  effect.pipe(Effect.mapError(toApiError))

const invalidatePublicationCache = (
  invalidation: Parameters<typeof invalidateCvCache>[0]
) =>
  invalidateCvCache(invalidation).pipe(
    Effect.catch((error) =>
      Effect.logWarning('CV cache compatibility purge failed.', {
        message: error.message,
      })
    )
  )

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
    Effect.tap(() => invalidatePublicationCache({ all: true })),
    Effect.asVoid,
    Effect.catch((error) => Effect.logWarning(error.message))
  )

export const ApplicationsHandlersLayer = HttpApiBuilder.group(
  ApplicationRegistryApi,
  'applications',
  (handlers) =>
    Effect.gen(function* () {
      const activities = yield* ActivitiesService
      const annotations = yield* AnnotationsService
      const applications = yield* ApplicationsService
      const compensations = yield* CompensationsService
      const cvAnalytics = yield* CvAnalyticsService
      const cvPublications = yield* CvPublicationsService
      const listingChecks = yield* ListingChecksService

      return handlers.handleAll({
        addApplicationNote: ({ headers, params, payload }) =>
          expose(
            annotations.addNote(params.id, {
              ...payload,
              idempotencyKey: headers['idempotency-key'],
            })
          ),
        createApplication: ({ payload }) =>
          expose(applications.create(payload)),
        getApplication: ({ params }) => expose(applications.find(params.id)),
        getCvAnalytics: ({ query }) => expose(cvAnalytics.read(query)),
        listActivities: ({ query }) => expose(activities.list(query)),
        listApplicationActivities: ({ params }) =>
          expose(activities.listByApplication(params.id)),
        listApplicationAnnotations: ({ params }) =>
          expose(annotations.list(params.id)),
        listApplicationCompensations: ({ params, query }) =>
          expose(compensations.listByApplication(params.id, query.currency)),
        listApplicationFacets: () => expose(applications.facets()),
        listApplicationListingChecks: ({ params }) =>
          expose(listingChecks.listByApplication(params.id)),
        listApplications: ({ query }) => expose(applications.list(query)),
        resolveApplicationListingAvailability: ({ headers, params, payload }) =>
          expose(
            listingChecks.resolveAvailability(params.id, {
              ...payload,
              idempotencyKey: headers['idempotency-key'],
            })
          ),
        updateApplication: ({ headers, params, payload }) =>
          expose(
            Effect.gen(function* () {
              const updated = yield* applications.update(params.id, {
                ...payload,
                idempotencyKey: headers['idempotency-key'],
              })
              yield* syncCvLinksForStatus(
                cvPublications,
                updated.application.id,
                updated.application.applicationStatus
              )
              return updated
            })
          ),
      })
    })
)

export const ContentHandlersLayer = HttpApiBuilder.group(
  ApplicationRegistryApi,
  'content',
  (handlers) =>
    Effect.gen(function* () {
      const contentEntries = yield* ContentEntriesService
      const jobCapture = yield* JobPostingCaptureService
      const jobSnapshots = yield* JobPostingSnapshotsService
      const opaqueObjects = yield* OpaqueObjectsService

      const readBlobReference = (reference: {
        readonly mediaType: string
        readonly sha256: string
      }) =>
        expose(opaqueObjects.read(reference.sha256)).pipe(
          Effect.map((bytes) => ({ bytes, mediaType: reference.mediaType }))
        )

      return handlers.handleAll({
        appendContentRevision: ({ headers, params, payload }) =>
          readBlobReference(payload.blob).pipe(
            Effect.flatMap((decoded) =>
              expose(
                contentEntries.appendRevision(params.id, params.entryId, {
                  contractId: payload.contractId,
                  contractVersion: payload.contractVersion,
                  expectedVersion: payload.expectedVersion,
                  factsReleaseId: payload.factsReleaseId,
                  jobSnapshotId: payload.jobSnapshotId,
                  operationId: headers['idempotency-key'],
                  payload: decoded,
                  source: payload.source,
                })
              )
            )
          ),
        approveContentRevision: ({ params, payload }) =>
          expose(
            contentEntries.approveRevision(params.id, params.entryId, {
              expectedVersion: payload.expectedVersion,
              revisionId: payload.approvedRevisionId,
            })
          ),
        captureJobPostingSnapshot: ({ params }) =>
          expose(jobCapture.capture(params.id)),
        ensureContentEntry: ({ params }) =>
          expose(
            contentEntries.ensure(params.id, {
              kind: params.kind,
              locale: params.locale,
            })
          ),
        getBlob: ({ params }) => expose(opaqueObjects.read(params.sha256)),
        getContentEntry: ({ params }) =>
          expose(contentEntries.find(params.id, params.entryId)),
        getJobPostingSnapshot: ({ params }) =>
          expose(jobSnapshots.find(params.id, params.snapshotId)),
        getJobPostingSnapshotPayload: ({ params }) =>
          expose(
            jobSnapshots.readPayload(params.id, params.snapshotId, params.kind)
          ),
        getLatestJobPostingSnapshot: ({ params }) =>
          expose(jobSnapshots.latest(params.id)),
        listContentRevisions: ({ params }) =>
          expose(contentEntries.listRevisions(params.id, params.entryId)).pipe(
            Effect.map((items) => ({ items }))
          ),
        persistJobPostingSnapshot: ({ params, payload }) =>
          Effect.gen(function* () {
            const raw = payload.raw
              ? yield* readBlobReference(payload.raw)
              : payload.raw
            const normalized = payload.normalized
              ? yield* readBlobReference(payload.normalized)
              : payload.normalized
            return yield* expose(
              jobSnapshots.persist(params.id, {
                ...payload,
                normalized,
                raw,
              })
            )
          }),
        putBlob: ({ params, payload }) =>
          expose(opaqueObjects.put(payload)).pipe(
            Effect.flatMap((metadata) =>
              metadata.sha256 === params.sha256
                ? Effect.succeed({
                    byteLength: metadata.byteLength,
                    sha256: metadata.sha256,
                  })
                : Effect.fail(
                    BadRequestError.make({
                      message:
                        'Blob path digest does not match the request body.',
                    })
                  )
            )
          ),
        readContentRevision: ({ params }) =>
          expose(
            contentEntries.readRevision(
              params.id,
              params.entryId,
              params.revisionId
            )
          ).pipe(Effect.map(({ bytes: _, ...result }) => result)),
        readContentRevisionPayload: ({ params }) =>
          expose(
            contentEntries.readRevision(
              params.id,
              params.entryId,
              params.revisionId
            )
          ).pipe(Effect.map(({ bytes }) => bytes)),
      })
    })
)

export const PublicationsHandlersLayer = HttpApiBuilder.group(
  ApplicationRegistryApi,
  'publications',
  (handlers) =>
    Effect.gen(function* () {
      const cvPublications = yield* CvPublicationsService
      const pdfArtifacts = yield* PdfArtifactsService

      return handlers.handleAll({
        getCurrentPdfArtifact: ({ params, query }) =>
          expose(
            pdfArtifacts.findCurrent(
              params.id,
              params.entryId,
              query.rendererVersion
            )
          ),
        getCvLink: ({ params }) =>
          expose(cvPublications.findByEntry(params.id, params.entryId)),
        getPdfJob: ({ params }) =>
          expose(
            pdfArtifacts
              .findJob(params.id, params.entryId, params.jobId)
              .pipe(Effect.map(({ artifact }) => pdfJobResponse(artifact)))
          ),
        stageCv: ({ params, payload }) =>
          expose(cvPublications.stage(params.id, params.entryId, payload)).pipe(
            Effect.tap((link) =>
              invalidatePublicationCache({ token: link.token })
            )
          ),
        readCurrentPdfArtifact: ({ params, query }) =>
          expose(
            pdfArtifacts.readCurrent(
              params.id,
              params.entryId,
              query.rendererVersion
            )
          ).pipe(Effect.map(({ bytes }) => bytes)),
        setCvLinkAvailability: ({ params, payload }) =>
          expose(
            cvPublications.setAvailability(params.id, params.entryId, payload)
          ).pipe(
            Effect.tap((link) =>
              invalidatePublicationCache({ token: link.token })
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
      })
    })
)

export const AutomationHandlersLayer = HttpApiBuilder.group(
  ApplicationRegistryApi,
  'automation',
  (handlers) =>
    Effect.gen(function* () {
      const listingChecks = yield* ListingChecksService

      return handlers.handleAll({
        getListingCheckRun: ({ params }) =>
          expose(listingChecks.findRun(params.id)),
        submitListingCheckFindings: ({ params, payload }) =>
          expose(
            listingChecks.submitFindings({
              ...payload,
              runId: params.runId,
            })
          ),
      })
    })
)

export const RegistryHandlersLayers = [
  ApplicationsHandlersLayer,
  AutomationHandlersLayer,
  ContentHandlersLayer,
  PublicationsHandlersLayer,
] as const
