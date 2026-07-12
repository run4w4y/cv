import { Effect, Redacted } from 'effect'
import * as HttpClient from 'effect/unstable/http/HttpClient'
import * as HttpClientRequest from 'effect/unstable/http/HttpClientRequest'

export type BearerTokenVerifierOptions<A, ConfigError, UnauthorizedError, R> = {
  readonly configuredToken: Effect.Effect<
    Redacted.Redacted<string>,
    ConfigError,
    R
  >
  readonly onUnauthorized: () => UnauthorizedError
  readonly principal: A
}

/**
 * Verifies one presented bearer credential while leaving token loading and
 * application-specific errors in the owning application.
 */
export const verifyBearerToken = <A, ConfigError, UnauthorizedError, R>(
  presentedToken: string,
  options: BearerTokenVerifierOptions<A, ConfigError, UnauthorizedError, R>
): Effect.Effect<A, ConfigError | UnauthorizedError, R> =>
  options.configuredToken.pipe(
    Effect.flatMap((configuredToken) =>
      presentedToken === Redacted.value(configuredToken)
        ? Effect.succeed(options.principal)
        : Effect.fail(options.onUnauthorized())
    )
  )

/** Runs a security handler after unwrapping Effect's redacted credential. */
export const authorizeBearerCredential = <A, E, R, B, E2, R2>(
  credential: Redacted.Redacted<string>,
  verify: (token: string) => Effect.Effect<A, E, R>,
  use: (principal: A) => Effect.Effect<B, E2, R2>
): Effect.Effect<B, E | E2, R | R2> =>
  verify(Redacted.value(credential)).pipe(Effect.flatMap(use))

/** Adds a bearer credential at the HTTP client boundary. */
export const withBearerToken = (
  token: Redacted.Redacted<string>
): ((client: HttpClient.HttpClient) => HttpClient.HttpClient) =>
  HttpClient.mapRequest(HttpClientRequest.bearerToken(Redacted.value(token)))
