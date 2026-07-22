import { Context, Effect, Layer, Match, Predicate } from 'effect'
import { FileSystem } from 'effect/FileSystem'
import { Path } from 'effect/Path'

export interface DesktopDiagnosticsShape {
  readonly log: (
    level: 'error' | 'info',
    event: string,
    cause?: unknown
  ) => Effect.Effect<void>
}

export class DesktopDiagnostics extends Context.Service<
  DesktopDiagnostics,
  DesktopDiagnosticsShape
>()('cv-desktop/DesktopDiagnostics') {}

const describeCause = (cause: unknown) =>
  Match.value(cause).pipe(
    Match.when(Predicate.isError, (error) => ({
      message: error.message,
      name: error.name,
      stack: error.stack,
    })),
    Match.when(undefined, () => undefined),
    Match.orElse((cause) => ({ message: String(cause) }))
  )

export const desktopDiagnosticsLayer = (userDataPath: string) =>
  Layer.effect(
    DesktopDiagnostics,
    Effect.gen(function* () {
      const fs = yield* FileSystem
      const path = yield* Path
      const logPath = path.join(userDataPath, 'desktop.log')
      return DesktopDiagnostics.of({
        log: (level, event, cause) =>
          fs
            .writeFileString(
              logPath,
              `${JSON.stringify({
                cause: describeCause(cause),
                event,
                level,
                timestamp: new Date().toISOString(),
              })}\n`,
              { flag: 'a', mode: 0o600 }
            )
            .pipe(Effect.ignore),
      })
    })
  )
