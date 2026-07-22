import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql'

export const postgresTestImage = 'postgres:17.5-alpine'

export interface PostgresTestContainerOptions {
  readonly database?: string
  readonly image?: string
  readonly initScriptPath?: string
  readonly password?: string
  readonly username?: string
}

export interface StartedPostgresTestContainer extends AsyncDisposable {
  readonly container: StartedPostgreSqlContainer
  readonly database: string
  readonly host: string
  readonly password: string
  readonly port: number
  readonly username: string
  readonly url: string
  readonly dispose: () => Promise<void>
}

export const startPostgresTestContainer = async (
  options: PostgresTestContainerOptions = {}
): Promise<StartedPostgresTestContainer> => {
  let definition = new PostgreSqlContainer(options.image ?? postgresTestImage)
    .withDatabase(options.database ?? 'application')
    .withUsername(options.username ?? 'application')
    .withPassword(options.password ?? 'application-test')
  if (options.initScriptPath !== undefined) {
    definition = definition.withCopyFilesToContainer([
      {
        source: options.initScriptPath,
        target: '/docker-entrypoint-initdb.d/001-schema.sql',
      },
    ])
  }
  const container = await definition.start()
  let disposed = false
  const dispose = async () => {
    if (disposed) return
    disposed = true
    await container.stop()
  }

  return {
    container,
    database: container.getDatabase(),
    dispose,
    host: container.getHost(),
    password: container.getPassword(),
    port: container.getPort(),
    username: container.getUsername(),
    url: container.getConnectionUri(),
    [Symbol.asyncDispose]: dispose,
  }
}
