import {
  type ApplicationLabel,
  ApplicationLabelSchema,
  FactsChannelSchema,
  type ListingCheckRun,
  ListingCheckRunSchema,
} from '@cv/application-registry-entity'
import { Schema } from 'effect'
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from 'effect/unstable/httpapi'

import { RegistryAuthorization } from './auth'
import {
  ActivateFactsReleaseRequestSchema,
  ActiveFactsReleaseQuerySchema,
  ActiveFactsReleaseResponseSchema,
  AppendContentRevisionRequestSchema,
  ApproveContentRevisionRequestSchema,
  BeginPdfArtifactRequestSchema,
  CaptureJobPostingSnapshotResponseSchema,
  CompletePdfArtifactRequestSchema,
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
  FailPdfArtifactRequestSchema,
  GeneratedArtifactResponseSchema,
  JobPostingSnapshotParamsSchema,
  JobPostingSnapshotPayloadParamsSchema,
  JobPostingSnapshotResponseSchema,
  ListContentRevisionsResponseSchema,
  OpaqueObjectResponseSchema,
  OpaquePayloadResponseSchema,
  PdfArtifactParamsSchema,
  PdfWorkflowParamsSchema,
  PdfWorkflowResponseSchema,
  PersistJobPostingSnapshotRequestSchema,
  PublishCvRequestSchema,
  PutOpaqueObjectRequestSchema,
  ReadContentRevisionResponseSchema,
  ReadyPdfArtifactResponseSchema,
  RegisterFactsReleaseRequestSchema,
  SetCvLinkAvailabilityRequestSchema,
  StartPdfWorkflowRequestSchema,
} from './content'
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
  CreateCampaignCaptureRequestSchema,
  CreateCampaignCaptureResponseSchema,
  DeleteApplicationQuerySchema,
  DeleteApplicationResponseSchema,
  HealthResponseSchema,
  ListApplicationCapturesResponseSchema,
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

const registryEndpointErrors = [
  BadRequestErrorSchema,
  NotFoundErrorSchema,
  ConflictErrorSchema,
  InternalServerErrorSchema,
] as const

const ApplicationLabelArrayResponseSchema: Schema.Codec<
  readonly ApplicationLabel[]
> = Schema.revealCodec(Schema.Array(ApplicationLabelSchema))
const ListingCheckRunResponseSchema: Schema.Codec<ListingCheckRun> =
  Schema.revealCodec(ListingCheckRunSchema)

export class PublicApi extends HttpApiGroup.make('public', {
  topLevel: true,
}).add(
  HttpApiEndpoint.get('health', '/health', {
    success: HealthResponseSchema,
  })
) {}

