import {
  authorizeBearerCredential,
  verifyBearerToken,
} from '@cv/effect-http-auth'
import { Context, Effect, Layer } from 'effect'
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
  verifyBearerToken(token, {
    configuredToken: readGrafanaConnectorToken.pipe(
      withWorkerEnvConfig,
      Effect.mapError(() =>
        ServiceUnavailableError.make({
          message: 'Grafana connector token is not configured.',
        })
      )
    ),
    onUnauthorized: () =>
      UnauthorizedError.make({
        message: 'Missing or invalid Grafana connector token.',
      }),
    principal: { principal: 'grafana' as const },
  })

export const ConnectorAuthorizationLayer = Layer.succeed(
  ConnectorAuthorization,
  ConnectorAuthorization.of({
    bearer: (httpEffect, { credential }) =>
      authorizeBearerCredential(
        credential,
        verifyConnectorBearerToken,
        (principal) =>
          httpEffect.pipe(
            Effect.provideService(AuthenticatedConnectorRequest, principal)
          )
      ),
  })
)
