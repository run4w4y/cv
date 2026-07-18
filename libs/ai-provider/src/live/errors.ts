import { ChatGPTProxyError } from '@opencoredev/loginwithchatgpt-ai'
import { APICallError, NoObjectGeneratedError, RetryError } from 'ai'

import {
  AiProviderAuthenticationError,
  AiProviderCancellationError,
  AiProviderGenerationError,
  AiProviderModelDiscoveryError,
  AiProviderModelUnavailableError,
  AiProviderOutputValidationError,
  AiProviderRateLimitError,
} from '../errors'
import { isAbortFailure } from '../internal/abort'
import type { AiProviderOperation } from '../model'

const unwrapRetry = (cause: unknown): unknown =>
  RetryError.isInstance(cause) ? cause.lastError : cause

const statusOf = (cause: unknown): number | null => {
  const unwrapped = unwrapRetry(cause)
  if (unwrapped instanceof ChatGPTProxyError) {
    return unwrapped.status
  }
  if (APICallError.isInstance(unwrapped)) {
    return unwrapped.statusCode ?? null
  }
  return null
}

const retryAfterSecondsOf = (cause: unknown): number | null => {
  const unwrapped = unwrapRetry(cause)
  if (!APICallError.isInstance(unwrapped)) {
    return null
  }
  const header = unwrapped.responseHeaders?.['retry-after']
  if (!header) {
    return null
  }
  const seconds = Number(header)
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null
}

const isRetryable = (cause: unknown, status: number | null) => {
  const unwrapped = unwrapRetry(cause)
  if (APICallError.isInstance(unwrapped)) {
    return unwrapped.isRetryable
  }
  return status === null || status === 408 || status === 429 || status >= 500
}

const commonFailure = (
  cause: unknown,
  operation: AiProviderOperation,
  externalSignal: AbortSignal | undefined
) => {
  const unwrapped = unwrapRetry(cause)
  if (
    externalSignal?.aborted ||
    isAbortFailure(unwrapped) ||
    (RetryError.isInstance(cause) && cause.reason === 'abort')
  ) {
    return new AiProviderCancellationError({
      message: 'The AI operation was cancelled.',
      operation,
    })
  }

  const status = statusOf(unwrapped)
  if (status === 401 || status === 403) {
    return new AiProviderAuthenticationError({
      cause,
      message: 'The ChatGPT session is unavailable or no longer authorized.',
      operation,
      status,
    })
  }
  if (status === 429) {
    return new AiProviderRateLimitError({
      cause,
      message: 'The ChatGPT subscription is temporarily rate limited.',
      operation,
      retryAfterSeconds: retryAfterSecondsOf(unwrapped),
    })
  }
  return null
}

export const mapModelDiscoveryError = (
  cause: unknown,
  externalSignal: AbortSignal | undefined
) => {
  const common = commonFailure(cause, 'discover-models', externalSignal)
  if (common) {
    return common
  }
  const status = statusOf(cause)
  return new AiProviderModelDiscoveryError({
    cause,
    message: 'Could not discover models available to the ChatGPT account.',
    retryable: isRetryable(cause, status),
    status,
  })
}

export const mapGenerationError = (
  cause: unknown,
  modelId: string,
  externalSignal: AbortSignal | undefined
) => {
  const common = commonFailure(cause, 'generate-json', externalSignal)
  if (common) {
    return common
  }
  const unwrapped = unwrapRetry(cause)
  if (NoObjectGeneratedError.isInstance(unwrapped)) {
    return new AiProviderOutputValidationError({
      cause,
      message:
        'The model did not return JSON matching the supplied output schema.',
      modelId,
    })
  }

  const status = statusOf(unwrapped)
  if (status === 404) {
    return new AiProviderModelUnavailableError({
      cause,
      message: `The selected ChatGPT model "${modelId}" is unavailable.`,
      modelId,
    })
  }
  return new AiProviderGenerationError({
    cause,
    message: 'The ChatGPT-backed JSON generation request failed.',
    modelId,
    retryable: isRetryable(cause, status),
    status,
  })
}
