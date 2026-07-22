import {
  AckPolicy,
  DeliverPolicy,
  DiscardPolicy,
  jetstreamManager,
  ReplayPolicy,
  RetentionPolicy,
  StorageType,
} from '@nats-io/jetstream'
import { connect } from '@nats-io/transport-node'
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
  readonly topology?: NatsTestJetStreamTopology
  readonly users?: ReadonlyArray<NatsTestUser>
  readonly username?: string
}

export interface NatsTestUserPermissions {
  readonly publish?: ReadonlyArray<string>
  readonly subscribe?: ReadonlyArray<string>
}

export interface NatsTestUser {
  readonly password: string
  readonly permissions?: NatsTestUserPermissions
  readonly username: string
}

export interface NatsTestJetStreamConsumer {
  readonly ackWaitMilliseconds?: number
  readonly durableName: string
  readonly filterSubjects?: ReadonlyArray<string>
  readonly maxAckPending?: number
  readonly maxDeliver?: number
  readonly maxWaiting?: number
}

export interface NatsTestJetStreamStream {
  readonly consumers?: ReadonlyArray<NatsTestJetStreamConsumer>
  readonly duplicateWindowMilliseconds?: number
  readonly maxAgeMilliseconds?: number
  readonly maxBytes?: number
  readonly maxMessageBytes?: number
  readonly maxMessages?: number
  readonly name: string
  readonly subjects: ReadonlyArray<string>
}

export interface NatsTestJetStreamTopology {
  readonly streams: ReadonlyArray<NatsTestJetStreamStream>
}

export interface NatsTestConnection {
  readonly password: string
  readonly server: string
  readonly username: string
}

export interface StartedNatsTestContainer extends AsyncDisposable {
  readonly container: StartedTestContainer
  readonly password: string
  readonly server: string
  readonly username: string
  readonly dispose: () => Promise<void>
}

const nanoseconds = (milliseconds: number) => milliseconds * 1_000_000

export const provisionNatsTestJetStreamTopology = async (
  connectionConfiguration: NatsTestConnection,
  topology: NatsTestJetStreamTopology
): Promise<void> => {
  const connection = await connect({
    name: 'test-infrastructure-jetstream-provisioner',
    pass: connectionConfiguration.password,
    servers: connectionConfiguration.server,
    user: connectionConfiguration.username,
  })

  try {
    const manager = await jetstreamManager(connection)
    for (const stream of topology.streams) {
      await manager.streams.add({
        discard: DiscardPolicy.Old,
        duplicate_window:
          stream.duplicateWindowMilliseconds === undefined
            ? undefined
            : nanoseconds(stream.duplicateWindowMilliseconds),
        max_age:
          stream.maxAgeMilliseconds === undefined
            ? undefined
            : nanoseconds(stream.maxAgeMilliseconds),
        max_bytes: stream.maxBytes,
        max_msg_size: stream.maxMessageBytes,
        max_msgs: stream.maxMessages,
        name: stream.name,
        num_replicas: 1,
        retention: RetentionPolicy.Limits,
        storage: StorageType.Memory,
        subjects: [...stream.subjects],
      })

      for (const consumer of stream.consumers ?? []) {
        await manager.consumers.add(stream.name, {
          ack_policy: AckPolicy.Explicit,
          ack_wait:
            consumer.ackWaitMilliseconds === undefined
              ? undefined
              : nanoseconds(consumer.ackWaitMilliseconds),
          deliver_policy: DeliverPolicy.All,
          durable_name: consumer.durableName,
          filter_subjects:
            consumer.filterSubjects === undefined
              ? undefined
              : [...consumer.filterSubjects],
          max_ack_pending: consumer.maxAckPending,
          max_deliver: consumer.maxDeliver,
          max_waiting: consumer.maxWaiting,
          name: consumer.durableName,
          replay_policy: ReplayPolicy.Instant,
        })
      }
    }
  } finally {
    await connection.drain().catch(() => connection.close())
  }
}

export const startNatsTestContainer = async (
  options: NatsTestContainerOptions = {}
): Promise<StartedNatsTestContainer> => {
  const username = options.username ?? 'cv'
  const password = options.password ?? 'cv-test-password'
  const additionalUsers = options.users ?? []
  const command =
    additionalUsers.length === 0
      ? ['-js', '--user', username, '--pass', password]
      : ['--config', '/etc/nats/nats.conf']
  let definition = new GenericContainer(
    options.image ?? natsTestImage
  ).withCommand(command)

  if (additionalUsers.length > 0) {
    const configuration = {
      authorization: {
        users: [
          { password, user: username },
          ...additionalUsers.map((user) => ({
            password: user.password,
            permissions: user.permissions,
            user: user.username,
          })),
        ],
      },
      jetstream: { store_dir: '/data' },
    }
    definition = definition.withCopyContentToContainer([
      {
        content: JSON.stringify(configuration),
        target: '/etc/nats/nats.conf',
      },
    ])
  }

  const container = await definition
    .withExposedPorts(natsClientPort)
    .withWaitStrategy(Wait.forLogMessage(/Server is ready/u))
    .start()
  const server = `nats://${container.getHost()}:${container.getMappedPort(natsClientPort)}`
  try {
    if (options.topology !== undefined) {
      await provisionNatsTestJetStreamTopology(
        { password, server, username },
        options.topology
      )
    }
  } catch (error) {
    await container.stop()
    throw error
  }
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
    server,
    username,
    [Symbol.asyncDispose]: dispose,
  }
}
