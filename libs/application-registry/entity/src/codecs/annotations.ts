import { createSelectSchema } from 'drizzle-orm/effect-schema'
import type { Schema } from 'effect'

import { UtcIsoTimestampSchema } from '../model/constraints'
import { applicationLabels, applicationNotes } from '../tables/annotations'

export const ApplicationLabelSchema = createSelectSchema(applicationLabels, {
  createdAt: () => UtcIsoTimestampSchema,
})

export type ApplicationLabel = Schema.Schema.Type<typeof ApplicationLabelSchema>

export const ApplicationNoteSchema = createSelectSchema(applicationNotes, {
  createdAt: () => UtcIsoTimestampSchema,
  updatedAt: () => UtcIsoTimestampSchema,
})

export type ApplicationNote = Schema.Schema.Type<typeof ApplicationNoteSchema>
