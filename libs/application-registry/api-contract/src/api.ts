import {
  type ListingCheckRun,
  ListingCheckRunSchema,
} from '@cv/application-registry-entity'
import { Schema } from 'effect'
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from 'effect/unstable/httpapi'

import { CvAnalyticsQuerySchema, CvAnalyticsResponseSchema } from './analytics'
import { RegistryAuthorization } from './auth'
import {
  AppendContentRevisionRequestSchema,
  ApproveContentRevisionRequestSchema,
  BinaryBodySchema,
  BlobMetadataResponseSchema,
  BlobParamsSchema,
  CaptureJobPostingSnapshotResponseSchema,
  ContentEntryNaturalKeyParamsSchema,
  ContentEntryParamsSchema,
  ContentEntryResponseSchema,
  ContentRevisionParamsSchema,
  ContentRevisionResultResponseSchema,
  CurrentPdfArtifactParamsSchema,
  CurrentPdfArtifactQuerySchema,
  CvLinkResponseSchema,
  GeneratedArtifactResponseSchema,
  JobPostingSnapshotParamsSchema,
  JobPostingSnapshotPayloadParamsSchema,
  JobPostingSnapshotResponseSchema,
  ListContentRevisionsResponseSchema,
  PersistJobPostingSnapshotRequestSchema,
  SetCvLinkAvailabilityRequestSchema,
  StageCvRequestSchema,
} from './content'
import { assertUniqueHttpApiEndpoints } from './endpoint-integrity'
import {
  BadRequestErrorSchema,
  ConflictErrorSchema,
  InternalServerErrorSchema,
  NotFoundErrorSchema,
} from './errors'
import {
  PdfJobParamsSchema,
  PdfJobResponseSchema,
  StartPdfJobRequestSchema,
} from './pdf-jobs'
import {
  AddApplicationNoteRequestSchema,
  AddApplicationNoteResponseSchema,
  ApplicationAnnotationsResponseSchema,
  ApplicationFacetsResponseSchema,
  ApplicationIdentifierParamsSchema,
  ApplicationResponseSchema,
  CreateApplicationRequestSchema,
  HealthResponseSchema,
  IdempotencyHeadersSchema,
  ListActivitiesQuerySchema,
  ListActivitiesResponseSchema,
  ListApplicationActivitiesResponseSchema,
  ListApplicationCompensationsQuerySchema,
  ListApplicationCompensationsResponseSchema,
  ListApplicationListingChecksResponseSchema,
  ListApplicationsQuerySchema,
  ListApplicationsResponseSchema,
  ListingCheckRunFindingsParamsSchema,
  ListingCheckRunIdentifierParamsSchema,
  ResolveListingAvailabilityRequestSchema,
  ResolveListingAvailabilityResponseSchema,
  SubmitListingCheckFindingsRequestSchema,
  SubmitListingCheckFindingsResponseSchema,
  UpdateApplicationRequestSchema,
  UpdateApplicationResponseSchema,
} from './schemas'

const endpointErrors = [
  BadRequestErrorSchema,
  NotFoundErrorSchema,
  ConflictErrorSchema,
  InternalServerErrorSchema,
] as const

const apiPrefix = '/api/registry'

const CreatedApplicationResponseSchema = ApplicationResponseSchema.pipe(
  HttpApiSchema.status('Created')
)
const CreatedNoteResponseSchema = AddApplicationNoteResponseSchema.pipe(
  HttpApiSchema.status('Created')
)
const CreatedRevisionResponseSchema = ContentRevisionResultResponseSchema.pipe(
  HttpApiSchema.status('Created')
)
const AcceptedPdfJobResponseSchema = PdfJobResponseSchema.pipe(
  HttpApiSchema.status('Accepted')
)

const ListingCheckRunResponseSchema: Schema.Codec<ListingCheckRun> =
  Schema.revealCodec(ListingCheckRunSchema)

export const PublicApi = HttpApiGroup.make('public', {
  topLevel: true,
}).add(
  HttpApiEndpoint.get('health', '/health', {
    success: HealthResponseSchema,
  })
)

