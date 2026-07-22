import { Option, Schema } from 'effect'

const CvTokenSchema = Schema.String.pipe(
  Schema.check(Schema.isNonEmpty()),
  Schema.check(
    Schema.makeFilter((value) =>
      value.includes('/') ? 'CV token cannot contain a slash.' : undefined
    )
  )
)

export const decodeCvToken = (value: unknown): string | null => {
  const decoded = Schema.decodeUnknownOption(CvTokenSchema)(value)
  return Option.isSome(decoded) ? decoded.value : null
}
