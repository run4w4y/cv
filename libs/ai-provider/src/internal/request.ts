import { Effect } from 'effect'

import { AiProviderRequestError } from '../errors'
import type { AiJsonGenerationRequest } from '../model'

const schemaNamePattern = /^[A-Za-z0-9_-]{1,64}$/u

const requestError = (field: string, message: string) =>
  new AiProviderRequestError({ field, message })

export const validateGenerationRequest = (request: AiJsonGenerationRequest) =>
  Effect.gen(function* () {
    const modelId = request.modelId.trim()
    if (modelId.length === 0) {
      return yield* requestError('modelId', 'A model ID is required.')
    }
    if (request.prompt.trim().length === 0) {
      return yield* requestError('prompt', 'A generation prompt is required.')
    }
    if (
      request.maxRetries !== undefined &&
      (!Number.isInteger(request.maxRetries) ||
        request.maxRetries < 0 ||
        request.maxRetries > 5)
    ) {
      return yield* requestError(
        'maxRetries',
        'Maximum retries must be an integer between 0 and 5.'
      )
    }
    if (
      request.schemaName !== undefined &&
      !schemaNamePattern.test(request.schemaName)
    ) {
      return yield* requestError(
        'schemaName',
        'Schema names may contain only letters, digits, underscores, or hyphens and must be at most 64 characters.'
      )
    }

    return { ...request, modelId }
  })
