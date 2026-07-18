import { Effect, Layer } from 'effect'

import type {
  AiJsonGenerationFailure,
  AiModelDiscoveryFailure,
} from '../errors'
import {
  AiProviderCancellationError,
  AiProviderGenerationError,
} from '../errors'
import { compileJsonSchema, validateJsonOutput } from '../internal/json-schema'
import { validateGenerationRequest } from '../internal/request'
import type {
  AiFinishReason,
  AiJsonGenerationRequest,
  AiTokenUsage,
} from '../model'
import { AiProvider, type AiProviderShape } from '../service'

export type InMemoryAiProviderResponse = {
  readonly finishReason?: AiFinishReason
  readonly output: unknown
  readonly usage?: Partial<AiTokenUsage>
}

export type InMemoryAiProviderOptions = {
  readonly discoverFailure?: AiModelDiscoveryFailure
  readonly generate?: (
    request: AiJsonGenerationRequest
  ) => Effect.Effect<InMemoryAiProviderResponse, AiJsonGenerationFailure>
  readonly models?: ReadonlyArray<string>
}

export type InMemoryAiProviderHarness = {
  readonly discoveryCount: () => number
  readonly layer: Layer.Layer<AiProvider>
  readonly requests: ReadonlyArray<AiJsonGenerationRequest>
}

const cancellation = (
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

const defaultGenerate = (request: AiJsonGenerationRequest) =>
  Effect.fail(
    new AiProviderGenerationError({
      cause: null,
      message: 'No in-memory AI response was configured.',
      modelId: request.modelId,
      retryable: false,
      status: null,
    })
  )

export const makeInMemoryAiProvider = (
  options: InMemoryAiProviderOptions = {}
): InMemoryAiProviderHarness => {
  const requests: Array<AiJsonGenerationRequest> = []
  let discoveryCount = 0
  const modelIds = [...(options.models ?? ['test-model'])]
  const generate = options.generate ?? defaultGenerate

  const service: AiProviderShape = {
    discoverModels: (discoveryOptions = {}) =>
      Effect.gen(function* () {
        yield* cancellation('discover-models', discoveryOptions.signal)
        discoveryCount += 1
        if (options.discoverFailure) {
          return yield* options.discoverFailure
        }
        return modelIds.map((id) => ({ id }))
      }),
    generateJson: <Output>(rawRequest: AiJsonGenerationRequest) =>
      Effect.gen(function* () {
        yield* cancellation('generate-json', rawRequest.signal)
        const request = yield* validateGenerationRequest(rawRequest)
        const validator = yield* compileJsonSchema<Output>(request.schema)
        requests.push(request)
        const response = yield* generate(request)
        const output = yield* validateJsonOutput(
          validator,
          response.output,
          request.modelId
        )
        return {
          finishReason: response.finishReason ?? 'stop',
          modelId: request.modelId,
          output,
          usage: {
            inputTokens: response.usage?.inputTokens ?? null,
            outputTokens: response.usage?.outputTokens ?? null,
            totalTokens: response.usage?.totalTokens ?? null,
          },
        }
      }),
  }

  return {
    discoveryCount: () => discoveryCount,
    layer: Layer.succeed(AiProvider, service),
    requests,
  }
}
