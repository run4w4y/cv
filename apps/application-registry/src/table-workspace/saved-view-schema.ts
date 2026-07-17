import { Option, Schema } from 'effect'

export const TableDensitySchema = Schema.Literals([
  'compact',
  'comfortable',
  'spacious',
])

export const SortingStateSchema = Schema.Array(
  Schema.Struct({
    id: Schema.NonEmptyString,
    desc: Schema.Boolean,
  })
)

export const VisibilityStateSchema = Schema.Record(
  Schema.String,
  Schema.Boolean
)

export const decodeStoredJson = <Value, Encoded>(
  schema: Schema.Codec<Value, Encoded, never>,
  raw: string
): Value | null => {
  try {
    return Option.getOrNull(Schema.decodeUnknownOption(schema)(JSON.parse(raw)))
  } catch {
    return null
  }
}
