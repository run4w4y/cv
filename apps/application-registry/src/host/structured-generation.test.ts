import { describe, expect, mock, test } from 'bun:test'
import type { DesktopCodexBridge } from '@cv/application-registry-desktop-contract'
import { Effect, Fiber } from 'effect'

import { makeDesktopStructuredGeneration } from './structured-generation'

const request = {
  outputSchema: { type: 'object' },
  prompt: 'Return JSON.',
} as const

const bridge = (
  overrides: Partial<DesktopCodexBridge> = {}
): DesktopCodexBridge => ({
  cancel: async () => ({ ok: true, value: undefined }),
  generate: async () => ({
    ok: true,
    value: {
      output: { value: 42 },
      usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
    },
  }),
  status: async () => ({
    ok: true,
    value: {
      available: true,
      executable: null,
      message: 'Codex is available.',
    },
  }),
  ...overrides,
})

describe('desktop structured generation', () => {
  test('adapts the Codex bridge to the workflow generation port', async () => {
    const generation = makeDesktopStructuredGeneration(bridge())

    const result = await Effect.runPromise(generation.generate(request))

    expect(result).toEqual({
      executor: 'codex-local',
      output: { value: 42 },
      usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
    })
  })

  test('maps local subscription failures to a typed generation failure', async () => {
    const generation = makeDesktopStructuredGeneration(
      bridge({
        generate: async () => ({
          error: {
            code: 'codex_not_authenticated',
            message: 'Codex is signed out.',
            status: 401,
          },
          ok: false,
        }),
      })
    )

    const error = await Effect.runPromise(
      generation.generate(request).pipe(Effect.flip)
    )

    expect(error).toMatchObject({
      _tag: 'StructuredGenerationError',
      kind: 'authentication',
      message: 'Codex is signed out.',
    })
  })

  test('cancels the Codex operation when its Effect is interrupted', async () => {
    let started: (() => void) | undefined
    const generationStarted = new Promise<void>((resolve) => {
      started = resolve
    })
    const cancel = mock(async (_operationId: string) => ({
      ok: true as const,
      value: undefined,
    }))
    const generation = makeDesktopStructuredGeneration(
      bridge({
        cancel,
        generate: () => {
          started?.()
          return new Promise(() => undefined)
        },
      })
    )
    const fiber = Effect.runFork(generation.generate(request))

    await generationStarted
    await Effect.runPromise(Fiber.interrupt(fiber))

    expect(cancel).toHaveBeenCalledTimes(1)
    expect(cancel.mock.calls[0]?.[0]).toMatch(/^[0-9a-f-]{36}$/u)
  })
})