const applicationEndpoints = [
  HttpApiEndpoint.post('createApplication', '/applications', {
    error: endpointErrors,
    payload: CreateApplicationRequestSchema,
    success: CreatedApplicationResponseSchema,
  }),
  HttpApiEndpoint.get('listApplications', '/applications', {
    error: endpointErrors,
    query: ListApplicationsQuerySchema,
    success: ListApplicationsResponseSchema,
  }),
  HttpApiEndpoint.get('listApplicationFacets', '/applications/facets', {
    error: endpointErrors,
    success: ApplicationFacetsResponseSchema,
  }),
  HttpApiEndpoint.get('getApplication', '/applications/:id', {
    error: endpointErrors,
    params: ApplicationIdentifierParamsSchema,
    success: ApplicationResponseSchema,
  }),
  HttpApiEndpoint.patch('updateApplication', '/applications/:id', {
    error: endpointErrors,
    headers: IdempotencyHeadersSchema,
    params: ApplicationIdentifierParamsSchema,
    payload: UpdateApplicationRequestSchema,
    success: UpdateApplicationResponseSchema,
  }),
  HttpApiEndpoint.get(
    'listApplicationActivities',
    '/applications/:id/activities',
    {
      error: endpointErrors,
      params: ApplicationIdentifierParamsSchema,
      success: ListApplicationActivitiesResponseSchema,
    }
  ),
  HttpApiEndpoint.get('listActivities', '/activities', {
    error: endpointErrors,
    query: ListActivitiesQuerySchema,
    success: ListActivitiesResponseSchema,
  }),
  HttpApiEndpoint.get(
    'listApplicationAnnotations',
    '/applications/:id/annotations',
    {
      error: endpointErrors,
      params: ApplicationIdentifierParamsSchema,
      success: ApplicationAnnotationsResponseSchema,
    }
  ),
  HttpApiEndpoint.post('addApplicationNote', '/applications/:id/notes', {
    error: endpointErrors,
    headers: IdempotencyHeadersSchema,
    params: ApplicationIdentifierParamsSchema,
    payload: AddApplicationNoteRequestSchema,
    success: CreatedNoteResponseSchema,
  }),
  HttpApiEndpoint.get(
    'listApplicationCompensations',
    '/applications/:id/compensations',
    {
      error: endpointErrors,
      params: ApplicationIdentifierParamsSchema,
      query: ListApplicationCompensationsQuerySchema,
      success: ListApplicationCompensationsResponseSchema,
    }
  ),
  HttpApiEndpoint.get(
    'listApplicationListingChecks',
    '/applications/:id/listing-checks',
    {
      error: endpointErrors,
      params: ApplicationIdentifierParamsSchema,
      success: ListApplicationListingChecksResponseSchema,
    }
  ),
  HttpApiEndpoint.post(
    'resolveApplicationListingAvailability',
    '/applications/:id/listing-resolutions',
    {
      error: endpointErrors,
      headers: IdempotencyHeadersSchema,
      params: ApplicationIdentifierParamsSchema,
      payload: ResolveListingAvailabilityRequestSchema,
      success: ResolveListingAvailabilityResponseSchema,
    }
  ),
  HttpApiEndpoint.get('getCvAnalytics', '/analytics/cv-links', {
    error: endpointErrors,
    query: CvAnalyticsQuerySchema,
    success: CvAnalyticsResponseSchema,
  }),
] as const

assertUniqueHttpApiEndpoints('applications', applicationEndpoints)

export const ApplicationsApi = HttpApiGroup.make('applications')
  .add(applicationEndpoints[0])
  .add(applicationEndpoints[1])
  .add(applicationEndpoints[2])
  .add(applicationEndpoints[3])
  .add(applicationEndpoints[4])
  .add(applicationEndpoints[5])
  .add(applicationEndpoints[6])
  .add(applicationEndpoints[7])
  .add(applicationEndpoints[8])
  .add(applicationEndpoints[9])
  .add(applicationEndpoints[10])
  .add(applicationEndpoints[11])
  .add(applicationEndpoints[12])
  .prefix(apiPrefix)
  .middleware(RegistryAuthorization)

