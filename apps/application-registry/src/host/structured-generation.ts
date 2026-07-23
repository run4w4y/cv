import {
  StructuredGeneration,
  StructuredGenerationError,
  type StructuredGenerationErrorKind,
  type StructuredGenerationRequest,
  type StructuredGenerationShape,
} from '@cv/application-preparation-workflow'
import type {
  DesktopBridgeError,
  DesktopCodexBridge,
} from '@cv/application-registry-desktop-contract'
import { Effect, Layer, Match } from 'effect'

import { desktopBridge } from './desktop'

const errorKind = (error: DesktopBridgeError): StructuredGenerationErrorKind =>
  Match.value(error.code).pipe(
    Match.when('codex_cancelled', () => 'cancelled' as const),
    Match.when('codex_not_authenticated', () => 'authentication' as const),
    Match.when('codex_rate_limited', () => 'rate-limited' as const),
    Match.when('codex_output_invalid', () => 'invalid-output' as const),
    Match.whenOr(
      'configuration_invalid',
      'invalid_request',
      () => 'invalid-request' as const
    ),
    Match.whenOr(
      'codex_model_unavailable',
      'codex_not_available',
      'codex_startup_failed',
      'codex_state_initialization_failed',
      'encryption_unavailable',
      'registry_not_configured',
      'registry_unauthorized',
      'settings_corrupt',
      () => 'unavailable' as const
    ),
    Match.whenOr(
      'codex_generation_failed',
      'network_failed',
      'settings_io_failed',
      () => 'failed' as const
    ),
    Match.exhaustive
  )

const generationError = (error: DesktopBridgeError) =>
  new StructuredGenerationError({
    cause: error,
    kind: errorKind(error),
    message: error.message,
    retryAfterSeconds: error.retryAfterSeconds ?? null,
  })

const transportError = (cause: unknown) =>
  new StructuredGenerationError({
    cause,
    kind: 'failed',
    message: 'The Electron Codex bridge did not answer.',
    retryAfterSeconds: null,
  })

export const makeDesktopStructuredGeneration = (
  bridge: DesktopCodexBridge
): StructuredGenerationShape => ({
  generate: Effect.fn('StructuredGeneration.Desktop.generate')(function* (
    request: StructuredGenerationRequest
  ) {
    const operationId = globalThis.crypto.randomUUID()
    const result = yield* Effect.tryPromise({
      try: async (signal) => {
        const cancel = () => {
          void bridge.cancel(operationId)
        }
        signal.addEventListener('abort', cancel, { once: true })
        try {
          return await bridge.generate({
            instructions: request.instructions,
            operationId,
            outputSchema: request.outputSchema,
            prompt: request.prompt,
          })
        } finally {
          signal.removeEventListener('abort', cancel)
        }
      },
      catch: transportError,
    })
    if (!result.ok) return yield* Effect.fail(generationError(result.error))
    return {
      executor: 'codex-local',
      output: result.value.output,
      usage: result.value.usage,
    }
  }),
})

const unavailableStructuredGeneration = (
  message: string
): StructuredGenerationShape => ({
  generate: Effect.fn('StructuredGeneration.Unavailable.generate')(
    function* () {
      return yield* Effect.fail(
        new StructuredGenerationError({
          cause: new Error(message),
          kind: 'unavailable',
          message,
          retryAfterSeconds: null,
        })
      )
    }
  ),
})

export const hostStructuredGenerationLayer = () => {
  const bridge = desktopBridge()
  return Layer.succeed(
    StructuredGeneration,
    bridge === null
      ? unavailableStructuredGeneration(
          'Structured generation is available in the local Registry desktop app.'
        )
      : makeDesktopStructuredGeneration(bridge.codex)
  )
}
