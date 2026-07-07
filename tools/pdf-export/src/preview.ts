import { createServer } from 'node:net'
import { join } from 'node:path'
import { Effect, Schedule, Stream } from 'effect'
import * as HttpClient from 'effect/unstable/http/HttpClient'
import * as HttpClientResponse from 'effect/unstable/http/HttpClientResponse'
import * as ChildProcess from 'effect/unstable/process/ChildProcess'
import type { ChildProcessHandle } from 'effect/unstable/process/ChildProcessSpawner'
import { PdfNetworkError, PdfProcessError, PdfUsageError } from './errors'
import { cvAppRoot, root } from './paths'

export type PreviewServer = {
  baseUrl: string
  preview: ChildProcessHandle
}

const isPortAvailable = (port: number) =>
  Effect.tryPromise({
    try: () =>
      new Promise<boolean>((resolve) => {
        const server = createServer()

        server.once('error', () => resolve(false))
        server.once('listening', () => {
          server.close(() => resolve(true))
        })
        server.listen(port, '127.0.0.1')
      }),
    catch: (cause) =>
      new PdfProcessError({
        cause,
        message: `Could not inspect local preview port ${port}`,
      }),
  })

const findAvailablePort = (
  candidate: number,
  exclusiveEndPort: number,
  startPort: number
): Effect.Effect<number, PdfProcessError | PdfUsageError> =>
  candidate >= exclusiveEndPort
    ? PdfUsageError.fail(
        `No available local preview port found after ${startPort}`
      )
    : isPortAvailable(candidate).pipe(
        Effect.flatMap((available) =>
          available
            ? Effect.succeed(candidate)
            : findAvailablePort(candidate + 1, exclusiveEndPort, startPort)
        )
      )

const getAvailablePort = (startPort: number) =>
  findAvailablePort(startPort, startPort + 50, startPort)

const drainProcessStream = (
  stream: Stream.Stream<Uint8Array, unknown>,
  write: (chunk: Uint8Array) => boolean
) =>
  Stream.runForEach(stream, (chunk) =>
    Effect.sync(() => {
      write(chunk)
    })
  ).pipe(Effect.catch(() => Effect.void))

const pipeProcessOutput = (handle: ChildProcessHandle) =>
  Effect.all(
    [
      drainProcessStream(handle.stdout, (chunk) => process.stdout.write(chunk)),
      drainProcessStream(handle.stderr, (chunk) => process.stderr.write(chunk)),
    ],
    { concurrency: 2 }
  ).pipe(Effect.asVoid)

const spawnLoggedProcess = (
  command: string,
  args: ReadonlyArray<string>,
  options: ChildProcess.CommandOptions = {}
) =>
  ChildProcess.make(command, args, {
    ...options,
    stderr: options.stderr ?? 'pipe',
    stdout: options.stdout ?? 'pipe',
  }).pipe(
    Effect.tap((handle) => pipeProcessOutput(handle).pipe(Effect.forkScoped))
  )

export const startPreview = (preferredPort = 4322) =>
  getAvailablePort(preferredPort).pipe(
    Effect.flatMap((port) => {
      const baseUrl = `http://127.0.0.1:${port}`

      return spawnLoggedProcess(
        join(root, 'node_modules', '.bin', 'astro'),
        [
          'preview',
          '--host',
          '127.0.0.1',
          '--port',
          String(port),
          '--strictPort',
        ],
        {
          cwd: cvAppRoot,
          detached: true,
          env: {
            ...process.env,
            ASTRO_TELEMETRY_DISABLED: '1',
          },
          stdin: 'ignore',
        }
      ).pipe(
        Effect.mapError(
          (cause) =>
            new PdfProcessError({
              cause,
              command: 'astro preview',
              message: 'Could not start Astro preview',
            })
        ),
        Effect.map((preview) => ({ baseUrl, preview }) satisfies PreviewServer)
      )
    })
  )

export const stopPreview = (preview: ChildProcessHandle) =>
  preview
    .kill({
      forceKillAfter: '2 seconds',
      killSignal: 'SIGTERM',
    })
    .pipe(
      Effect.mapError(
        (cause) =>
          new PdfProcessError({
            cause,
            message: `Could not stop preview process ${preview.pid}`,
          })
      )
    )

const previewReadySchedule = Schedule.spaced('200 millis').pipe(
  Schedule.both(Schedule.recurs(49))
)

const requestOk = (url: string) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient

    yield* client
      .get(url)
      .pipe(Effect.flatMap(HttpClientResponse.filterStatusOk))
  }).pipe(Effect.asVoid)

const waitForServerUrl = (url: string) =>
  requestOk(url).pipe(
    Effect.retry(previewReadySchedule),
    Effect.mapError(
      (cause) =>
        new PdfNetworkError({
          cause,
          message: `Astro preview did not become available at ${url}`,
          url,
        })
    )
  )

export const waitForServer = (baseUrl: string, path = '/en/') =>
  waitForServerUrl(`${baseUrl}${path}`)
