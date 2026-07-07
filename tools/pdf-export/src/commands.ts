import { Effect } from 'effect'
import * as ChildProcess from 'effect/unstable/process/ChildProcess'
import { ChildProcessSpawner } from 'effect/unstable/process/ChildProcessSpawner'
import { PdfProcessError } from './errors'
import { root } from './paths'

const formatCommand = (command: string, args: ReadonlyArray<string>) =>
  [command, ...args].join(' ')

export const runCommand = (
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
  cwd = root
) => {
  const commandLabel = formatCommand(command, args)

  return Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner
    const processCommand = ChildProcess.make(command, args, {
      cwd,
      env,
      stderr: 'inherit',
      stdin: 'inherit',
      stdout: 'inherit',
    })
    const exitCode = yield* spawner.exitCode(processCommand)

    return yield* Number(exitCode) === 0
      ? Effect.void
      : Effect.fail(
          new PdfProcessError({
            cause: new Error(`${commandLabel} exited with ${exitCode}`),
            command: commandLabel,
            message: `Command failed with exit code ${exitCode}: ${commandLabel}`,
          })
        )
  }).pipe(
    Effect.mapError((cause) =>
      cause instanceof PdfProcessError
        ? cause
        : new PdfProcessError({
            cause,
            command: commandLabel,
            message: `Command failed: ${commandLabel}`,
          })
    )
  )
}
