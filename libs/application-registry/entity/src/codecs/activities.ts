import {
  createInsertSchema,
  createSelectSchema,
} from 'drizzle-orm/effect-schema'
import { Schema } from 'effect'

import { UtcIsoTimestampSchema } from '../model/constraints'
import { applicationActivities } from '../tables/activities'

const activityRefinements = {
  occurredAt: () => UtcIsoTimestampSchema,
  payload: () => Schema.Json,
}

export const ApplicationActivitySchema = createSelectSchema(
  applicationActivities,
  activityRefinements
)

export type ApplicationActivity = typeof applicationActivities.$inferSelect

export const ApplicationActivityInsertSchema = createInsertSchema(
  applicationActivities,
  {
    occurredAt: UtcIsoTimestampSchema,
    payload: Schema.Json,
  }
)
