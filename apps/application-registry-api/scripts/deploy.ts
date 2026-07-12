import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Config, Data, Effect, Redacted } from 'effect'

class RegistryDeployError extends Data.TaggedError('RegistryDeployError')<{
  readonly cause?: unknown
  readonly message: string
}> {}

const configPath =
  process.argv[2]?.trim() ||
  'apps/application-registry-api/wrangler.deploy.jsonc'
const wranglerCli = fileURLToPath(
  new URL('../../../node_modules/wrangler/bin/wrangler.js', import.meta.url)
)

const runWranglerDeploy = (secretsPath: string) =>
  Effect.tryPromise({
    try: async () => {
      const childProcess = Bun.spawn(
        [
          'node',
          wranglerCli,
          'deploy',
          '--config',
          configPath,
          '--secrets-file',
          secretsPath,
        ],
        {
          stderr: 'inherit',
          stdout: 'inherit',
        }
      )
      const exitCode = await childProcess.exited

      if (exitCode !== 0) {
        throw new Error(`Wrangler exited with code ${exitCode}.`)
      }
    },
    catch: (cause) =>
      new RegistryDeployError({
        cause,
        message: 'Failed to deploy the application registry Worker.',
      }),
  })

const program = Config.redacted('REGISTRY_API_TOKEN').pipe(
  Effect.flatMap((token) =>
    Redacted.value(token).trim().length > 0
      ? Effect.succeed(token)
      : Effect.fail(
          new RegistryDeployError({
            message: 'REGISTRY_API_TOKEN must not be empty.',
          })
        )
  ),
  Effect.flatMap((token) =>
    Effect.acquireUseRelease(
      Effect.tryPromise({
        try: () => mkdtemp(join(tmpdir(), 'cv-registry-deploy-')),
        catch: (cause) =>
          new RegistryDeployError({
            cause,
            message: 'Could not create a temporary secrets directory.',
          }),
      }),
      (directory) => {
        const secretsPath = join(directory, 'registry.secrets.json')

        return Effect.tryPromise({
          try: () =>
            writeFile(
              secretsPath,
              `${JSON.stringify({ REGISTRY_API_TOKEN: Redacted.value(token) })}\n`,
              { mode: 0o600 }
            ),
          catch: (cause) =>
            new RegistryDeployError({
              cause,
              message: 'Could not prepare the registry deployment secret.',
            }),
        }).pipe(Effect.andThen(runWranglerDeploy(secretsPath)))
      },
      (directory) =>
        Effect.promise(() => rm(directory, { force: true, recursive: true }))
    )
  )
)

Effect.runPromise(program).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
