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

const requiredSecret = (name: string) =>
  Config.redacted(name).pipe(
    Effect.flatMap((value) =>
      Redacted.value(value).trim().length > 0
        ? Effect.succeed(value)
        : Effect.fail(
            new RegistryDeployError({ message: `${name} must not be empty.` })
          )
    )
  )

const program = Effect.all({
  chatgptSessionSecret: requiredSecret('CHATGPT_SESSION_SECRET'),
  cloudflareAnalyticsApiToken: requiredSecret('CLOUDFLARE_ANALYTICS_API_TOKEN'),
  registryApiToken: requiredSecret('REGISTRY_API_TOKEN'),
}).pipe(
  Effect.flatMap(
    ({ chatgptSessionSecret, cloudflareAnalyticsApiToken, registryApiToken }) =>
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
                `${JSON.stringify({
                  CHATGPT_SESSION_SECRET: Redacted.value(chatgptSessionSecret),
                  CLOUDFLARE_ANALYTICS_API_TOKEN: Redacted.value(
                    cloudflareAnalyticsApiToken
                  ),
                  REGISTRY_API_TOKEN: Redacted.value(registryApiToken),
                })}\n`,
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
