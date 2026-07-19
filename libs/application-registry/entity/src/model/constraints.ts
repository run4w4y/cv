import { Schema } from 'effect'

export type JsonValue = Schema.Schema.Type<typeof Schema.Json>

export const NonEmptyTrimmedStringSchema = Schema.Trim.pipe(
  Schema.check(Schema.isNonEmpty())
)

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
  Schema.check(Schema.isGreaterThanOrEqualTo(0))
)

export const PositiveRateSchema = Schema.Number.pipe(
  Schema.check(Schema.isGreaterThan(0))
)
