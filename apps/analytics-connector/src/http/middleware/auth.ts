import { Context, Effect, Layer, Redacted } from 'effect'
import { HttpApiMiddleware, HttpApiSecurity } from 'effect/unstable/httpapi'
import {
  readGrafanaConnectorToken,
  withWorkerEnvConfig,
} from '../../worker/config'
import {
  ServiceUnavailableError,
  ServiceUnavailableErrorSchema,
  UnauthorizedError,
  UnauthorizedErrorSchema,
} from '../errors'

export type AuthenticatedConnectorPrincipal = {
  readonly principal: 'grafana'
}

export class AuthenticatedConnectorRequest extends Context.Service<
  AuthenticatedConnectorRequest,
  AuthenticatedConnectorPrincipal
>()('AuthenticatedConnectorRequest') {}

export class ConnectorAuthorization extends HttpApiMiddleware.Service<
  ConnectorAuthorization,
  { provides: AuthenticatedConnectorRequest }
>()('ConnectorAuthorization', {
  error: [UnauthorizedErrorSchema, ServiceUnavailableErrorSchema],
  security: {
    bearer: HttpApiSecurity.bearer,
  },
}) {}

export const verifyConnectorBearerToken = (
  token: string
): Effect.Effect<
  AuthenticatedConnectorPrincipal,
  UnauthorizedError | ServiceUnavailableError
> =>
  readGrafanaConnectorToken.pipe(
    withWorkerEnvConfig,
    Effect.mapError(() =>
      ServiceUnavailableError.make({
        message: 'Grafana connector token is not configured.',
      })
    ),
    Effect.flatMap((configuredToken) =>
      token === Redacted.value(configuredToken)
        ? Effect.succeed({ principal: 'grafana' as const })
        : Effect.fail(
            UnauthorizedError.make({
              message: 'Missing or invalid Grafana connector token.',
            })
          )
    )
  )

export const ConnectorAuthorizationLayer = Layer.succeed(
  ConnectorAuthorization,
  ConnectorAuthorization.of({
    bearer: (httpEffect, { credential }) =>
      verifyConnectorBearerToken(Redacted.value(credential)).pipe(
        Effect.flatMap((principal) =>
          httpEffect.pipe(
            Effect.provideService(AuthenticatedConnectorRequest, principal)
          )
        )
      ),
  })
)
