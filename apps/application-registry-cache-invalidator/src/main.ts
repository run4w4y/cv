import {
  makeNatsRegistryEventSourceLayer,
  makeRegistryEventConsumerConfiguration,
  makeRegistryEventTopology,
} from '@cv/application-registry-events-nats'
import { NodeRuntime } from '@effect/platform-node'
import * as NodeHttpClient from '@effect/platform-node/NodeHttpClient'
import { Console, Effect, Layer, Redacted } from 'effect'

import { makeCloudflareCacheInvalidatorLayer } from './cloudflare'
import { readCacheInvalidatorConfiguration } from './config'
import { runCacheInvalidationConsumer } from './consumer'

const program = Effect.scoped(
  Effect.gen(function* () {
    const configuration = yield* readCacheInvalidatorConfiguration
    const topology = makeRegistryEventTopology()
    const source = makeNatsRegistryEventSourceLayer(
      makeRegistryEventConsumerConfiguration({
        consumerName: 'registry-cache-invalidator',
        nats: {
          clientName: 'application-registry-cache-invalidator',
          maxReconnectAttempts: -1,
          password: Redacted.value(configuration.nats.password),
          server: configuration.nats.server,
          username: configuration.nats.username,
        },
        topology,
      })
    )
    const invalidator = makeCloudflareCacheInvalidatorLayer(
      configuration.cloudflare
    ).pipe(Layer.provide(NodeHttpClient.layerNodeHttp))
    const runtime = Layer.merge(source, invalidator)

    yield* Console.log(
      JSON.stringify({
        consumer: 'registry-cache-invalidator',
        service: 'application-registry-cache-invalidator',
        stream: topology.streamName,
      })
    )
    yield* runCacheInvalidationConsumer.pipe(Effect.provide(runtime))
  })
)

NodeRuntime.runMain(program)
