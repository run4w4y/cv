import {
  ApplicationRegistryApi,
  BadRequestError,
  ConflictError,
  factsPublicationProtocolV1ContractId,
  InternalServerError,
  NotFoundError,
} from '@cv/application-registry-api-contract'
import {
  factsCurrentPointerV2ContractId,
  factsReleaseBundleV1ContractId,
  factsReleaseManifestV2ContractId,
} from '@cv/facts-release'
import { Effect, Match } from 'effect'
import { HttpApiBuilder } from 'effect/unstable/httpapi'

import { FactsRegistry, type FactsRegistryError } from '../../facts/registry'

const toApiError = Match.type<FactsRegistryError>().pipe(
  Match.when(
    (error) => error.issue === 'invalid-bundle',
    (error) => BadRequestError.make({ message: error.message })
  ),
  Match.when(
    (error) => error.issue === 'not-found',
    (error) => NotFoundError.make({ message: error.message })
  ),
  Match.when(
    (error) => error.issue === 'conflict',
    (error) => ConflictError.make({ message: error.message })
  ),
  Match.orElse((error) => InternalServerError.make({ message: error.message }))
)

const expose = <A>(effect: Effect.Effect<A, FactsRegistryError>) =>
  effect.pipe(Effect.mapError(toApiError))

export const FactsPublicationHandlersLayer = HttpApiBuilder.group(
  ApplicationRegistryApi,
  'factsPublication',
  (handlers) =>
    Effect.gen(function* () {
      const facts = yield* FactsRegistry
      return handlers.handleAll({
        activateRelease: ({ payload }) => expose(facts.activate(payload)),
        getCapabilities: () =>
          Effect.succeed({
            bundleContract: factsReleaseBundleV1ContractId,
            pointerContract: factsCurrentPointerV2ContractId,
            protocol: factsPublicationProtocolV1ContractId,
            releaseContract: factsReleaseManifestV2ContractId,
          }),
        getCurrentRelease: () =>
          expose(facts.current()).pipe(
            Effect.flatMap((current) =>
              current === null
                ? Effect.fail(
                    NotFoundError.make({
                      message: 'No facts release is active.',
                    })
                  )
                : Effect.succeed(current)
            )
          ),
        registerRelease: ({ params, payload }) =>
          expose(facts.register(params.releaseId, payload)),
      })
    })
)
