import { Option, Schema } from 'effect'

export const contentManifestSchemaVersion = 'content-manifest.v1' as const

export const localeSchema = Schema.NonEmptyString
export const profileSlugSchema = Schema.NonEmptyString
export const variableNameSchema = Schema.NonEmptyString

export type Locale = Schema.Schema.Type<typeof localeSchema>
export type ProfileSlug = Schema.Schema.Type<typeof profileSlugSchema>
export type VariableName = Schema.Schema.Type<typeof variableNameSchema>

export type JsonPrimitive = string | number | boolean | null
export type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue }
export type JsonObject = { readonly [key: string]: JsonValue }

export const variableLookupDescriptorSchema = Schema.Struct({
  fallback: Schema.NonEmptyString,
  kind: Schema.Literal('VariableLookup'),
  label: Schema.optional(Schema.String),
  variable: variableNameSchema,
})

export const redactedSectionDescriptorSchema = Schema.Struct({
  fallback: Schema.NonEmptyString,
  kind: Schema.Literal('RedactedSection'),
  title: Schema.optional(Schema.String),
  variable: variableNameSchema,
})

export const variableUseDescriptorSchema = Schema.Union([
  variableLookupDescriptorSchema,
  redactedSectionDescriptorSchema,
])

export const redactableTextSchema = Schema.Union([
  Schema.String,
  variableLookupDescriptorSchema,
])

export const variableValueSchema = Schema.Union([
  Schema.NonEmptyString,
  Schema.Array(Schema.NonEmptyString),
])

export const localizedVariableValueSchema = Schema.Union([
  variableValueSchema,
  Schema.Record(localeSchema, variableValueSchema),
])

export const contentVariablesSourceSchema = Schema.Struct({
  variables: Schema.Record(variableNameSchema, localizedVariableValueSchema),
})

export const contentFileIndexSchema = Schema.Struct({
  profiles: Schema.Record(Schema.NonEmptyString, Schema.Array(Schema.String)),
  public: Schema.Array(Schema.String),
})

const contentFileIndexInputSchema = Schema.Struct({
  profiles: Schema.optional(Schema.Unknown),
  public: Schema.optional(Schema.Unknown),
})
const contentFileProfileCandidatesSchema = Schema.Record(
  Schema.NonEmptyString,
  Schema.Unknown
)
const contentFilePathListSchema = Schema.Array(Schema.String)

export const contentManifestSchema = Schema.Struct({
  content: Schema.Record(
    localeSchema,
    Schema.Record(profileSlugSchema, Schema.Unknown)
  ),
  locales: Schema.Array(localeSchema),
  profiles: Schema.Array(profileSlugSchema),
  schema: Schema.NonEmptyString,
})

export type VariableLookupDescriptor = Schema.Schema.Type<
  typeof variableLookupDescriptorSchema
>
export type RedactedSectionDescriptor = Schema.Schema.Type<
  typeof redactedSectionDescriptorSchema
>
export type VariableUseDescriptor = Schema.Schema.Type<
  typeof variableUseDescriptorSchema
>
export type RedactableText = Schema.Schema.Type<typeof redactableTextSchema>
export type VariableValue = Schema.Schema.Type<typeof variableValueSchema>
export type LocalizedVariableValue = Schema.Schema.Type<
  typeof localizedVariableValueSchema
>
export type ContentVariablesSource = Schema.Schema.Type<
  typeof contentVariablesSourceSchema
>
export type ContentFileIndex = Schema.Schema.Type<typeof contentFileIndexSchema>
export type ContentManifest<Content = unknown> = {
  readonly content: Record<Locale, Record<ProfileSlug, Content>>
  readonly locales: readonly Locale[]
  readonly profiles: readonly ProfileSlug[]
  readonly schema: string
}

const decodeContentFileIndexInput = Schema.decodeUnknownOption(
  contentFileIndexInputSchema
)
const decodeContentFileProfileCandidates = Schema.decodeUnknownOption(
  contentFileProfileCandidatesSchema
)
const decodeContentFilePathList = Schema.decodeUnknownOption(
  contentFilePathListSchema
)

export const emptyContentFileIndex = (): ContentFileIndex => ({
  profiles: {},
  public: [],
})

export const decodeContentFileIndexDefensively = (
  value: unknown
): ContentFileIndex => {
  const input = Option.getOrUndefined(decodeContentFileIndexInput(value))

  if (!input) {
    return emptyContentFileIndex()
  }

  const publicPaths = decodeContentFilePathList(input.public).pipe(
    Option.getOrElse(() => [])
  )
  const profileCandidates = decodeContentFileProfileCandidates(
    input.profiles ?? {}
  ).pipe(Option.getOrElse(() => ({})))
  const profiles: Record<string, readonly string[]> = {}

  for (const [profile, paths] of Object.entries(profileCandidates)) {
    const decodedPaths = Option.getOrUndefined(decodeContentFilePathList(paths))

    if (decodedPaths) {
      profiles[profile] = decodedPaths
    }
  }

  return { profiles, public: publicPaths }
}

export const decodeContentManifest = Schema.decodeUnknownEffect(
  contentManifestSchema,
  { errors: 'all' }
)

export const decodeContentVariablesSource = Schema.decodeUnknownEffect(
  contentVariablesSourceSchema,
  { errors: 'all' }
)
