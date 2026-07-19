import {
  type ApplicationLabel,
  ApplicationLabelSchema,
  type FactsChannel,
  FactsChannelSchema,
  type ListingCheckRun,
  ListingCheckRunSchema,
} from '@cv/application-registry-entity'
import { Schema } from 'effect'
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from 'effect/unstable/httpapi'
import { CvAnalyticsQuerySchema, CvAnalyticsResponseSchema } from './analytics'
import { RegistryAuthorization } from './auth'
import {
  ActivateFactsReleaseRequestSchema,
  ActiveFactsReleaseQuerySchema,
  ActiveFactsReleaseResponseSchema,
  AppendContentRevisionRequestSchema,
  ApproveContentRevisionRequestSchema,
  CaptureJobPostingSnapshotResponseSchema,
  ContentEntryParamsSchema,
  ContentEntryResponseSchema,
  ContentRevisionParamsSchema,
  ContentRevisionResultResponseSchema,
  CurrentPdfArtifactParamsSchema,
  CurrentPdfArtifactQuerySchema,
  CvLinkResponseSchema,
  DisableApplicationCvLinksRequestSchema,
  DisableApplicationCvLinksResponseSchema,
  EnsureContentEntryRequestSchema,
  FactsChannelParamsSchema,
  FactsReleaseParamsSchema,
  FactsReleaseRecordResponseSchema,
  GeneratedArtifactResponseSchema,
  JobPostingSnapshotParamsSchema,
  JobPostingSnapshotPayloadParamsSchema,
  JobPostingSnapshotResponseSchema,
  ListContentRevisionsResponseSchema,
  OpaqueObjectResponseSchema,
  OpaquePayloadResponseSchema,
  PersistJobPostingSnapshotRequestSchema,
  PublishCvRequestSchema,
  PutOpaqueObjectRequestSchema,
  ReadContentRevisionResponseSchema,
  ReadyPdfArtifactResponseSchema,
  RegisterFactsReleaseRequestSchema,
  SetCvLinkAvailabilityRequestSchema,
} from './content'
import { assertUniqueHttpApiEndpoints } from './endpoint-integrity'
import {
  BadRequestErrorSchema,
  ConflictErrorSchema,
  InternalServerErrorSchema,
  NotFoundErrorSchema,
} from './errors'
import {
  AddApplicationNoteRequestSchema,
  AddApplicationNoteResponseSchema,
  AppendApplicationEventRequestSchema,
  AppendApplicationEventResponseSchema,
  ApplicationAnnotationsResponseSchema,
  ApplicationFacetsResponseSchema,
  ApplicationIdentifierParamsSchema,
  ApplicationResponseSchema,
  CreateApplicationRequestSchema,
  DeleteApplicationQuerySchema,
  DeleteApplicationResponseSchema,
  HealthResponseSchema,
  ListApplicationCompensationsQuerySchema,
  ListApplicationCompensationsResponseSchema,
  ListApplicationEventsResponseSchema,
  ListApplicationLabelsResponseSchema,
  ListApplicationListingChecksResponseSchema,
  ListApplicationsQuerySchema,
  ListApplicationsResponseSchema,
  ListEventsQuerySchema,
  ListEventsResponseSchema,
  ListingCheckRunIdentifierParamsSchema,
  PatchApplicationRequestSchema,
  ReplaceAnnualCompensationRequestSchema,
  ReplaceAnnualCompensationResponseSchema,
  ReplaceApplicationLabelsRequestSchema,
  ResolveListingAvailabilityRequestSchema,
  ResolveListingAvailabilityResponseSchema,
  SubmitListingCheckFindingsRequestSchema,
  SubmitListingCheckFindingsResponseSchema,
  UpdateManagedApplicationRequestSchema,
  UpdateManagedApplicationResponseSchema,
  UpsertApplicationRequestSchema,
} from './schemas'
import {
  PdfJobParamsSchema,
  PdfJobResponseSchema,
  StartPdfJobRequestSchema,
} from './pdf-jobs'

