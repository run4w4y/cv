import {
  ApplicationLabelSchema,
  ApplicationSchema,
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
  ApplicationIdentifierParamsSchema,
  CreateCampaignCaptureRequestSchema,
  CreateCampaignCaptureResponseSchema,
  DeleteApplicationResponseSchema,
  HealthResponseSchema,
  ListApplicationCapturesResponseSchema,
  ListApplicationCompensationsQuerySchema,
  ListApplicationCompensationsResponseSchema,
  ListApplicationEventsResponseSchema,
  ListApplicationLabelsResponseSchema,
  ListApplicationsQuerySchema,
  ListApplicationsResponseSchema,
  ListEventsQuerySchema,
  ListEventsResponseSchema,
  PatchApplicationRequestSchema,
  ReplaceApplicationLabelsRequestSchema,
  UpsertApplicationRequestSchema,
} from './schemas'

const registryEndpointErrors = [
  BadRequestErrorSchema,
  NotFoundErrorSchema,
  ConflictErrorSchema,
  InternalServerErrorSchema,
] as const

export class PublicApi extends HttpApiGroup.make('public', {
  topLevel: true,
}).add(
  HttpApiEndpoint.get('health', '/health', {
    success: HealthResponseSchema,
  })
) {}

export class RegistryApi extends HttpApiGroup.make('registry')
  .add(
    HttpApiEndpoint.put('upsertApplication', '/applications', {
      error: registryEndpointErrors,
      payload: UpsertApplicationRequestSchema,
      success: ApplicationSchema,
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
    HttpApiEndpoint.get('getApplication', '/applications/:id', {
      error: registryEndpointErrors,
      params: ApplicationIdentifierParamsSchema,
      success: ApplicationSchema,
    })
  )
  .add(
    HttpApiEndpoint.patch('patchApplication', '/applications/:id', {
      error: registryEndpointErrors,
      params: ApplicationIdentifierParamsSchema,
      payload: PatchApplicationRequestSchema,
      success: ApplicationSchema,
    })
  )
  .add(
    HttpApiEndpoint.delete('deleteApplication', '/applications/:id', {
      error: registryEndpointErrors,
      params: ApplicationIdentifierParamsSchema,
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
        success: Schema.Array(ApplicationLabelSchema),
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
  .prefix('/v1')
  .middleware(RegistryAuthorization) {}

export class ApplicationRegistryApi extends HttpApi.make('applicationRegistry')
  .add(PublicApi)
  .add(RegistryApi) {}
