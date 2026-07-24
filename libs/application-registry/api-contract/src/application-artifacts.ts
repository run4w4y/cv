import {
  type ApplicationArtifact,
  ApplicationArtifactCategorySchema,
  ApplicationArtifactSchema,
  NonEmptyTrimmedStringSchema as NonEmptyString,
} from '@cv/application-registry-entity'
import { Schema } from 'effect'

import {
  BlobReferenceInputSchema,
  RegistryContentLocaleSchema,
} from './content'

export const ApplicationArtifactParamsSchema = Schema.Struct({
  artifactId: NonEmptyString,
  id: NonEmptyString,
})

export const ApplicationArtifactResponseSchema: Schema.Codec<ApplicationArtifact> =
  Schema.revealCodec(ApplicationArtifactSchema)

export const ListApplicationArtifactsResponseSchema: Schema.Codec<{
  readonly items: readonly ApplicationArtifact[]
}> = Schema.revealCodec(
  Schema.Struct({
    items: Schema.Array(ApplicationArtifactSchema),
  })
)

export const CreateApplicationArtifactRequestSchema = Schema.Struct({
  blob: BlobReferenceInputSchema,
  category: ApplicationArtifactCategorySchema,
  filename: NonEmptyString,
  locale: Schema.optional(RegistryContentLocaleSchema),
})
export type CreateApplicationArtifactRequest = Schema.Schema.Type<
  typeof CreateApplicationArtifactRequestSchema
>

export type CreateApplicationArtifactResponse = {
  readonly artifact: ApplicationArtifact
  readonly replayed: boolean
}

export const CreateApplicationArtifactResponseSchema: Schema.Codec<CreateApplicationArtifactResponse> =
  Schema.revealCodec(
    Schema.Struct({
      artifact: ApplicationArtifactSchema,
      replayed: Schema.Boolean,
    })
  )