const registryEndpointErrors = [
  BadRequestErrorSchema,
  NotFoundErrorSchema,
  ConflictErrorSchema,
  InternalServerErrorSchema,
] as const

const analyticsEndpointErrors = [
  BadRequestErrorSchema,
  NotFoundErrorSchema,
  ConflictErrorSchema,
  InternalServerErrorSchema,
] as const

const ApplicationLabelArrayResponseSchema: Schema.Codec<
  readonly ApplicationLabel[]
> = Schema.revealCodec(Schema.Array(ApplicationLabelSchema))
const FactsChannelResponseSchema: Schema.Codec<FactsChannel> =
  Schema.revealCodec(FactsChannelSchema)
const ListingCheckRunResponseSchema: Schema.Codec<ListingCheckRun> =
  Schema.revealCodec(ListingCheckRunSchema)

export const PublicApi = HttpApiGroup.make('public', {
  topLevel: true,
}).add(
  HttpApiEndpoint.get('health', '/health', {
    success: HealthResponseSchema,
  })
)

const registryEndpoints = [
  HttpApiEndpoint.post('createApplication', '/applications', {
    error: registryEndpointErrors,
    payload: CreateApplicationRequestSchema,
    success: ApplicationResponseSchema,
  }),
  HttpApiEndpoint.put('upsertApplication', '/applications', {
    error: registryEndpointErrors,
    payload: UpsertApplicationRequestSchema,
    success: ApplicationResponseSchema,
  }),
  HttpApiEndpoint.get('getCvAnalytics', '/analytics/cv-links', {
    error: analyticsEndpointErrors,
    query: CvAnalyticsQuerySchema,
    success: CvAnalyticsResponseSchema,
  }),
  HttpApiEndpoint.get('listApplications', '/applications', {
    error: registryEndpointErrors,
    query: ListApplicationsQuerySchema,
    success: ListApplicationsResponseSchema,
  }),
  HttpApiEndpoint.get('listApplicationFacets', '/applications/facets', {
    error: registryEndpointErrors,
    success: ApplicationFacetsResponseSchema,
  }),
  HttpApiEndpoint.get('getApplication', '/applications/:id', {
    error: registryEndpointErrors,
    params: ApplicationIdentifierParamsSchema,
    success: ApplicationResponseSchema,
  }),
  HttpApiEndpoint.patch('patchApplication', '/applications/:id', {
    error: registryEndpointErrors,
    params: ApplicationIdentifierParamsSchema,
    payload: PatchApplicationRequestSchema,
    success: ApplicationResponseSchema,
  }),
  HttpApiEndpoint.patch(
    'updateManagedApplication',
    '/applications/:id/management',
    {
      error: registryEndpointErrors,
      params: ApplicationIdentifierParamsSchema,
      payload: UpdateManagedApplicationRequestSchema,
      success: UpdateManagedApplicationResponseSchema,
    }
  ),
  HttpApiEndpoint.delete('deleteApplication', '/applications/:id', {
    error: registryEndpointErrors,
    params: ApplicationIdentifierParamsSchema,
    query: DeleteApplicationQuerySchema,
    success: DeleteApplicationResponseSchema,
  }),
  HttpApiEndpoint.post('putOpaqueObject', '/objects', {
    error: registryEndpointErrors,
    payload: PutOpaqueObjectRequestSchema,
    success: OpaqueObjectResponseSchema,
  }),
  HttpApiEndpoint.post('registerFactsRelease', '/facts-releases', {
    error: registryEndpointErrors,
    payload: RegisterFactsReleaseRequestSchema,
    success: FactsReleaseRecordResponseSchema,
  }),
  HttpApiEndpoint.get('getActiveFactsRelease', '/facts-releases/active', {
    error: registryEndpointErrors,
    query: ActiveFactsReleaseQuerySchema,
    success: ActiveFactsReleaseResponseSchema,
  }),
  HttpApiEndpoint.get('getFactsRelease', '/facts-releases/:releaseId', {
    error: registryEndpointErrors,
    params: FactsReleaseParamsSchema,
    success: FactsReleaseRecordResponseSchema,
  }),
  HttpApiEndpoint.put(
    'activateFactsRelease',
    '/facts-releases/channels/:channel',
    {
      error: registryEndpointErrors,
      params: FactsChannelParamsSchema,
      payload: ActivateFactsReleaseRequestSchema,
      success: FactsChannelResponseSchema,
    }
  ),
  HttpApiEndpoint.get(
    'listApplicationCompensations',
    '/applications/:id/compensations',
    {
      error: registryEndpointErrors,
      params: ApplicationIdentifierParamsSchema,
      query: ListApplicationCompensationsQuerySchema,
      success: ListApplicationCompensationsResponseSchema,
    }
  ),
  HttpApiEndpoint.put(
    'replaceAnnualCompensation',
    '/applications/:id/annual-compensation',
    {
      error: registryEndpointErrors,
      params: ApplicationIdentifierParamsSchema,
      payload: ReplaceAnnualCompensationRequestSchema,
      success: ReplaceAnnualCompensationResponseSchema,
    }
  ),
  HttpApiEndpoint.get('listApplicationEvents', '/applications/:id/events', {
    error: registryEndpointErrors,
    params: ApplicationIdentifierParamsSchema,
    success: ListApplicationEventsResponseSchema,
  }),
  HttpApiEndpoint.post('appendApplicationEvent', '/applications/:id/events', {
    error: registryEndpointErrors,
    params: ApplicationIdentifierParamsSchema,
    payload: AppendApplicationEventRequestSchema,
    success: AppendApplicationEventResponseSchema,
  }),
  HttpApiEndpoint.get(
    'listApplicationAnnotations',
    '/applications/:id/annotations',
    {
      error: registryEndpointErrors,
      params: ApplicationIdentifierParamsSchema,
      success: ApplicationAnnotationsResponseSchema,
    }
  ),
  HttpApiEndpoint.get('listApplicationLabels', '/applications/:id/labels', {
    error: registryEndpointErrors,
    params: ApplicationIdentifierParamsSchema,
    success: ListApplicationLabelsResponseSchema,
  }),
  HttpApiEndpoint.put('replaceApplicationLabels', '/applications/:id/labels', {
    error: registryEndpointErrors,
    params: ApplicationIdentifierParamsSchema,
    payload: ReplaceApplicationLabelsRequestSchema,
    success: ApplicationLabelArrayResponseSchema,
  }),
  HttpApiEndpoint.post('addApplicationNote', '/applications/:id/notes', {
    error: registryEndpointErrors,
    params: ApplicationIdentifierParamsSchema,
    payload: AddApplicationNoteRequestSchema,
    success: AddApplicationNoteResponseSchema,
  }),
  HttpApiEndpoint.get('listEvents', '/events', {
    error: registryEndpointErrors,
    query: ListEventsQuerySchema,
    success: ListEventsResponseSchema,
  }),
  HttpApiEndpoint.get(
    'listApplicationListingChecks',
    '/applications/:id/listing-checks',
    {
      error: registryEndpointErrors,
      params: ApplicationIdentifierParamsSchema,
      success: ListApplicationListingChecksResponseSchema,
    }
  ),
  HttpApiEndpoint.put(
    'resolveApplicationListingAvailability',
    '/applications/:id/listing-availability',
    {
      error: registryEndpointErrors,
      params: ApplicationIdentifierParamsSchema,
      payload: ResolveListingAvailabilityRequestSchema,
      success: ResolveListingAvailabilityResponseSchema,
    }
  ),
  HttpApiEndpoint.post(
    'submitListingCheckFindings',
    '/listing-check-findings',
    {
      error: registryEndpointErrors,
      payload: SubmitListingCheckFindingsRequestSchema,
      success: SubmitListingCheckFindingsResponseSchema,
    }
  ),
  HttpApiEndpoint.get('getListingCheckRun', '/listing-check-runs/:id', {
    error: registryEndpointErrors,
    params: ListingCheckRunIdentifierParamsSchema,
    success: ListingCheckRunResponseSchema,
  }),
  HttpApiEndpoint.post(
    'captureJobPostingSnapshot',
    '/applications/:id/job-snapshots/capture',
    {
      error: registryEndpointErrors,
      params: ApplicationIdentifierParamsSchema,
      success: CaptureJobPostingSnapshotResponseSchema,
    }
  ),
  HttpApiEndpoint.post(
    'persistJobPostingSnapshot',
    '/applications/:id/job-snapshots',
    {
      error: registryEndpointErrors,
      params: ApplicationIdentifierParamsSchema,
      payload: PersistJobPostingSnapshotRequestSchema,
      success: JobPostingSnapshotResponseSchema,
    }
  ),
  HttpApiEndpoint.get(
    'getLatestJobPostingSnapshot',
    '/applications/:id/job-snapshots/latest',
    {
      error: registryEndpointErrors,
      params: ApplicationIdentifierParamsSchema,
      success: JobPostingSnapshotResponseSchema,
    }
  ),
  HttpApiEndpoint.get(
    'getJobPostingSnapshot',
    '/applications/:id/job-snapshots/:snapshotId',
    {
      error: registryEndpointErrors,
      params: JobPostingSnapshotParamsSchema,
      success: JobPostingSnapshotResponseSchema,
    }
  ),
  HttpApiEndpoint.get(
    'getJobPostingSnapshotPayload',
    '/applications/:id/job-snapshots/:snapshotId/payloads/:kind',
    {
      error: registryEndpointErrors,
      params: JobPostingSnapshotPayloadParamsSchema,
      success: OpaquePayloadResponseSchema,
    }
  ),
  HttpApiEndpoint.post(
    'ensureContentEntry',
    '/applications/:id/content-entries',
    {
      error: registryEndpointErrors,
      params: ApplicationIdentifierParamsSchema,
      payload: EnsureContentEntryRequestSchema,
      success: ContentEntryResponseSchema,
    }
  ),
  HttpApiEndpoint.get(
    'getContentEntry',
    '/applications/:id/content-entries/:entryId',
    {
      error: registryEndpointErrors,
      params: ContentEntryParamsSchema,
      success: ContentEntryResponseSchema,
    }
  ),
  HttpApiEndpoint.get(
    'listContentRevisions',
    '/applications/:id/content-entries/:entryId/revisions',
    {
      error: registryEndpointErrors,
      params: ContentEntryParamsSchema,
      success: ListContentRevisionsResponseSchema,
    }
  ),
  HttpApiEndpoint.post(
    'appendContentRevision',
    '/applications/:id/content-entries/:entryId/revisions',
    {
      error: registryEndpointErrors,
      params: ContentEntryParamsSchema,
      payload: AppendContentRevisionRequestSchema,
      success: ContentRevisionResultResponseSchema,
    }
  ),
  HttpApiEndpoint.get(
    'readContentRevision',
    '/applications/:id/content-entries/:entryId/revisions/:revisionId',
    {
      error: registryEndpointErrors,
      params: ContentRevisionParamsSchema,
      success: ReadContentRevisionResponseSchema,
    }
  ),
  HttpApiEndpoint.post(
    'approveContentRevision',
    '/applications/:id/content-entries/:entryId/approval',
    {
      error: registryEndpointErrors,
      params: ContentEntryParamsSchema,
      payload: ApproveContentRevisionRequestSchema,
      success: ContentRevisionResultResponseSchema,
    }
  ),
  HttpApiEndpoint.post(
    'publishCv',
    '/applications/:id/content-entries/:entryId/publication',
    {
      error: registryEndpointErrors,
      params: ContentEntryParamsSchema,
      payload: PublishCvRequestSchema,
      success: CvLinkResponseSchema,
    }
  ),
  HttpApiEndpoint.get(
    'getCvLink',
    '/applications/:id/content-entries/:entryId/publication',
    {
      error: registryEndpointErrors,
      params: ContentEntryParamsSchema,
      success: CvLinkResponseSchema,
    }
  ),
  HttpApiEndpoint.put(
    'setCvLinkAvailability',
    '/applications/:id/content-entries/:entryId/publication/availability',
    {
      error: registryEndpointErrors,
      params: ContentEntryParamsSchema,
      payload: SetCvLinkAvailabilityRequestSchema,
      success: CvLinkResponseSchema,
    }
  ),
  HttpApiEndpoint.post(
    'disableApplicationCvLinks',
    '/applications/:id/cv-links/disable',
    {
      error: registryEndpointErrors,
      params: ApplicationIdentifierParamsSchema,
      payload: DisableApplicationCvLinksRequestSchema,
      success: DisableApplicationCvLinksResponseSchema,
    }
  ),
  HttpApiEndpoint.get(
    'getCurrentPdfArtifact',
    '/applications/:id/content-entries/:entryId/pdf-artifacts/current',
    {
      error: registryEndpointErrors,
      params: CurrentPdfArtifactParamsSchema,
      query: CurrentPdfArtifactQuerySchema,
      success: GeneratedArtifactResponseSchema,
    }
  ),
  HttpApiEndpoint.get(
    'readCurrentPdfArtifact',
    '/applications/:id/content-entries/:entryId/pdf-artifacts/current/content',
    {
      error: registryEndpointErrors,
      params: CurrentPdfArtifactParamsSchema,
      query: CurrentPdfArtifactQuerySchema,
      success: ReadyPdfArtifactResponseSchema,
    }
  ),
  HttpApiEndpoint.post(
    'startPdfJob',
    '/applications/:id/content-entries/:entryId/pdf-jobs',
    {
      error: registryEndpointErrors,
      params: ContentEntryParamsSchema,
      payload: StartPdfJobRequestSchema,
      success: PdfJobResponseSchema,
    }
  ),
  HttpApiEndpoint.get(
    'getPdfJob',
    '/applications/:id/content-entries/:entryId/pdf-jobs/:jobId',
    {
      error: registryEndpointErrors,
      params: PdfJobParamsSchema,
      success: PdfJobResponseSchema,
    }
  ),
] as const

