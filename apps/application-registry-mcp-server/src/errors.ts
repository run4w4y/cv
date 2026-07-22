import {
  BadRequestError,
  ConflictError,
  InternalServerError,
  NotFoundError,
  ServiceUnavailableError,
  UnauthorizedError,
} from '@cv/application-registry-api-contract'
import { Schema } from 'effect'
import * as HttpClientError from 'effect/unstable/http/HttpClientError'

export const ApplicationRegistryToolErrorKindSchema = Schema.Literals([
  'invalid_request',
  'unauthorized',
  'not_found',
  'conflict',
  'unavailable',
])

export class ApplicationRegistryToolError extends Schema.TaggedErrorClass<ApplicationRegistryToolError>()(
  'ApplicationRegistryToolError',
  {
    kind: ApplicationRegistryToolErrorKindSchema,
    message: Schema.String,
  }
) {}

const httpError = (status: number, message: string) => {
  switch (status) {
    case 400:
      return new ApplicationRegistryToolError({
        kind: 'invalid_request',
        message,
      })
    case 401:
    case 403:
      return new ApplicationRegistryToolError({
        kind: 'unauthorized',
        message: 'The application registry rejected its configured token.',
      })
    case 404:
      return new ApplicationRegistryToolError({
        kind: 'not_found',
        message,
      })
    case 409:
      return new ApplicationRegistryToolError({
        kind: 'conflict',
        message,
      })
    default:
      return new ApplicationRegistryToolError({
        kind: 'unavailable',
        message: 'The application registry is temporarily unavailable.',
      })
  }
}

export const applicationRegistryToolError = (
  error: unknown
): ApplicationRegistryToolError => {
  if (Schema.is(BadRequestError)(error)) return httpError(400, error.message)
  if (Schema.is(UnauthorizedError)(error)) return httpError(401, error.message)
  if (Schema.is(NotFoundError)(error)) return httpError(404, error.message)
  if (Schema.is(ConflictError)(error)) return httpError(409, error.message)
  if (
    Schema.is(ServiceUnavailableError)(error) ||
    Schema.is(InternalServerError)(error)
  ) {
    return httpError(503, error.message)
  }

  if (HttpClientError.isHttpClientError(error)) {
    if (error.reason._tag === 'StatusCodeError') {
      return httpError(error.reason.response.status, error.message)
    }
    if (
      error.reason._tag === 'DecodeError' ||
      error.reason._tag === 'EmptyBodyError'
    ) {
      return new ApplicationRegistryToolError({
        kind: 'unavailable',
        message: 'The application registry returned an unreadable response.',
      })
    }
  }

  if (Schema.isSchemaError(error)) {
    return new ApplicationRegistryToolError({
      kind: 'unavailable',
      message: 'The application registry returned an unreadable response.',
    })
  }

  return new ApplicationRegistryToolError({
    kind: 'unavailable',
    message: 'The application registry could not be reached.',
  })
}

export const invalidUpdateError = new ApplicationRegistryToolError({
  kind: 'invalid_request',
  message: 'Supply at least one application field to update.',
})

export const operationIdError = new ApplicationRegistryToolError({
  kind: 'unavailable',
  message:
    'A safe application update operation identifier could not be created.',
})
