import { createChatGPTProxyProvider } from '@opencoredev/loginwithchatgpt-ai'
import { generateText, jsonSchema, Output } from 'ai'
import { Effect, Layer } from 'effect'

import {
  AiProviderCancellationError,
  AiProviderConfigurationError,
} from '../errors'
import { mergeAbortSignals } from '../internal/abort'
import {
  compileJsonSchema,
  JsonSchemaOutputError,
} from '../internal/json-schema'
import { validateGenerationRequest } from '../internal/request'
import type { AiJsonGenerationRequest } from '../model'
import { AiProvider, type AiProviderShape } from '../service'
import { mapGenerationError, mapModelDiscoveryError } from './errors'

export type ChatGptSubscriptionAiProviderOptions = {
  /**
   * Login-with-ChatGPT proxy mount. This must identify the application backend,
   * never an OpenAI or ChatGPT upstream API. Defaults to `/api/chatgpt`.
   */
  readonly basePath?: string
  /** Use `include` only when the management UI and BFF are cross-origin. */
  readonly credentials?: RequestCredentials
  /** Browser fetch override for tests or a custom host environment. */
  readonly fetch?: AiProviderFetch
}

export type AiProviderFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>

type ResolvedOptions = {
  readonly basePath: string
  readonly credentials: RequestCredentials
  readonly fetch: AiProviderFetch
}

const forbiddenUpstreamHosts = new Set([
  'api.openai.com',
  'chatgpt.com',
  'chat.openai.com',
])

const resolveOptions = (
  options: ChatGptSubscriptionAiProviderOptions
): Effect.Effect<ResolvedOptions, AiProviderConfigurationError> =>
  Effect.try({
    try: () => {
      const basePath = (options.basePath ?? '/api/chatgpt').trim()
      if (basePath.length === 0) {
        throw new TypeError('The ChatGPT proxy base path cannot be empty.')
      }

      const parsedBasePath = new URL(basePath, 'https://application.invalid')
      if (!['http:', 'https:'].includes(parsedBasePath.protocol)) {
        throw new TypeError(
          'The ChatGPT proxy must use an HTTP(S) URL or path.'
        )
      }
      if (forbiddenUpstreamHosts.has(parsedBasePath.hostname.toLowerCase())) {
        throw new TypeError(
          'The AI provider must target the application proxy, not an upstream AI API.'
        )
      }

      const fetchImplementation = options.fetch ?? globalThis.fetch
      if (typeof fetchImplementation !== 'function') {
        throw new TypeError('Fetch is unavailable in this browser environment.')
      }

      return {
        basePath,
        credentials: options.credentials ?? 'same-origin',
        fetch: fetchImplementation,
      }
    },
    catch: (cause) =>
      new AiProviderConfigurationError({
        cause,
        message: 'The ChatGPT subscription proxy is not configured correctly.',
      }),
  })

const operationFetch = (
  fetchImplementation: AiProviderFetch,
  operationSignal: AbortSignal,
  credentials: RequestCredentials
): typeof fetch => {
  const wrapped = (input: RequestInfo | URL, init?: RequestInit) => {
    const requestSignal = input instanceof Request ? input.signal : undefined
    return fetchImplementation(input, {
      ...init,
      credentials,
      signal: mergeAbortSignals(operationSignal, requestSignal, init?.signal),
    })
  }

  const preconnect: typeof fetch.preconnect = () => undefined
  return Object.assign(wrapped, { preconnect })
}

const proxyFor = (options: ResolvedOptions, signal: AbortSignal) =>
  createChatGPTProxyProvider({
    basePath: options.basePath,
    credentials: options.credentials,
    fetch: operationFetch(options.fetch, signal, options.credentials),
  })

const cancelled = (
  operation: 'discover-models' | 'generate-json',
  signal: AbortSignal | undefined
) =>
  signal?.aborted
    ? Effect.fail(
        new AiProviderCancellationError({
          message: 'The AI operation was cancelled.',
          operation,
        })
      )
    : Effect.void

export const makeChatGptSubscriptionAiProvider = (
  options: ChatGptSubscriptionAiProviderOptions = {}
): AiProviderShape => {
  const resolvedOptions = resolveOptions(options)

  return {
    discoverModels: (discoveryOptions = {}) =>
      Effect.gen(function* () {
        yield* cancelled('discover-models', discoveryOptions.signal)
        const resolved = yield* resolvedOptions
        const models = yield* Effect.tryPromise({
          try: (effectSignal) =>
            proxyFor(
              resolved,
              mergeAbortSignals(effectSignal, discoveryOptions.signal) ??
                effectSignal
            ).listModels(),
          catch: (cause) =>
            mapModelDiscoveryError(cause, discoveryOptions.signal),
        })

        return models.map((id) => ({ id }))
      }),
    generateJson: <OutputValue>(rawRequest: AiJsonGenerationRequest) =>
      Effect.gen(function* () {
        yield* cancelled('generate-json', rawRequest.signal)
        const request = yield* validateGenerationRequest(rawRequest)
        const validator = yield* compileJsonSchema<OutputValue>(request.schema)
        const resolved = yield* resolvedOptions
        const result = yield* Effect.tryPromise({
          try: async (effectSignal) => {
            const signal =
              mergeAbortSignals(effectSignal, request.signal) ?? effectSignal
            const provider = proxyFor(resolved, signal)
            const outputSchema = jsonSchema<OutputValue>(request.schema, {
              validate: (value) =>
                validator(value)
                  ? { success: true, value }
                  : {
                      success: false,
                      error: new JsonSchemaOutputError(validator),
                    },
            })

            return generateText({
              abortSignal: signal,
              instructions: request.instructions,
              maxRetries: request.maxRetries ?? 1,
              model: provider(request.modelId),
              output: Output.object({
                description: request.schemaDescription,
                name: request.schemaName,
                schema: outputSchema,
              }),
              prompt: request.prompt,
            })
          },
          catch: (cause) =>
            mapGenerationError(cause, request.modelId, request.signal),
        })

        return {
          finishReason: result.finishReason,
          modelId: request.modelId,
          output: result.output,
          usage: {
            inputTokens: result.usage.inputTokens ?? null,
            outputTokens: result.usage.outputTokens ?? null,
            totalTokens: result.usage.totalTokens ?? null,
          },
        }
      }),
  }
}

export const makeChatGptSubscriptionAiProviderLayer = (
  options: ChatGptSubscriptionAiProviderOptions = {}
) => Layer.succeed(AiProvider, makeChatGptSubscriptionAiProvider(options))

export const ChatGptSubscriptionAiProviderLayer =
  makeChatGptSubscriptionAiProviderLayer()
