import {
  ApplicationRegistryApi,
  BadRequestError,
  ConflictError,
  InternalServerError,
  NotFoundError,
} from '@cv/application-registry-api-contract'
import {
  AnnotationsService,
  type ApplicationRegistryError,
  ApplicationsService,
  CapturesService,
  CompensationsService,
  EventsService,
  ListingChecksService,
} from '@cv/application-registry-service'
import { Effect, Match } from 'effect'
import { HttpApiBuilder } from 'effect/unstable/httpapi'

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
  Match.tag('RegistryDatabaseError', (error) =>
    InternalServerError.make({ message: error.message })
  ),
  Match.exhaustive
)

const expose = <A>(effect: Effect.Effect<A, ApplicationRegistryError>) =>
  effect.pipe(Effect.mapError(toApiError))

export const RegistryHandlersLayer = HttpApiBuilder.group(
  ApplicationRegistryApi,
  'registry',
  (handlers) =>
    Effect.gen(function* () {
      const annotations = yield* AnnotationsService
      const applications = yield* ApplicationsService
      const captures = yield* CapturesService
      const compensations = yield* CompensationsService
      const events = yield* EventsService
      const listingChecks = yield* ListingChecksService

      return handlers
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
          expose(applications.patch(params.id, payload))
        )
        .handle('deleteApplication', ({ params }) =>
          expose(applications.remove(params.id))
        )
        .handle('listApplicationCaptures', ({ params }) =>
          expose(captures.listByApplication(params.id))
        )
        .handle('listApplicationCompensations', ({ params, query }) =>
          expose(compensations.listByApplication(params.id, query.currency))
        )
        .handle('listApplicationEvents', ({ params }) =>
          expose(events.listByApplication(params.id))
        )
        .handle('appendApplicationEvent', ({ params, payload }) =>
          expose(events.append(params.id, payload))
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
          expose(applications.replaceLabels(params.id, payload.labels))
        )
        .handle('addApplicationNote', ({ params, payload }) =>
          expose(annotations.addNote(params.id, payload))
        )
        .handle('listEvents', ({ query }) => expose(events.list(query)))
        .handle('listApplicationListingChecks', ({ params }) =>
          expose(listingChecks.listByApplication(params.id))
        )
        .handle('submitListingCheckFindings', ({ payload }) =>
          expose(listingChecks.submitFindings(payload))
        )
        .handle('getListingCheckRun', ({ params }) =>
          expose(listingChecks.findRun(params.id))
        )
    })
)
