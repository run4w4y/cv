import { createSelectSchema } from 'drizzle-orm/effect-schema'
import { Schema } from 'effect'

import {
  NonEmptyTrimmedStringSchema,
  Sha256HexSchema,
  UtcIsoTimestampSchema,
} from '../model/constraints'
import {
  ApplicationArtifactCategorySchema,
  ApplicationArtifactSourceSchema,
} from '../model/content'
import { applicationArtifacts } from '../tables/artifacts'

const NonNegativeIntegerSchema = Schema.Int.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(0))
)

export const ApplicationArtifactSchema = createSelectSchema(
  applicationArtifacts,
  {
    byteLength: () => NonNegativeIntegerSchema,
    category: () => ApplicationArtifactCategorySchema,
    createdAt: () => UtcIsoTimestampSchema,
    filename: () => NonEmptyTrimmedStringSchema,
    mediaType: () => NonEmptyTrimmedStringSchema,
    sha256: () => Sha256HexSchema,
    source: () => ApplicationArtifactSourceSchema,
  }
)

export type ApplicationArtifact = typeof applicationArtifacts.$inferSelect
