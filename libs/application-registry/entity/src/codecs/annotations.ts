import { createSelectSchema } from 'drizzle-orm/effect-schema'

import { UtcIsoTimestampSchema } from '../model/constraints'
import { applicationLabels, applicationNotes } from '../tables/annotations'

export type ApplicationLabel = typeof applicationLabels.$inferSelect

export const ApplicationLabelSchema = createSelectSchema(applicationLabels, {
  createdAt: () => UtcIsoTimestampSchema,
})

export type ApplicationNote = typeof applicationNotes.$inferSelect

export const ApplicationNoteSchema = createSelectSchema(applicationNotes, {
  createdAt: () => UtcIsoTimestampSchema,
  updatedAt: () => UtcIsoTimestampSchema,
})
