import {
  type ApplicationLabel,
  ApplicationLabelSchema,
  type ListingCheckRun,
  ListingCheckRunSchema,
} from '@cv/application-registry-entity'
import { Schema } from 'effect'
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from 'effect/unstable/httpapi'

import { RegistryAuthorization } from './auth'
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
  .prefix('/v1')
  .middleware(RegistryAuthorization) {}

export class ApplicationRegistryApi extends HttpApi.make('applicationRegistry')
  .add(PublicApi)
  .add(RegistryApi) {}
