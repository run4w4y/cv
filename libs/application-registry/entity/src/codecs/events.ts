import {
  createInsertSchema,
  createSelectSchema,
} from 'drizzle-orm/effect-schema'
import { Schema } from 'effect'

import { UtcIsoTimestampSchema } from '../model/constraints'
import { applicationEvents } from '../tables/events'

const applicationEventSelectRefinements = {
  occurredAt: () => UtcIsoTimestampSchema,
  recordedAt: () => UtcIsoTimestampSchema,
  payload: () => Schema.Json,
}

const applicationEventInsertRefinements = {
  occurredAt: UtcIsoTimestampSchema,
  recordedAt: UtcIsoTimestampSchema,
  payload: Schema.Json,
}

export const ApplicationEventSchema = createSelectSchema(
  applicationEvents,
  applicationEventSelectRefinements
)

export type ApplicationEvent = typeof applicationEvents.$inferSelect

export const ApplicationEventInsertSchema = createInsertSchema(
  applicationEvents,
  applicationEventInsertRefinements
)
