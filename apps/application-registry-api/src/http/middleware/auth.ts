import {
  RegistryAuthorization,
  ServiceUnavailableError,
  UnauthorizedError,
} from '@cv/application-registry-api-contract'
import {
  authorizeBearerCredential,
  verifyBearerToken,
} from '@cv/effect-http-auth'
import { Effect, Layer, Redacted } from 'effect'

import { WorkerEnv } from '../../worker/bindings'

export const verifyRegistryBearerToken = (
  token: string
): Effect.Effect<void, UnauthorizedError | ServiceUnavailableError> =>
  verifyBearerToken(token, {
    configuredToken: WorkerEnv.pipe(
      Effect.flatMap((env) => {
        const value = env.REGISTRY_API_TOKEN?.trim()

        return value
          ? Effect.succeed(Redacted.make(value))
          : Effect.fail(
              ServiceUnavailableError.make({
                message: 'Registry API token is not configured.',
              })
            )
      })
    ),
    onUnauthorized: () =>
      UnauthorizedError.make({
        message: 'Missing or invalid registry API token.',
      }),
    principal: undefined,
  })

export const RegistryAuthorizationLayer = Layer.succeed(
  RegistryAuthorization,
  RegistryAuthorization.of({
    bearer: (httpEffect, { credential }) =>
      authorizeBearerCredential(
        credential,
        verifyRegistryBearerToken,
        () => httpEffect
      ),
  })
)
