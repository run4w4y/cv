import type { JSONSchema7 } from '@ai-sdk/provider'

export type { JSONSchema7 as AiJsonSchema }

export type AiProviderOperation = 'discover-models' | 'generate-json'

export type AiModel = {
  readonly id: string
}

export type AiModelDiscoveryOptions = {
  /**
   * Cancelling this signal is reported as an AiProviderCancellationError.
   * Interrupting the surrounding Effect remains an Effect interruption.
   */
  readonly signal?: AbortSignal
}

export type AiJsonGenerationRequest = {
  /** Optional one-shot model instructions. No conversation is retained. */
  readonly instructions?: string
  readonly maxRetries?: number
  readonly modelId: string
  readonly prompt: string
  readonly schema: JSONSchema7
  readonly schemaDescription?: string
  readonly schemaName?: string
  /**
   * Cancelling this signal is reported as an AiProviderCancellationError.
   * Interrupting the surrounding Effect remains an Effect interruption.
   */
  readonly signal?: AbortSignal
}

export type AiFinishReason =
  | 'content-filter'
  | 'error'
  | 'length'
  | 'other'
  | 'stop'
  | 'tool-calls'

export type AiTokenUsage = {
  readonly inputTokens: number | null
  readonly outputTokens: number | null
  readonly totalTokens: number | null
}

export type AiJsonGenerationResult<Output> = {
  readonly finishReason: AiFinishReason
  readonly modelId: string
  readonly output: Output
  readonly usage: AiTokenUsage
}
