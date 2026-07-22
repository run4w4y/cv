export const registryEventStreamName = 'REGISTRY_EVENTS'
export const registryEventSubjectRoot = 'registry.events'

export interface RegistryEventNatsConnection {
  readonly clientName: string
  readonly maxReconnectAttempts: number
  readonly password: string
  readonly server: string
  readonly username: string
}

export interface RegistryEventTopology {
  readonly streamName: string
  readonly subjectRoot: string
}

export interface RegistryEventPublisherConfiguration {
  readonly nats: RegistryEventNatsConnection
  readonly topology: RegistryEventTopology
}

export interface RegistryEventConsumerConfiguration {
  readonly consumerName: string
  readonly nats: RegistryEventNatsConnection
  readonly pullExpiresMilliseconds: number
  readonly topology: RegistryEventTopology
}

export const makeRegistryEventTopology = (
  input: Partial<RegistryEventTopology> = {}
): RegistryEventTopology => ({
  streamName: registryEventStreamName,
  subjectRoot: registryEventSubjectRoot,
  ...input,
})

export const makeRegistryEventPublisherConfiguration = (
  input: Omit<RegistryEventPublisherConfiguration, 'topology'> & {
    readonly topology?: Partial<RegistryEventTopology>
  }
): RegistryEventPublisherConfiguration => ({
  nats: input.nats,
  topology: makeRegistryEventTopology(input.topology),
})

export const makeRegistryEventConsumerConfiguration = (
  input: Omit<
    RegistryEventConsumerConfiguration,
    'pullExpiresMilliseconds' | 'topology'
  > &
    Partial<
      Pick<RegistryEventConsumerConfiguration, 'pullExpiresMilliseconds'>
    > & {
      readonly topology?: Partial<RegistryEventTopology>
    }
): RegistryEventConsumerConfiguration => ({
  pullExpiresMilliseconds: 30_000,
  ...input,
  topology: makeRegistryEventTopology(input.topology),
})
