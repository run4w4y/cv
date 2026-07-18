import { describe, expect, test } from 'bun:test'
import { Effect, Fiber } from 'effect'

import {
  AiProviderAuthenticationError,
  AiProviderCancellationError,
  AiProviderConfigurationError,
  AiProviderOutputValidationError,
  AiProviderSchemaError,
} from '../errors'
import type { AiJsonSchema } from '../model'
import {
  type AiProviderFetch,
  makeChatGptSubscriptionAiProvider,
} from './proxy'

const draftSchema = {
  additionalProperties: false,
  properties: {
    headline: { minLength: 1, type: 'string' },
  },
  required: ['headline'],
  type: 'object',
} satisfies AiJsonSchema

type Draft = {
  readonly headline: string
}

const responseBody = (output: unknown) => ({
  created_at: 1_784_310_400,
  id: 'resp_test',
  incomplete_details: null,
  model: 'gpt-test',
  output: [
    {
      content: [
        {
          annotations: [],
          logprobs: null,
          text: JSON.stringify(output),
          type: 'output_text',
        },
      ],
      id: 'msg_test',
      role: 'assistant',
      type: 'message',
    },
  ],
  usage: {
    input_tokens: 12,
    input_tokens_details: { cached_tokens: 2 },
    output_tokens: 7,
    output_tokens_details: { reasoning_tokens: 3 },
  },
})

const inputUrl = (input: RequestInfo | URL) =>
  input instanceof Request ? input.url : input.toString()

describe('ChatGPT subscription AI provider', () => {
  test('discovers account models through the browser proxy', async () => {
    const requests: Array<{
      credentials: RequestCredentials | undefined
      url: string
    }> = []
    const fetch: AiProviderFetch = async (input, init) => {
      requests.push({ credentials: init?.credentials, url: inputUrl(input) })
      return Response.json({ models: ['gpt-test', { slug: 'gpt-second' }] })
    }
    const provider = makeChatGptSubscriptionAiProvider({ fetch })

    const models = await Effect.runPromise(provider.discoverModels())

    expect(models).toEqual([{ id: 'gpt-test' }, { id: 'gpt-second' }])
    expect(requests).toEqual([
      { credentials: 'same-origin', url: '/api/chatgpt/models' },
    ])
  })

  test('posts one-shot structured generation to the proxy and validates it', async () => {
    let requestUrl = ''
    let requestBody: unknown
    const fetch: AiProviderFetch = async (input, init) => {
      requestUrl = inputUrl(input)
      requestBody = JSON.parse(String(init?.body))
      return Response.json(
        responseBody({ headline: 'Staff software engineer' })
      )
    }
    const provider = makeChatGptSubscriptionAiProvider({ fetch })

    const generated = await Effect.runPromise(
      provider.generateJson<Draft>({
        instructions: 'Use only the facts in the prompt.',
        modelId: 'gpt-test',
        prompt: 'Create a short headline.',
        schema: draftSchema,
        schemaDescription: 'A tailored CV headline.',
        schemaName: 'cv_draft',
      })
    )

    expect(requestUrl).toBe('/api/chatgpt/responses')
    expect(requestBody).toMatchObject({
      input: [
        {
          content: 'Use only the facts in the prompt.',
          role: 'system',
        },
        {
          content: [{ text: 'Create a short headline.', type: 'input_text' }],
          role: 'user',
        },
      ],
      model: 'gpt-test',
      text: {
        format: {
          description: 'A tailored CV headline.',
          name: 'cv_draft',
          schema: draftSchema,
          strict: true,
          type: 'json_schema',
        },
      },
    })
    expect(generated).toEqual({
      finishReason: 'stop',
      modelId: 'gpt-test',
      output: { headline: 'Staff software engineer' },
      usage: { inputTokens: 12, outputTokens: 7, totalTokens: 19 },
    })
  })

  test('rejects malformed schemas before making a request', async () => {
    let requests = 0
    const malformedSchema: AiJsonSchema = JSON.parse(
      '{"type":"not-a-json-schema-type"}'
    )
    const provider = makeChatGptSubscriptionAiProvider({
      fetch: async () => {
        requests += 1
        return Response.json(responseBody({}))
      },
    })

    const error = await Effect.runPromise(
      Effect.flip(
        provider.generateJson({
          modelId: 'gpt-test',
          prompt: 'Generate JSON.',
          schema: malformedSchema,
        })
      )
    )

    expect(error).toBeInstanceOf(AiProviderSchemaError)
    expect(requests).toBe(0)
  })

  test('reports generated JSON that violates the caller schema', async () => {
    const provider = makeChatGptSubscriptionAiProvider({
      fetch: async () => Response.json(responseBody({ headline: '' })),
    })

    const error = await Effect.runPromise(
      Effect.flip(
        provider.generateJson<Draft>({
          modelId: 'gpt-test',
          prompt: 'Create a short headline.',
          schema: draftSchema,
        })
      )
    )

    expect(error).toBeInstanceOf(AiProviderOutputValidationError)
  })

  test('maps an unauthorized proxy session to a typed authentication failure', async () => {
    const provider = makeChatGptSubscriptionAiProvider({
      fetch: async () => new Response('Unauthorized', { status: 401 }),
    })

    const error = await Effect.runPromise(
      Effect.flip(provider.discoverModels())
    )

    expect(error).toBeInstanceOf(AiProviderAuthenticationError)
    if (!(error instanceof AiProviderAuthenticationError)) {
      throw new Error('Expected an authentication error.')
    }
    expect(error.status).toBe(401)
  })

  test('maps caller AbortSignal cancellation to a typed cancellation failure', async () => {
    let startRequest: (() => void) | undefined
    const started = new Promise<void>((resolve) => {
      startRequest = resolve
    })
    const fetch: AiProviderFetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        startRequest?.()
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Cancelled', 'AbortError')),
          { once: true }
        )
      })
    const provider = makeChatGptSubscriptionAiProvider({ fetch })
    const controller = new AbortController()
    const failure = Effect.runPromise(
      Effect.flip(provider.discoverModels({ signal: controller.signal }))
    )

    await started
    controller.abort()
    const error = await failure

    expect(error).toBeInstanceOf(AiProviderCancellationError)
  })

  test('propagates Effect interruption to the underlying fetch signal', async () => {
    let requestWasAborted = false
    let startRequest: (() => void) | undefined
    const started = new Promise<void>((resolve) => {
      startRequest = resolve
    })
    const fetch: AiProviderFetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        startRequest?.()
        init?.signal?.addEventListener(
          'abort',
          () => {
            requestWasAborted = true
            reject(new DOMException('Interrupted', 'AbortError'))
          },
          { once: true }
        )
      })
    const provider = makeChatGptSubscriptionAiProvider({ fetch })
    const fiber = Effect.runFork(provider.discoverModels())

    await started
    await Effect.runPromise(Fiber.interrupt(fiber))

    expect(requestWasAborted).toBe(true)
  })

  test('rejects direct upstream base URLs by construction', async () => {
    const provider = makeChatGptSubscriptionAiProvider({
      basePath: 'https://api.openai.com/v1',
      fetch: async () => Response.json({}),
    })

    const error = await Effect.runPromise(
      Effect.flip(provider.discoverModels())
    )

    expect(error).toBeInstanceOf(AiProviderConfigurationError)
  })
})
