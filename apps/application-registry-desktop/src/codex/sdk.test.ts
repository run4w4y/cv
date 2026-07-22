import { describe, expect, test } from 'bun:test'
import type { DesktopCodexGenerationRequest } from '@cv/application-registry-desktop-contract'
import type {
  CodexOptions,
  ThreadOptions,
  TurnOptions,
} from '@openai/codex-sdk'
import type { JsonSchema } from 'effect/JsonSchema'

import {
  type CodexFactory,
  CodexSdk,
  CodexSdkError,
  resolveCodexExecutable,
} from './sdk'

const schema = {
  additionalProperties: false,
  properties: { value: { type: 'integer' } },
  required: ['value'],
  type: 'object',
} satisfies JsonSchema

const request = (): DesktopCodexGenerationRequest => ({
  instructions: 'Use only reviewed facts.',
  operationId: 'operation-1',
  outputSchema: schema,
  prompt: 'Return the value.',
})

describe('Codex executable resolution', () => {
  test('uses only an explicit development override', () => {
    expect(
      resolveCodexExecutable({
        environment: {
          CV_CODEX_EXECUTABLE: 'C:\\Tools\\codex.exe',
        },
      })
    ).toBe('C:\\Tools\\codex.exe')
  })

  test('lets the SDK resolve its dependency when no override exists', () => {
    expect(resolveCodexExecutable({ environment: {} })).toBeUndefined()
  })
})

describe('Codex SDK adapter', () => {
  test('uses local auth, local model configuration, structured output, and restricted thread options', async () => {
    let codexOptions: CodexOptions | undefined
    let threadOptions: ThreadOptions | undefined
    let turnOptions: TurnOptions | undefined
    let prompt = ''
    const factory: CodexFactory = (options) => {
      codexOptions = options
      return {
        startThread: (options) => {
          threadOptions = options
          return {
            run: async (input, options) => {
              prompt = input
              turnOptions = options
              return {
                finalResponse: '{"value":42}',
                usage: {
                  cached_input_tokens: 2,
                  input_tokens: 11,
                  output_tokens: 3,
                  reasoning_output_tokens: 1,
                },
              }
            },
          }
        },
      }
    }
    const sdk = new CodexSdk({
      codexFactory: factory,
      cwd: 'C:\\Temp',
      environment: {
        CODEX_HOME: 'C:\\isolated',
        INFISICAL_TOKEN: 'must-not-leak',
        REGISTRY_API_TOKEN: 'must-not-leak-either',
        USERPROFILE: 'C:\\Users\\Marat',
      },
      executable: 'C:\\Codex\\codex.exe',
    })

    const result = await sdk.generate(request())

    expect(codexOptions).toEqual({
      codexPathOverride: 'C:\\Codex\\codex.exe',
      env: { USERPROFILE: 'C:\\Users\\Marat' },
    })
    expect(threadOptions).toEqual({
      approvalPolicy: 'never',
      networkAccessEnabled: false,
      sandboxMode: 'read-only',
      skipGitRepoCheck: true,
      webSearchMode: 'disabled',
      workingDirectory: 'C:\\Temp',
    })
    expect(turnOptions?.outputSchema).toEqual(schema)
    expect(prompt).toContain('Use only reviewed facts.')
    expect(prompt).toContain('Do not invoke tools')
    expect(result).toEqual({
      output: { value: 42 },
      usage: { inputTokens: 11, outputTokens: 3, totalTokens: 14 },
    })
  })

  test('cancels an active SDK turn with AbortSignal', async () => {
    const sdk = new CodexSdk({
      codexFactory: () => ({
        startThread: () => ({
          run: (_input, options) =>
            new Promise((_resolve, reject) => {
              options?.signal?.addEventListener(
                'abort',
                () => reject(new DOMException('Aborted', 'AbortError')),
                { once: true }
              )
            }),
        }),
      }),
      cwd: 'C:\\Temp',
      environment: {},
    })

    const running = sdk.generate(request())
    sdk.cancel('operation-1')
    const error = await running.catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(CodexSdkError)
    expect(error).toMatchObject({ code: 'codex_cancelled' })
  })
})