const contentEndpoints = [
  HttpApiEndpoint.put('putBlob', '/blobs/:sha256', {
    error: endpointErrors,
    params: BlobParamsSchema,
    payload: BinaryBodySchema,
    success: BlobMetadataResponseSchema,
  }),
  HttpApiEndpoint.get('getBlob', '/blobs/:sha256', {
    error: endpointErrors,
    params: BlobParamsSchema,
    success: BinaryBodySchema,
  }),
  HttpApiEndpoint.post(
    'captureJobPostingSnapshot',
    '/applications/:id/job-snapshot-captures',
    {
      error: endpointErrors,
      params: ApplicationIdentifierParamsSchema,
      success: CaptureJobPostingSnapshotResponseSchema,
    }
  ),
  HttpApiEndpoint.post(
    'persistJobPostingSnapshot',
    '/applications/:id/job-snapshots',
    {
      error: endpointErrors,
      params: ApplicationIdentifierParamsSchema,
      payload: PersistJobPostingSnapshotRequestSchema,
      success: JobPostingSnapshotResponseSchema,
    }
  ),
  HttpApiEndpoint.get(
    'getLatestJobPostingSnapshot',
    '/applications/:id/job-snapshots/latest',
    {
      error: endpointErrors,
      params: ApplicationIdentifierParamsSchema,
      success: JobPostingSnapshotResponseSchema,
    }
  ),
  HttpApiEndpoint.get(
    'getJobPostingSnapshot',
    '/applications/:id/job-snapshots/:snapshotId',
    {
      error: endpointErrors,
      params: JobPostingSnapshotParamsSchema,
      success: JobPostingSnapshotResponseSchema,
    }
  ),
  HttpApiEndpoint.get(
    'getJobPostingSnapshotPayload',
    '/applications/:id/job-snapshots/:snapshotId/content/:kind',
    {
      error: endpointErrors,
      params: JobPostingSnapshotPayloadParamsSchema,
      success: BinaryBodySchema,
    }
  ),
  HttpApiEndpoint.put(
    'ensureContentEntry',
    '/applications/:id/content-entries/:kind/:locale',
    {
      error: endpointErrors,
      params: ContentEntryNaturalKeyParamsSchema,
      success: ContentEntryResponseSchema,
    }
  ),
  HttpApiEndpoint.get(
    'getContentEntry',
    '/applications/:id/content-entries/:entryId',
    {
      error: endpointErrors,
      params: ContentEntryParamsSchema,
      success: ContentEntryResponseSchema,
    }
  ),
  HttpApiEndpoint.patch(
    'approveContentRevision',
    '/applications/:id/content-entries/:entryId',
    {
      error: endpointErrors,
      params: ContentEntryParamsSchema,
      payload: ApproveContentRevisionRequestSchema,
      success: ContentRevisionResultResponseSchema,
    }
  ),
  HttpApiEndpoint.get(
    'listContentRevisions',
    '/applications/:id/content-entries/:entryId/revisions',
    {
      error: endpointErrors,
      params: ContentEntryParamsSchema,
      success: ListContentRevisionsResponseSchema,
    }
  ),
  HttpApiEndpoint.post(
    'appendContentRevision',
    '/applications/:id/content-entries/:entryId/revisions',
    {
      error: endpointErrors,
      headers: IdempotencyHeadersSchema,
      params: ContentEntryParamsSchema,
      payload: AppendContentRevisionRequestSchema,
      success: CreatedRevisionResponseSchema,
    }
  ),
  HttpApiEndpoint.get(
    'readContentRevision',
    '/applications/:id/content-entries/:entryId/revisions/:revisionId',
    {
      error: endpointErrors,
      params: ContentRevisionParamsSchema,
      success: ContentRevisionResultResponseSchema,
    }
  ),
  HttpApiEndpoint.get(
    'readContentRevisionPayload',
    '/applications/:id/content-entries/:entryId/revisions/:revisionId/content',
    {
      error: endpointErrors,
      params: ContentRevisionParamsSchema,
      success: BinaryBodySchema,
    }
  ),
] as const

assertUniqueHttpApiEndpoints('content', contentEndpoints)

