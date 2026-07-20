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

export const CvLocaleSchema = Schema.String.pipe(
  Schema.check(
    Schema.isMinLength(2),
    Schema.isMaxLength(32),
    Schema.isPattern(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u)
  )
).annotate({
  description:
    'A normalized locale identifier. The authored facts repository config determines which locales a release must contain.',
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

export const MediaTypeSchema = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(
      /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+(?:\s*;\s*[^\s=]+=[^;]+)*$/iu
    )
  )
).annotate({
  description: 'An Internet media type.',
})

export const SafeFileNameSchema = Schema.String.pipe(
  Schema.check(
    Schema.isTrimmed(),
    Schema.isMinLength(1),
    Schema.isMaxLength(255),
    Schema.isPattern(/^[^/\\]+$/u),
    Schema.makeFilter(
      (fileName) =>
        fileName !== '.' &&
        fileName !== '..' &&
        [...fileName].every((character) => {
          const codePoint = character.codePointAt(0) ?? 0
          return codePoint > 31 && codePoint !== 127
        }),
      { message: 'File name must be a safe leaf file name' }
    )
  )
).annotate({
  description: 'A safe leaf file name without path separators.',
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
