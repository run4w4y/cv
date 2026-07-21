import { BunRuntime } from '@effect/platform-bun'
import { Effect, Layer } from 'effect'

import { readApplicationRegistryMcpConfig } from './config'
import { makeApplicationRegistryMcpServerLayer } from './server'

const program = readApplicationRegistryMcpConfig.pipe(
  Effect.map(makeApplicationRegistryMcpServerLayer),
  Effect.flatMap(Layer.launch)
)

BunRuntime.runMain(program)
