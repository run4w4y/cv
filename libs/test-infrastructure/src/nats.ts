import {
  GenericContainer,
  type StartedTestContainer,
  Wait,
} from 'testcontainers'

export const natsTestImage = 'nats:2.14.3-alpine'

const natsClientPort = 4222

export interface NatsTestContainerOptions {
  readonly image?: string
  readonly password?: string
  readonly username?: string
}

export interface StartedNatsTestContainer extends AsyncDisposable {
  readonly container: StartedTestContainer
  readonly password: string
  readonly server: string
  readonly username: string
  readonly dispose: () => Promise<void>
}

export const startNatsTestContainer = async (
  options: NatsTestContainerOptions = {}
): Promise<StartedNatsTestContainer> => {
  const username = options.username ?? 'cv'
  const password = options.password ?? 'cv-test-password'
  const container = await new GenericContainer(options.image ?? natsTestImage)
    .withCommand(['-js', '--user', username, '--pass', password])
    .withExposedPorts(natsClientPort)
    .withWaitStrategy(Wait.forLogMessage(/Server is ready/u))
    .start()
  let disposed = false
  const dispose = async () => {
    if (disposed) return
    disposed = true
    await container.stop()
  }

  return {
    container,
    dispose,
    password,
    server: `nats://${container.getHost()}:${container.getMappedPort(natsClientPort)}`,
    username,
    [Symbol.asyncDispose]: dispose,
  }
}
