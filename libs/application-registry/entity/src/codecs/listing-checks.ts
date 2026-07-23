import { createSelectSchema } from 'drizzle-orm/effect-schema'
import { Schema } from 'effect'

import { HttpUrlSchema, UtcIsoTimestampSchema } from '../model/constraints'
import { ListingCheckEvidenceSchema } from '../model/listing-checks'
import {
  type applicationListingCheckSchedules,
  applicationListingChecks,
  listingCheckRuns,
} from '../tables/listing-checks'

export const ApplicationListingCheckSchema = createSelectSchema(
  applicationListingChecks,
  {
    checkedAt: () => UtcIsoTimestampSchema,
    evidence: () => Schema.Array(ListingCheckEvidenceSchema),
    finalUrl: () => HttpUrlSchema,
    nextCheckAt: () => UtcIsoTimestampSchema,
    receivedAt: () => UtcIsoTimestampSchema,
    requestedUrl: () => HttpUrlSchema,
  }
)

export type ApplicationListingCheck =
  typeof applicationListingChecks.$inferSelect

export const ListingCheckRunSchema = createSelectSchema(listingCheckRuns, {
  completedAt: () => UtcIsoTimestampSchema,
  startedAt: () => UtcIsoTimestampSchema,
})

export type ListingCheckRun = typeof listingCheckRuns.$inferSelect

export type ApplicationListingCheckSchedule =
  typeof applicationListingCheckSchedules.$inferSelect
