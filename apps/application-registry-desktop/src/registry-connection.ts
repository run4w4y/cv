import {
  applicationRegistryApiPrefix,
  HealthResponseSchema,
} from '@cv/application-registry-api-contract'
import type {
  DesktopRegistryConfiguration,
  DesktopRegistryConfigureInput,
} from '@cv/application-registry-desktop-contract'
import { Context, type Duration, Effect, Layer, Redacted, Schema } from 'effect'
import { HttpClient, HttpClientRequest } from 'effect/unstable/http'

import {
  DesktopSettings,
  type DesktopSettingsError,
  type RegistryCredentials,
} from './settings'

export class DesktopRegistryConnectionError extends Schema.TaggedErrorClass<DesktopRegistryConnectionError>()(
  'DesktopRegistryConnectionError',
  {
    cause: Schema.Defect(),
    code: Schema.Literals(['network_failed', 'registry_unauthorized']),
    message: Schema.String,
  }
) {}

const connectionError = (
  code: DesktopRegistryConnectionError['code'],
  message: string,
  cause: unknown
) => new DesktopRegistryConnectionError({ cause, code, message })

const verificationError = (cause: unknown) =>
  Schema.is(DesktopRegistryConnectionError)(cause)
    ? cause
    : connectionError(
        'network_failed',
        'The Registry API could not be reached.',
        cause
      )

export interface DesktopRegistryConnectionShape {
  readonly configure: (
    input: DesktopRegistryConfigureInput
  ) => Effect.Effect<
    DesktopRegistryConfiguration,
    DesktopRegistryConnectionError | DesktopSettingsError
  >
}

export class DesktopRegistryConnection extends Context.Service<
  DesktopRegistryConnection,
  DesktopRegistryConnectionShape
>()('cv-desktop/DesktopRegistryConnection') {}

export const desktopRegistryConnectionLayer = (
  options: { readonly verificationTimeout?: Duration.Input } = {}
) =>
  Layer.effect(
    DesktopRegistryConnection,
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient
      const settings = yield* DesktopSettings

      const verify = Effect.fn('DesktopRegistryConnection.verify')(
        function* (credentials: RegistryCredentials) {
          const request = HttpClientRequest.get(
            new URL(
              `${applicationRegistryApiPrefix}/health`,
              credentials.origin
            )
          ).pipe(
            HttpClientRequest.acceptJson,
            HttpClientRequest.bearerToken(Redacted.value(credentials.token))
          )
          const response = yield* client.execute(request)

          if (response.status === 401 || response.status === 403) {
            return yield* Effect.fail(
              connectionError(
                'registry_unauthorized',
                'The Registry API rejected the bearer token.',
                new Error(String(response.status))
              )
            )
          }
          if (response.status !== 200) {
            return yield* Effect.fail(
              connectionError(
                'network_failed',
                `The Registry health check returned HTTP ${response.status}.`,
                new Error(String(response.status))
              )
            )
          }

          const payload = yield* response.json.pipe(
            Effect.flatMap(Schema.decodeUnknownEffect(HealthResponseSchema)),
            Effect.mapError((cause) =>
              connectionError(
                'network_failed',
                'The Registry health check returned an invalid response.',
                cause
              )
            )
          )
          if (!payload.ok) {
            return yield* Effect.fail(
              connectionError(
                'network_failed',
                'The Registry health check did not report a healthy service.',
                new Error('Unhealthy Registry response')
              )
            )
          }
        },
        (effect) =>
          effect.pipe(
            Effect.timeout(options.verificationTimeout ?? '15 seconds'),
            Effect.mapError(verificationError)
          )
      )

      const configure = Effect.fn('DesktopRegistryConnection.configure')(
        function* (input: DesktopRegistryConfigureInput) {
          const credentials = yield* settings.resolveUpdate(input)
          yield* verify(credentials)
          return yield* settings.write(credentials)
        }
      )

      return DesktopRegistryConnection.of({ configure })
    })
  )
