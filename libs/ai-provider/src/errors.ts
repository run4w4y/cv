import { Data } from 'effect'

import type { AiProviderOperation } from './model'

export class AiProviderConfigurationError extends Data.TaggedError(
  'AiProviderConfigurationError'
)<{
  readonly cause: unknown
  readonly message: string
}> {}

export class AiProviderRequestError extends Data.TaggedError(
  'AiProviderRequestError'
)<{
  readonly field: string
  readonly message: string
}> {}

export class AiProviderAuthenticationError extends Data.TaggedError(
  'AiProviderAuthenticationError'
)<{
  readonly cause: unknown
  readonly message: string
  readonly operation: AiProviderOperation
  readonly status: number
}> {}

export class AiProviderCancellationError extends Data.TaggedError(
  'AiProviderCancellationError'
)<{
  readonly message: string
  readonly operation: AiProviderOperation
}> {}

export class AiProviderRateLimitError extends Data.TaggedError(
  'AiProviderRateLimitError'
)<{
  readonly cause: unknown
  readonly message: string
  readonly operation: AiProviderOperation
  readonly retryAfterSeconds: number | null
}> {}

export class AiProviderModelDiscoveryError extends Data.TaggedError(
  'AiProviderModelDiscoveryError'
)<{
  readonly cause: unknown
  readonly message: string
  readonly retryable: boolean
  readonly status: number | null
}> {}

export class AiProviderSchemaError extends Data.TaggedError(
  'AiProviderSchemaError'
)<{
  readonly cause: unknown
  readonly message: string
}> {}

export class AiProviderModelUnavailableError extends Data.TaggedError(
  'AiProviderModelUnavailableError'
)<{
  readonly cause: unknown
  readonly message: string
  readonly modelId: string
}> {}

export class AiProviderOutputValidationError extends Data.TaggedError(
  'AiProviderOutputValidationError'
)<{
  readonly cause: unknown
  readonly message: string
  readonly modelId: string
}> {}

export class AiProviderGenerationError extends Data.TaggedError(
  'AiProviderGenerationError'
)<{
  readonly cause: unknown
  readonly message: string
  readonly modelId: string
  readonly retryable: boolean
  readonly status: number | null
}> {}

export type AiModelDiscoveryFailure =
  | AiProviderAuthenticationError
  | AiProviderCancellationError
  | AiProviderConfigurationError
  | AiProviderModelDiscoveryError
  | AiProviderRateLimitError

export type AiJsonGenerationFailure =
  | AiProviderAuthenticationError
  | AiProviderCancellationError
  | AiProviderConfigurationError
  | AiProviderGenerationError
  | AiProviderModelUnavailableError
  | AiProviderOutputValidationError
  | AiProviderRateLimitError
  | AiProviderRequestError
  | AiProviderSchemaError
