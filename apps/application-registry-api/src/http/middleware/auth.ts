import {
  FactsPublisherAuthorization,
  RegistryAuthorization,
  ServiceUnavailableError,
  UnauthorizedError,
} from '@cv/application-registry-api-contract'
import {
  authorizeBearerCredential,
  verifyBearerToken,
} from '@cv/effect-http-auth'
import { Effect, Layer, Redacted } from 'effect'

const configuredToken = (
  token: Redacted.Redacted<string>,
  unavailableMessage: string
) => {
  const value = Redacted.value(token).trim()
  return value.length > 0
    ? Effect.succeed(Redacted.make(value))
    : Effect.fail(ServiceUnavailableError.make({ message: unavailableMessage }))
}

const makeTokenVerifier = (
  name: string,
  token: Redacted.Redacted<string>,
  unavailableMessage: string,
  unauthorizedMessage: string
) =>
  Effect.fn(name)(function* (presented: string) {
    return yield* verifyBearerToken(presented, {
      configuredToken: configuredToken(token, unavailableMessage),
      onUnauthorized: () =>
        UnauthorizedError.make({ message: unauthorizedMessage }),
      principal: undefined,
    })
  })

export const makeRegistryAuthorizationLayer = (
  token: Redacted.Redacted<string>
) => {
  const verify = makeTokenVerifier(
    'RegistryAuthorization.verifyBearerToken',
    token,
    'Registry API token is not configured.',
    'Missing or invalid registry API token.'
  )
  return Layer.succeed(
    RegistryAuthorization,
    RegistryAuthorization.of({
      bearer: (httpEffect, { credential }) =>
        authorizeBearerCredential(credential, verify, () => httpEffect),
    })
  )
}

export const makeFactsPublisherAuthorizationLayer = (
  token: Redacted.Redacted<string>
) => {
  const verify = makeTokenVerifier(
    'FactsPublisherAuthorization.verifyBearerToken',
    token,
    'Facts publication token is not configured.',
    'Missing or invalid facts publication token.'
  )
  return Layer.succeed(
    FactsPublisherAuthorization,
    FactsPublisherAuthorization.of({
      bearer: (httpEffect, { credential }) =>
        authorizeBearerCredential(credential, verify, () => httpEffect),
    })
  )
}
