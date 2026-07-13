import { createSelectSchema } from 'drizzle-orm/effect-schema'
import { Schema } from 'effect'

import { UtcIsoTimestampSchema } from '../model/constraints'
import { ListingCheckEvidenceSchema } from '../model/listing-checks'
import {
  applicationListingCheckSchedules,
  applicationListingChecks,
  listingCheckRuns,
} from '../tables/listing-checks'

export const ApplicationListingCheckSchema = createSelectSchema(
  applicationListingChecks,
  {
    checkedAt: () => UtcIsoTimestampSchema,
    receivedAt: () => UtcIsoTimestampSchema,
    evidence: () => Schema.Array(ListingCheckEvidenceSchema),
    nextCheckAt: () => UtcIsoTimestampSchema,
  }
)

export type ApplicationListingCheck =
  typeof applicationListingChecks.$inferSelect

export const ListingCheckRunSchema = createSelectSchema(listingCheckRuns, {
  completedAt: () => UtcIsoTimestampSchema,
  startedAt: () => UtcIsoTimestampSchema,
})

export type ListingCheckRun = typeof listingCheckRuns.$inferSelect

export const ApplicationListingCheckScheduleSchema = createSelectSchema(
  applicationListingCheckSchedules,
  {
    dueAt: () => UtcIsoTimestampSchema,
    leaseUntil: () => UtcIsoTimestampSchema,
    updatedAt: () => UtcIsoTimestampSchema,
  }
)

export type ApplicationListingCheckSchedule =
  typeof applicationListingCheckSchedules.$inferSelect
