import { Schema } from 'effect'

export const NonEmptyTextSchema = Schema.String.pipe(
  Schema.check(
    Schema.isTrimmed(),
    Schema.isMinLength(1),
    Schema.isMaxLength(4_000)
  )
).annotate({
  description: 'A non-empty string without leading or trailing whitespace.',
})

export const ShortTextSchema = Schema.String.pipe(
  Schema.check(
    Schema.isTrimmed(),
    Schema.isMinLength(1),
    Schema.isMaxLength(240)
  )
).annotate({
  description: 'A non-empty string of at most 240 characters.',
})

export const StableIdentifierSchema = Schema.String.pipe(
  Schema.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(160),
    Schema.isPattern(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/u)
  )
).annotate({
  description:
    'A stable lowercase identifier composed of alphanumeric segments.',
})

export const CvLocaleSchema = Schema.Literal('en').annotate({
  description: 'The single locale supported by this deployment.',
})

export const UriSchema = Schema.String.pipe(
  Schema.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(2_048),
    Schema.isPattern(/^[a-z][a-z0-9+.-]*:\S+$/iu)
  )
).annotate({
  description: 'An absolute URI with an explicit scheme.',
})

export const Sha256HexSchema = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[a-f0-9]{64}$/u))
).annotate({
  description: 'A lowercase hexadecimal SHA-256 digest.',
})

export const NonNegativeIntegerSchema = Schema.Int.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(0))
).annotate({
  description: 'A non-negative integer.',
})

export const PositiveIntegerSchema = Schema.Int.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(1))
).annotate({
  description: 'A positive integer.',
})
