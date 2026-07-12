import { Schema, SchemaGetter } from 'effect'
import { HttpApiSchema } from 'effect/unstable/httpapi'

const errorBodySchema = <Code extends string>(code: Code) =>
  Schema.Struct({
    code: Schema.Literal(code),
    message: Schema.String,
  })

export class BadRequestError extends Schema.TaggedErrorClass<BadRequestError>()(
  'BadRequestError',
  { message: Schema.String }
) {}

export class UnauthorizedError extends Schema.TaggedErrorClass<UnauthorizedError>()(
  'UnauthorizedError',
  { message: Schema.String }
) {}

export class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()(
  'NotFoundError',
  { message: Schema.String }
) {}

export class ConflictError extends Schema.TaggedErrorClass<ConflictError>()(
  'ConflictError',
  { message: Schema.String }
) {}

export class ServiceUnavailableError extends Schema.TaggedErrorClass<ServiceUnavailableError>()(
  'ServiceUnavailableError',
  { message: Schema.String }
) {}

export class InternalServerError extends Schema.TaggedErrorClass<InternalServerError>()(
  'InternalServerError',
  { message: Schema.String }
) {}

export const BadRequestErrorSchema = errorBodySchema('bad_request').pipe(
  Schema.decodeTo(BadRequestError, {
    decode: SchemaGetter.transform(({ message }) =>
      BadRequestError.make({ message })
    ),
    encode: SchemaGetter.transform(({ message }) => ({
      code: 'bad_request' as const,
      message,
    })),
  }),
  HttpApiSchema.status(400)
)

export const UnauthorizedErrorSchema = errorBodySchema('unauthorized').pipe(
  Schema.decodeTo(UnauthorizedError, {
    decode: SchemaGetter.transform(({ message }) =>
      UnauthorizedError.make({ message })
    ),
    encode: SchemaGetter.transform(({ message }) => ({
      code: 'unauthorized' as const,
      message,
    })),
  }),
  HttpApiSchema.status(401)
)

export const NotFoundErrorSchema = errorBodySchema('not_found').pipe(
  Schema.decodeTo(NotFoundError, {
    decode: SchemaGetter.transform(({ message }) =>
      NotFoundError.make({ message })
    ),
    encode: SchemaGetter.transform(({ message }) => ({
      code: 'not_found' as const,
      message,
    })),
  }),
  HttpApiSchema.status(404)
)

export const ConflictErrorSchema = errorBodySchema('conflict').pipe(
  Schema.decodeTo(ConflictError, {
    decode: SchemaGetter.transform(({ message }) =>
      ConflictError.make({ message })
    ),
    encode: SchemaGetter.transform(({ message }) => ({
      code: 'conflict' as const,
      message,
    })),
  }),
  HttpApiSchema.status(409)
)

export const ServiceUnavailableErrorSchema = errorBodySchema(
  'service_unavailable'
).pipe(
  Schema.decodeTo(ServiceUnavailableError, {
    decode: SchemaGetter.transform(({ message }) =>
      ServiceUnavailableError.make({ message })
    ),
    encode: SchemaGetter.transform(({ message }) => ({
      code: 'service_unavailable' as const,
      message,
    })),
  }),
  HttpApiSchema.status(503)
)

export const InternalServerErrorSchema = errorBodySchema('internal_error').pipe(
  Schema.decodeTo(InternalServerError, {
    decode: SchemaGetter.transform(({ message }) =>
      InternalServerError.make({ message })
    ),
    encode: SchemaGetter.transform(({ message }) => ({
      code: 'internal_error' as const,
      message,
    })),
  }),
  HttpApiSchema.status(500)
)

export type ApplicationRegistryHttpError =
  | BadRequestError
  | UnauthorizedError
  | NotFoundError
  | ConflictError
  | ServiceUnavailableError
  | InternalServerError
