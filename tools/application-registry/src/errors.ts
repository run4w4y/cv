import {
  BadRequestError,
  ConflictError,
  InternalServerError,
  NotFoundError,
  ServiceUnavailableError,
  UnauthorizedError,
} from '@cv/application-registry-api-contract'
import { Data, Schema } from 'effect'
import * as HttpClientError from 'effect/unstable/http/HttpClientError'

const describeCause = (cause: unknown) =>
  cause instanceof Error ? cause.message : String(cause)

export class ApplicationRegistryConfigError extends Data.TaggedError(
  'ApplicationRegistryConfigError'
)<{
  readonly cause?: unknown
  readonly message: string
}> {}

export class ApplicationRegistryRequestError extends Data.TaggedError(
  'ApplicationRegistryRequestError'
)<{
  readonly cause: unknown
  readonly message: string
}> {}

export class ApplicationRegistryHttpError extends Data.TaggedError(
  'ApplicationRegistryHttpError'
)<{
  readonly body: string
  readonly dispositionHint?: 'blocked' | 'dead-letter' | 'retry'
  readonly message: string
  readonly status: number
}> {}

export class ApplicationRegistryResponseError extends Data.TaggedError(
  'ApplicationRegistryResponseError'
)<{
  readonly cause: unknown
  readonly message: string
}> {}

export class ApplicationRegistryOutboxFileError extends Data.TaggedError(
  'ApplicationRegistryOutboxFileError'
)<{
  readonly cause: unknown
  readonly message: string
  readonly path: string
}> {}

export class ApplicationRegistryOutboxDecodeError extends Data.TaggedError(
  'ApplicationRegistryOutboxDecodeError'
)<{
  readonly cause: unknown
  readonly message: string
  readonly path: string
}> {}

export class ApplicationRegistryOutboxConflictError extends Data.TaggedError(
  'ApplicationRegistryOutboxConflictError'
)<{
  readonly operationId: string
  readonly message: string
  readonly path: string
}> {}

export type ApplicationRegistryClientError =
  | ApplicationRegistryRequestError
  | ApplicationRegistryHttpError
  | ApplicationRegistryResponseError

export type ApplicationRegistryOutboxError =
  | ApplicationRegistryOutboxFileError
  | ApplicationRegistryOutboxDecodeError
  | ApplicationRegistryOutboxConflictError

export type ApplicationRegistryError =
  | ApplicationRegistryConfigError
  | ApplicationRegistryClientError
  | ApplicationRegistryOutboxError

export const normalizeApplicationRegistryCause = (cause: unknown) =>
  describeCause(cause)

const typedHttpStatus = (cause: unknown): number | undefined => {
  if (cause instanceof BadRequestError) return 400
  if (cause instanceof UnauthorizedError) return 401
  if (cause instanceof NotFoundError) return 404
  if (cause instanceof ConflictError) return 409
  if (cause instanceof ServiceUnavailableError) return 503
  if (cause instanceof InternalServerError) return 500
  return undefined
}

/** Normalizes generated HttpApi client failures once, at the transport boundary. */
export const normalizeApplicationRegistryClientError = (
  cause: unknown
): ApplicationRegistryClientError => {
  if (
    cause instanceof ApplicationRegistryRequestError ||
    cause instanceof ApplicationRegistryHttpError ||
    cause instanceof ApplicationRegistryResponseError
  ) {
    return cause
  }

  const status = typedHttpStatus(cause)
  if (status !== undefined) {
    return new ApplicationRegistryHttpError({
      body: '',
      dispositionHint:
        cause instanceof UnauthorizedError
          ? 'blocked'
          : status >= 500
            ? 'retry'
            : 'dead-letter',
      message: describeCause(cause),
      status,
    })
  }

  if (HttpClientError.isHttpClientError(cause)) {
    if (cause.reason._tag === 'StatusCodeError') {
      return new ApplicationRegistryHttpError({
        body: '',
        message: cause.message,
        status: cause.reason.response.status,
      })
    }
    if (
      cause.reason._tag === 'DecodeError' ||
      cause.reason._tag === 'EmptyBodyError'
    ) {
      return new ApplicationRegistryResponseError({
        cause,
        message:
          'Application registry response did not match its HttpApi contract',
      })
    }
    return new ApplicationRegistryRequestError({
      cause,
      message: cause.message,
    })
  }

  if (Schema.isSchemaError(cause)) {
    return new ApplicationRegistryResponseError({
      cause,
      message: 'Application registry data did not match its HttpApi contract',
    })
  }

  return new ApplicationRegistryRequestError({
    cause,
    message: describeCause(cause),
  })
}
