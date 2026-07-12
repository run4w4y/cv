import { createSelectSchema } from 'drizzle-orm/effect-schema'
import type { Schema } from 'effect'

import { UtcIsoTimestampSchema } from '../model/constraints'
import { applicationLabels, applicationNotes } from '../tables/annotations'
import { refineWith } from './refinements'

export const ApplicationLabelSchema = createSelectSchema(applicationLabels, {
  createdAt: refineWith(UtcIsoTimestampSchema),
})

export type ApplicationLabel = Schema.Schema.Type<typeof ApplicationLabelSchema>

export const ApplicationNoteSchema = createSelectSchema(applicationNotes, {
  createdAt: refineWith(UtcIsoTimestampSchema),
  updatedAt: refineWith(UtcIsoTimestampSchema),
})

export type ApplicationNote = Schema.Schema.Type<typeof ApplicationNoteSchema>