assertUniqueHttpApiEndpoints('registry', registryEndpoints)

export const RegistryApi = HttpApiGroup.make('registry')
  // Add one endpoint at a time to preserve each request schema through
  // TypeScript's conditional inference. A single variadic call widens
  // the generated beta.99 client request parts into a union.
  .add(registryEndpoints[0])
  .add(registryEndpoints[1])
  .add(registryEndpoints[2])
  .add(registryEndpoints[3])
  .add(registryEndpoints[4])
  .add(registryEndpoints[5])
  .add(registryEndpoints[6])
  .add(registryEndpoints[7])
  .add(registryEndpoints[8])
  .add(registryEndpoints[9])
  .add(registryEndpoints[10])
  .add(registryEndpoints[11])
  .add(registryEndpoints[12])
  .add(registryEndpoints[13])
  .add(registryEndpoints[14])
  .add(registryEndpoints[15])
  .add(registryEndpoints[16])
  .add(registryEndpoints[17])
  .add(registryEndpoints[18])
  .add(registryEndpoints[19])
  .add(registryEndpoints[20])
  .add(registryEndpoints[21])
  .add(registryEndpoints[22])
  .add(registryEndpoints[23])
  .add(registryEndpoints[24])
  .add(registryEndpoints[25])
  .add(registryEndpoints[26])
  .add(registryEndpoints[27])
  .add(registryEndpoints[28])
  .add(registryEndpoints[29])
  .add(registryEndpoints[30])
  .add(registryEndpoints[31])
  .add(registryEndpoints[32])
  .add(registryEndpoints[33])
  .add(registryEndpoints[34])
  .add(registryEndpoints[35])
  .add(registryEndpoints[36])
  .add(registryEndpoints[37])
  .add(registryEndpoints[38])
  .add(registryEndpoints[39])
  .add(registryEndpoints[40])
  .add(registryEndpoints[41])
  .add(registryEndpoints[42])
  .add(registryEndpoints[43])
  .add(registryEndpoints[44])
  .add(registryEndpoints[45])
  .prefix('/v1')
  .middleware(RegistryAuthorization)

export const ApplicationRegistryApi = HttpApi.make('applicationRegistry').add(
  PublicApi,
  RegistryApi
)
