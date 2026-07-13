import { createSelectSchema } from 'drizzle-orm/effect-schema'
import { Schema } from 'effect'

import { UtcIsoTimestampSchema } from '../model/constraints'
import { ListingCheckEvidenceSchema } from '../model/listing-checks'
import {
  applicationListingChecks,
  applicationListingCheckSchedules,
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

export type ApplicationListingCheck = Schema.Schema.Type<
  typeof ApplicationListingCheckSchema
>

export const ListingCheckRunSchema = createSelectSchema(listingCheckRuns, {
  completedAt: () => UtcIsoTimestampSchema,
  startedAt: () => UtcIsoTimestampSchema,
})

export type ListingCheckRun = Schema.Schema.Type<typeof ListingCheckRunSchema>

export const ApplicationListingCheckScheduleSchema = createSelectSchema(
  applicationListingCheckSchedules,
  {
    dueAt: () => UtcIsoTimestampSchema,
    leaseUntil: () => UtcIsoTimestampSchema,
    updatedAt: () => UtcIsoTimestampSchema,
  }
)

export type ApplicationListingCheckSchedule = Schema.Schema.Type<
  typeof ApplicationListingCheckScheduleSchema
>