export const ContentApi = HttpApiGroup.make('content')
  .add(contentEndpoints[0])
  .add(contentEndpoints[1])
  .add(contentEndpoints[2])
  .add(contentEndpoints[3])
  .add(contentEndpoints[4])
  .add(contentEndpoints[5])
  .add(contentEndpoints[6])
  .add(contentEndpoints[7])
  .add(contentEndpoints[8])
  .add(contentEndpoints[9])
  .add(contentEndpoints[10])
  .add(contentEndpoints[11])
  .add(contentEndpoints[12])
  .add(contentEndpoints[13])
  .prefix(apiPrefix)
  .middleware(RegistryAuthorization)

const publicationEndpoints = [
  HttpApiEndpoint.put(
    'stageCv',
    '/applications/:id/content-entries/:entryId/publication',
    {
      error: endpointErrors,
      params: ContentEntryParamsSchema,
      payload: StageCvRequestSchema,
      success: CvLinkResponseSchema,
    }
  ),
  HttpApiEndpoint.get(
    'getCvLink',
    '/applications/:id/content-entries/:entryId/publication',
    {
      error: endpointErrors,
      params: ContentEntryParamsSchema,
      success: CvLinkResponseSchema,
    }
  ),
  HttpApiEndpoint.patch(
    'setCvLinkAvailability',
    '/applications/:id/content-entries/:entryId/publication',
    {
      error: endpointErrors,
      params: ContentEntryParamsSchema,
      payload: SetCvLinkAvailabilityRequestSchema,
      success: CvLinkResponseSchema,
    }
  ),
  HttpApiEndpoint.get(
    'getCurrentPdfArtifact',
    '/applications/:id/content-entries/:entryId/pdf',
    {
      error: endpointErrors,
      params: CurrentPdfArtifactParamsSchema,
      query: CurrentPdfArtifactQuerySchema,
      success: GeneratedArtifactResponseSchema,
    }
  ),
  HttpApiEndpoint.get(
    'readCurrentPdfArtifact',
    '/applications/:id/content-entries/:entryId/pdf/content',
    {
      error: endpointErrors,
      params: CurrentPdfArtifactParamsSchema,
      query: CurrentPdfArtifactQuerySchema,
      success: BinaryBodySchema,
    }
  ),
  HttpApiEndpoint.post(
    'startPdfJob',
    '/applications/:id/content-entries/:entryId/pdf-runs',
    {
      error: endpointErrors,
      params: ContentEntryParamsSchema,
      payload: StartPdfJobRequestSchema,
      success: AcceptedPdfJobResponseSchema,
    }
  ),
  HttpApiEndpoint.get(
    'getPdfJob',
    '/applications/:id/content-entries/:entryId/pdf-runs/:jobId',
    {
      error: endpointErrors,
      params: PdfJobParamsSchema,
      success: PdfJobResponseSchema,
    }
  ),
] as const

assertUniqueHttpApiEndpoints('publications', publicationEndpoints)

export const PublicationsApi = HttpApiGroup.make('publications')
  .add(publicationEndpoints[0])
  .add(publicationEndpoints[1])
  .add(publicationEndpoints[2])
  .add(publicationEndpoints[3])
  .add(publicationEndpoints[4])
  .add(publicationEndpoints[5])
  .add(publicationEndpoints[6])
  .prefix(apiPrefix)
  .middleware(RegistryAuthorization)

const automationEndpoints = [
  HttpApiEndpoint.post(
    'submitListingCheckFindings',
    '/automation/listing-check-runs/:runId/findings',
    {
      error: endpointErrors,
      params: ListingCheckRunFindingsParamsSchema,
      payload: SubmitListingCheckFindingsRequestSchema,
      success: SubmitListingCheckFindingsResponseSchema,
    }
  ),
  HttpApiEndpoint.get(
    'getListingCheckRun',
    '/automation/listing-check-runs/:id',
    {
      error: endpointErrors,
      params: ListingCheckRunIdentifierParamsSchema,
      success: ListingCheckRunResponseSchema,
    }
  ),
] as const

assertUniqueHttpApiEndpoints('automation', automationEndpoints)

export const AutomationApi = HttpApiGroup.make('automation')
  .add(automationEndpoints[0])
  .add(automationEndpoints[1])
  .prefix(apiPrefix)
  .middleware(RegistryAuthorization)

export const ApplicationRegistryApi = HttpApi.make('applicationRegistry').add(
  PublicApi,
  ApplicationsApi,
  ContentApi,
  PublicationsApi,
  AutomationApi
)
