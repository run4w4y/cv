import {
  RegistryAuthorization,
  ServiceUnavailableError,
  UnauthorizedError,
} from '@cv/application-registry-api-contract'
import {
  authorizeBearerCredential,
  verifyBearerToken,
} from '@cv/effect-http-auth'
import { Effect, Layer } from 'effect'

import { WorkerEnv } from '../../worker/bindings'
import {
  provideWorkerConfiguration,
  readRegistryApiToken,
} from '../../worker/config'

const configuredRegistryApiToken = WorkerEnv.pipe(
  Effect.flatMap((env) =>
    readRegistryApiToken.pipe(provideWorkerConfiguration(env))
  ),
  Effect.mapError(() =>
    ServiceUnavailableError.make({
      message: 'Registry API token is not configured.',
    })
  )
)

export const verifyRegistryBearerToken = Effect.fn(
  'RegistryAuthorization.verifyBearerToken'
)(function* (token: string) {
  return yield* verifyBearerToken(token, {
    configuredToken: configuredRegistryApiToken,
    onUnauthorized: () =>
      UnauthorizedError.make({
        message: 'Missing or invalid registry API token.',
      }),
    principal: undefined,
  })
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
