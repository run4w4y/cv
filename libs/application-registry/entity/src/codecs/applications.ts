import { getColumns } from 'drizzle-orm'
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from 'drizzle-orm/effect-schema'
import { Schema } from 'effect'
import { omit, pick } from 'es-toolkit/object'

import { FitScoreSchema, UtcIsoTimestampSchema } from '../model/constraints'
import { OpportunityDetailsSchema } from '../model/details'
import { applications } from '../tables/applications'
import { optionalNullableInsertField } from './optional-nullable-insert-field'

const applicationSelectRefinements = {
  details: () => OpportunityDetailsSchema,
  fitScore: () => FitScoreSchema,
  followUpAt: () => UtcIsoTimestampSchema,
  appliedAt: () => UtcIsoTimestampSchema,
  lastContactAt: () => UtcIsoTimestampSchema,
  createdAt: () => UtcIsoTimestampSchema,
  updatedAt: () => UtcIsoTimestampSchema,
}

const applicationInsertRefinements = {
  details: optionalNullableInsertField(OpportunityDetailsSchema),
  fitScore: optionalNullableInsertField(FitScoreSchema),
  followUpAt: optionalNullableInsertField(UtcIsoTimestampSchema),
  appliedAt: optionalNullableInsertField(UtcIsoTimestampSchema),
  lastContactAt: optionalNullableInsertField(UtcIsoTimestampSchema),
  createdAt: UtcIsoTimestampSchema,
  updatedAt: UtcIsoTimestampSchema,
}

const applicationUpdateRefinements = {
  details: () => OpportunityDetailsSchema,
  fitScore: () => FitScoreSchema,
  followUpAt: () => UtcIsoTimestampSchema,
  appliedAt: () => UtcIsoTimestampSchema,
  lastContactAt: () => UtcIsoTimestampSchema,
  createdAt: () => UtcIsoTimestampSchema,
  updatedAt: () => UtcIsoTimestampSchema,
}

export const ApplicationRowSelectSchema = createSelectSchema(
  applications,
  applicationSelectRefinements
)

export const ApplicationRowInsertSchema = createInsertSchema(
  applications,
  applicationInsertRefinements
)

export const ApplicationRowUpdateSchema = createUpdateSchema(
  applications,
  applicationUpdateRefinements
)

export const applicationWritableKeys = [
  'jobKey',
  'source',
  'sourceJobId',
  'canonicalUrl',
  'company',
  'role',
  'location',
  'applicationStatus',
  'targetStage',
  'personalPriority',
  'fitScore',
  'category',
  'remotePolicy',
  'details',
  'openStatus',
  'sourceConfidence',
  'technologyStack',
  'recommendedAction',
  'researchPriority',
  'followUpAt',
  'appliedAt',
  'lastContactAt',
] as const satisfies readonly (keyof typeof ApplicationRowInsertSchema.fields)[]

export const ApplicationWritableSchema = Schema.Struct(
  pick(ApplicationRowInsertSchema.fields, applicationWritableKeys)
)

export type ApplicationWritable = Schema.Schema.Type<
  typeof ApplicationWritableSchema
>

export const applicationMutableKeys = [
  'applicationStatus',
  'targetStage',
  'personalPriority',
  'fitScore',
  'category',
  'remotePolicy',
  'details',
  'openStatus',
  'sourceConfidence',
  'technologyStack',
  'recommendedAction',
  'researchPriority',
  'followUpAt',
  'appliedAt',
  'lastContactAt',
] as const satisfies readonly (keyof typeof ApplicationRowUpdateSchema.fields)[]

export const ApplicationMutableSchema = Schema.Struct(
  pick(ApplicationRowUpdateSchema.fields, applicationMutableKeys)
)

export type ApplicationMutable = Schema.Schema.Type<
  typeof ApplicationMutableSchema
>

export const ApplicationSchema = Schema.Struct(
  omit(ApplicationRowSelectSchema.fields, ['companyNormalized'])
)

export type Application = Schema.Schema.Type<typeof ApplicationSchema>

export const applicationPublicColumns = omit(getColumns(applications), [
  'companyNormalized',
])
