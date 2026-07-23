import { Option, Schema } from 'effect'

export type JsonValue = Schema.Schema.Type<typeof Schema.Json>

export const NonEmptyTrimmedStringSchema = Schema.Trim.pipe(
  Schema.check(Schema.isNonEmpty())
)

const ParsedHttpUrlSchema = Schema.URLFromString.pipe(
  Schema.check(
    Schema.makeFilter((url) =>
      url.protocol === 'http:' || url.protocol === 'https:'
        ? true
        : 'URL must use HTTP or HTTPS.'
    )
  )
)

const decodeHttpUrl = Schema.decodeUnknownOption(ParsedHttpUrlSchema)

export const HttpUrlSchema = Schema.Trim.pipe(
  Schema.check(
    Schema.makeFilter((value) =>
      Option.isSome(decodeHttpUrl(value))
        ? true
        : 'URL must be valid and use HTTP or HTTPS.'
    )
  )
)

export type HttpUrl = Schema.Schema.Type<typeof HttpUrlSchema>

const utcIsoTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u

export const UtcIsoTimestampSchema = Schema.String.pipe(
  Schema.check(Schema.isPattern(utcIsoTimestampPattern))
)

export type UtcIsoTimestamp = Schema.Schema.Type<typeof UtcIsoTimestampSchema>

export const CurrencyCodeSchema = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[A-Z]{3}$/u))
)

export type CurrencyCode = Schema.Schema.Type<typeof CurrencyCodeSchema>

export const ApplicationVersionSchema = Schema.Int.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(1))
)

export const ExpectedApplicationVersionSchema = Schema.Int.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(0))
)

/** Monotonic registry revision used by incremental synchronization. */
export const RegistryRevisionSchema = Schema.Int.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(0))
)

/** Monotonic revision assigned to registry mutations. */
export type RegistryRevision = Schema.Schema.Type<typeof RegistryRevisionSchema>

export const NonNegativeMinorAmountSchema = Schema.Int.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(0)),
  Schema.check(Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER))
)

export const PositiveRateSchema = Schema.Number.pipe(
  Schema.check(Schema.isGreaterThan(0))
)