export class RegistryApi extends HttpApiGroup.make('registry')
  .add(
    HttpApiEndpoint.post('createApplication', '/applications', {
      error: registryEndpointErrors,
      payload: CreateApplicationRequestSchema,
      success: ApplicationResponseSchema,
    })
  )
  .add(
    HttpApiEndpoint.put('upsertApplication', '/applications', {
      error: registryEndpointErrors,
      payload: UpsertApplicationRequestSchema,
      success: ApplicationResponseSchema,
    })
  )
  .add(
    HttpApiEndpoint.post('createCapture', '/captures', {
      error: registryEndpointErrors,
      payload: CreateCampaignCaptureRequestSchema,
      success: CreateCampaignCaptureResponseSchema,
    })
  )
  .add(
    HttpApiEndpoint.get('listApplications', '/applications', {
      error: registryEndpointErrors,
      query: ListApplicationsQuerySchema,
      success: ListApplicationsResponseSchema,
    })
  )
  .add(
    HttpApiEndpoint.get('listApplicationFacets', '/applications/facets', {
      error: registryEndpointErrors,
      success: ApplicationFacetsResponseSchema,
    })
  )
  .add(
    HttpApiEndpoint.get('getApplication', '/applications/:id', {
      error: registryEndpointErrors,
      params: ApplicationIdentifierParamsSchema,
      success: ApplicationResponseSchema,
    })
  )
  .add(
    HttpApiEndpoint.patch('patchApplication', '/applications/:id', {
      error: registryEndpointErrors,
      params: ApplicationIdentifierParamsSchema,
      payload: PatchApplicationRequestSchema,
      success: ApplicationResponseSchema,
    })
  )
  .add(
    HttpApiEndpoint.patch(
      'updateManagedApplication',
      '/applications/:id/management',
      {
        error: registryEndpointErrors,
        params: ApplicationIdentifierParamsSchema,
        payload: UpdateManagedApplicationRequestSchema,
        success: UpdateManagedApplicationResponseSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.delete('deleteApplication', '/applications/:id', {
      error: registryEndpointErrors,
      params: ApplicationIdentifierParamsSchema,
      query: DeleteApplicationQuerySchema,
      success: DeleteApplicationResponseSchema,
    })
  )
  .add(
    HttpApiEndpoint.get(
      'listApplicationCaptures',
      '/applications/:id/captures',
      {
        error: registryEndpointErrors,
        params: ApplicationIdentifierParamsSchema,
        success: ListApplicationCapturesResponseSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post('putOpaqueObject', '/objects', {
      error: registryEndpointErrors,
      payload: PutOpaqueObjectRequestSchema,
      success: OpaqueObjectResponseSchema,
    })
  )
  .add(
    HttpApiEndpoint.post('registerFactsRelease', '/facts-releases', {
      error: registryEndpointErrors,
      payload: RegisterFactsReleaseRequestSchema,
      success: FactsReleaseRecordResponseSchema,
    })
  )
  .add(
    HttpApiEndpoint.get('getActiveFactsRelease', '/facts-releases/active', {
      error: registryEndpointErrors,
      query: ActiveFactsReleaseQuerySchema,
      success: ActiveFactsReleaseResponseSchema,
    })
  )
  .add(
    HttpApiEndpoint.get('getFactsRelease', '/facts-releases/:releaseId', {
      error: registryEndpointErrors,
      params: FactsReleaseParamsSchema,
      success: FactsReleaseRecordResponseSchema,
    })
  )
  .add(
    HttpApiEndpoint.put(
      'activateFactsRelease',
      '/facts-releases/channels/:channel',
      {
        error: registryEndpointErrors,
        params: FactsChannelParamsSchema,
        payload: ActivateFactsReleaseRequestSchema,
        success: FactsChannelSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.get(
      'listApplicationCompensations',
      '/applications/:id/compensations',
      {
        error: registryEndpointErrors,
        params: ApplicationIdentifierParamsSchema,
        query: ListApplicationCompensationsQuerySchema,
        success: ListApplicationCompensationsResponseSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.put(
      'replaceAnnualCompensation',
      '/applications/:id/annual-compensation',
      {
        error: registryEndpointErrors,
        params: ApplicationIdentifierParamsSchema,
        payload: ReplaceAnnualCompensationRequestSchema,
        success: ReplaceAnnualCompensationResponseSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.get('listApplicationEvents', '/applications/:id/events', {
      error: registryEndpointErrors,
      params: ApplicationIdentifierParamsSchema,
      success: ListApplicationEventsResponseSchema,
    })
  )
  .add(
    HttpApiEndpoint.post('appendApplicationEvent', '/applications/:id/events', {
      error: registryEndpointErrors,
      params: ApplicationIdentifierParamsSchema,
      payload: AppendApplicationEventRequestSchema,
      success: AppendApplicationEventResponseSchema,
    })
  )
  .add(
    HttpApiEndpoint.get(
      'listApplicationAnnotations',
      '/applications/:id/annotations',
      {
        error: registryEndpointErrors,
        params: ApplicationIdentifierParamsSchema,
        success: ApplicationAnnotationsResponseSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.get('listApplicationLabels', '/applications/:id/labels', {
      error: registryEndpointErrors,
      params: ApplicationIdentifierParamsSchema,
      success: ListApplicationLabelsResponseSchema,
    })
  )
  .add(
    HttpApiEndpoint.put(
      'replaceApplicationLabels',
      '/applications/:id/labels',
      {
        error: registryEndpointErrors,
        params: ApplicationIdentifierParamsSchema,
        payload: ReplaceApplicationLabelsRequestSchema,
        success: ApplicationLabelArrayResponseSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post('addApplicationNote', '/applications/:id/notes', {
      error: registryEndpointErrors,
      params: ApplicationIdentifierParamsSchema,
      payload: AddApplicationNoteRequestSchema,
      success: AddApplicationNoteResponseSchema,
    })
  )
  .add(
    HttpApiEndpoint.get('listEvents', '/events', {
      error: registryEndpointErrors,
      query: ListEventsQuerySchema,
      success: ListEventsResponseSchema,
    })
  )
  .add(
    HttpApiEndpoint.get(
      'listApplicationListingChecks',
      '/applications/:id/listing-checks',
      {
        error: registryEndpointErrors,
        params: ApplicationIdentifierParamsSchema,
        success: ListApplicationListingChecksResponseSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.put(
      'resolveApplicationListingAvailability',
      '/applications/:id/listing-availability',
      {
        error: registryEndpointErrors,
        params: ApplicationIdentifierParamsSchema,
        payload: ResolveListingAvailabilityRequestSchema,
        success: ResolveListingAvailabilityResponseSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post(
      'submitListingCheckFindings',
      '/listing-check-findings',
      {
        error: registryEndpointErrors,
        payload: SubmitListingCheckFindingsRequestSchema,
        success: SubmitListingCheckFindingsResponseSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.get('getListingCheckRun', '/listing-check-runs/:id', {
      error: registryEndpointErrors,
      params: ListingCheckRunIdentifierParamsSchema,
      success: ListingCheckRunResponseSchema,
    })
  )
  .add(
    HttpApiEndpoint.post(
      'captureJobPostingSnapshot',
      '/applications/:id/job-snapshots/capture',
      {
        error: registryEndpointErrors,
        params: ApplicationIdentifierParamsSchema,
        success: CaptureJobPostingSnapshotResponseSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post(
      'persistJobPostingSnapshot',
      '/applications/:id/job-snapshots',
      {
        error: registryEndpointErrors,
        params: ApplicationIdentifierParamsSchema,
        payload: PersistJobPostingSnapshotRequestSchema,
        success: JobPostingSnapshotResponseSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.get(
      'getLatestJobPostingSnapshot',
      '/applications/:id/job-snapshots/latest',
      {
        error: registryEndpointErrors,
        params: ApplicationIdentifierParamsSchema,
        success: JobPostingSnapshotResponseSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.get(
      'getJobPostingSnapshot',
      '/applications/:id/job-snapshots/:snapshotId',
      {
        error: registryEndpointErrors,
        params: JobPostingSnapshotParamsSchema,
        success: JobPostingSnapshotResponseSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.get(
      'getJobPostingSnapshotPayload',
      '/applications/:id/job-snapshots/:snapshotId/payloads/:kind',
      {
        error: registryEndpointErrors,
        params: JobPostingSnapshotPayloadParamsSchema,
        success: OpaquePayloadResponseSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post(
      'ensureContentEntry',
      '/applications/:id/content-entries',
      {
        error: registryEndpointErrors,
        params: ApplicationIdentifierParamsSchema,
        payload: EnsureContentEntryRequestSchema,
        success: ContentEntryResponseSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.get(
      'getContentEntry',
      '/applications/:id/content-entries/:entryId',
      {
        error: registryEndpointErrors,
        params: ContentEntryParamsSchema,
        success: ContentEntryResponseSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.get(
      'listContentRevisions',
      '/applications/:id/content-entries/:entryId/revisions',
      {
        error: registryEndpointErrors,
        params: ContentEntryParamsSchema,
        success: ListContentRevisionsResponseSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post(
      'appendContentRevision',
      '/applications/:id/content-entries/:entryId/revisions',
      {
        error: registryEndpointErrors,
        params: ContentEntryParamsSchema,
        payload: AppendContentRevisionRequestSchema,
        success: ContentRevisionResultResponseSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.get(
      'readContentRevision',
      '/applications/:id/content-entries/:entryId/revisions/:revisionId',
      {
        error: registryEndpointErrors,
        params: ContentRevisionParamsSchema,
        success: ReadContentRevisionResponseSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post(
      'approveContentRevision',
      '/applications/:id/content-entries/:entryId/approval',
      {
        error: registryEndpointErrors,
        params: ContentEntryParamsSchema,
        payload: ApproveContentRevisionRequestSchema,
        success: ContentRevisionResultResponseSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post(
      'publishCv',
      '/applications/:id/content-entries/:entryId/publication',
      {
        error: registryEndpointErrors,
        params: ContentEntryParamsSchema,
        payload: PublishCvRequestSchema,
        success: CvLinkResponseSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.get(
      'getCvLink',
      '/applications/:id/content-entries/:entryId/publication',
      {
        error: registryEndpointErrors,
        params: ContentEntryParamsSchema,
        success: CvLinkResponseSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.put(
      'setCvLinkAvailability',
      '/applications/:id/content-entries/:entryId/publication/availability',
      {
        error: registryEndpointErrors,
        params: ContentEntryParamsSchema,
        payload: SetCvLinkAvailabilityRequestSchema,
        success: CvLinkResponseSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post(
      'disableApplicationCvLinks',
      '/applications/:id/cv-links/disable',
      {
        error: registryEndpointErrors,
        params: ApplicationIdentifierParamsSchema,
        payload: DisableApplicationCvLinksRequestSchema,
        success: DisableApplicationCvLinksResponseSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post(
      'beginPdfArtifact',
      '/applications/:id/content-entries/:entryId/pdf-artifacts',
      {
        error: registryEndpointErrors,
        params: ContentEntryParamsSchema,
        payload: BeginPdfArtifactRequestSchema,
        success: GeneratedArtifactResponseSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post(
      'completePdfArtifact',
      '/applications/:id/pdf-artifacts/:artifactId/complete',
      {
        error: registryEndpointErrors,
        params: PdfArtifactParamsSchema,
        payload: CompletePdfArtifactRequestSchema,
        success: GeneratedArtifactResponseSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post(
      'failPdfArtifact',
      '/applications/:id/pdf-artifacts/:artifactId/fail',
      {
        error: registryEndpointErrors,
        params: PdfArtifactParamsSchema,
        payload: FailPdfArtifactRequestSchema,
        success: GeneratedArtifactResponseSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.get(
      'getCurrentPdfArtifact',
      '/applications/:id/content-entries/:entryId/pdf-artifacts/current',
      {
        error: registryEndpointErrors,
        params: CurrentPdfArtifactParamsSchema,
        query: CurrentPdfArtifactQuerySchema,
        success: GeneratedArtifactResponseSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.get(
      'readCurrentPdfArtifact',
      '/applications/:id/content-entries/:entryId/pdf-artifacts/current/content',
      {
        error: registryEndpointErrors,
        params: CurrentPdfArtifactParamsSchema,
        query: CurrentPdfArtifactQuerySchema,
        success: ReadyPdfArtifactResponseSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.post(
      'startPdfWorkflow',
      '/applications/:id/content-entries/:entryId/pdf-workflow',
      {
        error: registryEndpointErrors,
        params: ContentEntryParamsSchema,
        payload: StartPdfWorkflowRequestSchema,
        success: PdfWorkflowResponseSchema,
      }
    )
  )
  .add(
    HttpApiEndpoint.get(
      'getPdfWorkflow',
      '/applications/:id/content-entries/:entryId/pdf-workflow/:workflowId',
      {
        error: registryEndpointErrors,
        params: PdfWorkflowParamsSchema,
        success: PdfWorkflowResponseSchema,
      }
    )
  )
  .prefix('/v1')
  .middleware(RegistryAuthorization) {}

export class ApplicationRegistryApi extends HttpApi.make('applicationRegistry')
  .add(PublicApi)
  .add(RegistryApi) {}
