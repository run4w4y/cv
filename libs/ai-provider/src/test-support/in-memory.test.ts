import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'

import {
  AiProviderCancellationError,
  AiProviderOutputValidationError,
} from '../errors'
import type { AiJsonSchema } from '../model'
import { AiProvider } from '../service'
import { makeInMemoryAiProvider } from './in-memory'

const schema = {
  additionalProperties: false,
  properties: { value: { type: 'integer' } },
  required: ['value'],
  type: 'object',
} satisfies AiJsonSchema

describe('in-memory AI provider', () => {
  test('discovers models and records independent one-shot generation calls', async () => {
    const memory = makeInMemoryAiProvider({
      generate: () =>
        Effect.succeed({
          output: { value: 42 },
          usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
        }),
      models: ['test-a', 'test-b'],
    })
    const program = Effect.gen(function* () {
      const ai = yield* AiProvider
      const models = yield* ai.discoverModels()
      const result = yield* ai.generateJson<{ readonly value: number }>({
        modelId: models[0]?.id ?? 'missing',
        prompt: 'Return the answer.',
        schema,
      })
      return { models, result }
    }).pipe(Effect.provide(memory.layer))

    const output = await Effect.runPromise(program)

    expect(output.models).toEqual([{ id: 'test-a' }, { id: 'test-b' }])
    expect(output.result.output).toEqual({ value: 42 })
    expect(memory.discoveryCount()).toBe(1)
    expect(memory.requests).toHaveLength(1)
    expect(memory.requests[0]?.prompt).toBe('Return the answer.')
  })

  test('uses the caller JSON Schema to validate fake responses too', async () => {
    const memory = makeInMemoryAiProvider({
      generate: () => Effect.succeed({ output: { value: 'not-a-number' } }),
    })

    const error = await Effect.runPromise(
      Effect.flip(
        Effect.gen(function* () {
          const ai = yield* AiProvider
          return yield* ai.generateJson({
            modelId: 'test-model',
            prompt: 'Return the answer.',
            schema,
          })
        }).pipe(Effect.provide(memory.layer))
      )
    )

    expect(error).toBeInstanceOf(AiProviderOutputValidationError)
  })

  test('does not invoke the fake model for an already-cancelled request', async () => {
    let calls = 0
    const memory = makeInMemoryAiProvider({
      generate: () => {
        calls += 1
        return Effect.succeed({ output: { value: 42 } })
      },
    })
    const controller = new AbortController()
    controller.abort()

    const error = await Effect.runPromise(
      Effect.flip(
        Effect.gen(function* () {
          const ai = yield* AiProvider
          return yield* ai.generateJson({
            modelId: 'test-model',
            prompt: 'Return the answer.',
            schema,
            signal: controller.signal,
          })
        }).pipe(Effect.provide(memory.layer))
      )
    )

    expect(error).toBeInstanceOf(AiProviderCancellationError)
    expect(calls).toBe(0)
  })

  test('supports independently materialized schemas with the same logical ID', async () => {
    const memory = makeInMemoryAiProvider({
      generate: () => Effect.succeed({ output: { value: 42 } }),
    })
    const run = (requestSchema: AiJsonSchema) =>
      Effect.gen(function* () {
        const ai = yield* AiProvider
        return yield* ai.generateJson({
          modelId: 'test-model',
          prompt: 'Return the answer.',
          schema: requestSchema,
        })
      }).pipe(Effect.provide(memory.layer))
    const withId = (): AiJsonSchema => ({ ...schema, $id: 'cv.test.result' })

    await Effect.runPromise(run(withId()))
    const second = await Effect.runPromise(run(withId()))

    expect(second.output).toEqual({ value: 42 })
  })
})
