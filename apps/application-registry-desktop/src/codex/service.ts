import type {
  DesktopCodexGenerationRequest,
  DesktopCodexGenerationResult,
  DesktopCodexStatus,
} from '@cv/application-registry-desktop-contract'
import { Context, Effect, Layer } from 'effect'
import { FileSystem } from 'effect/FileSystem'

import { CodexSdk, CodexSdkError, normalizeCodexSdkError } from './sdk'

export interface DesktopCodexShape {
  readonly cancel: (operationId: string) => Effect.Effect<void>
  readonly generate: (
    request: DesktopCodexGenerationRequest
  ) => Effect.Effect<DesktopCodexGenerationResult, CodexSdkError>
  readonly status: Effect.Effect<DesktopCodexStatus>
}

export class DesktopCodex extends Context.Service<
  DesktopCodex,
  DesktopCodexShape
>()('cv-desktop/DesktopCodex') {}

export const desktopCodexLayer = (options: {
  readonly environment?: NodeJS.ProcessEnv
  readonly executable?: string
  readonly temporaryPath: string
}) =>
  Layer.effect(
    DesktopCodex,
    Effect.gen(function* () {
      const fs = yield* FileSystem
      const sdk = new CodexSdk({
        environment: options.environment,
        executable: options.executable,
      })

      const status = Effect.gen(function* () {
        const executable = sdk.executable ?? null
        const available =
          executable === null
            ? true
            : yield* fs
                .exists(executable)
                .pipe(Effect.orElseSucceed(() => false))
        return {
          available,
          executable,
          message: available
            ? 'Codex is available and will use the sign-in for this Windows account.'
            : `The packaged Codex executable is missing at ${executable}.`,
        } satisfies DesktopCodexStatus
      })

      const generate = Effect.fn('DesktopCodex.generate')(
        (request: DesktopCodexGenerationRequest) =>
          Effect.scoped(
            Effect.gen(function* () {
              const workingDirectory = yield* fs
                .makeTempDirectoryScoped({
                  directory: options.temporaryPath,
                  prefix: 'cv-registry-codex-',
                })
                .pipe(
                  Effect.mapError(
                    (cause) =>
                      new CodexSdkError(
                        'codex_state_initialization_failed',
                        'Codex could not create an isolated working directory.',
                        String(cause)
                      )
                  )
                )
              return yield* Effect.tryPromise({
                try: (signal) => {
                  const cancel = () => sdk.cancel(request.operationId)
                  signal.addEventListener('abort', cancel, { once: true })
                  return sdk
                    .generate(request, workingDirectory)
                    .finally(() => signal.removeEventListener('abort', cancel))
                },
                catch: normalizeCodexSdkError,
              })
            })
          )
      )

      return DesktopCodex.of({
        cancel: (operationId) => Effect.sync(() => sdk.cancel(operationId)),
        generate,
        status,
      })
    })
  )
