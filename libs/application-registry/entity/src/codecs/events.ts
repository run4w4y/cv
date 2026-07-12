import {
  createInsertSchema,
  createSelectSchema,
} from 'drizzle-orm/effect-schema'
import { Schema } from 'effect'

import { UtcIsoTimestampSchema } from '../model/constraints'
import { applicationEvents } from '../tables/events'
import { refineWith } from './refinements'

const applicationEventSelectRefinements = {
  occurredAt: refineWith(UtcIsoTimestampSchema),
  recordedAt: refineWith(UtcIsoTimestampSchema),
  payload: refineWith(Schema.Json),
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

export const ApplicationEventInsertSchema = createInsertSchema(
  applicationEvents,
  applicationEventInsertRefinements
)

export type ApplicationEvent = Schema.Schema.Type<typeof ApplicationEventSchema>
