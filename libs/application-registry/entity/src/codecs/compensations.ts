import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from 'drizzle-orm/effect-schema'
import { Schema } from 'effect'
import { omit } from 'es-toolkit/object'

import {
  CurrencyCodeSchema,
  NonNegativeMinorAmountSchema,
  UtcIsoTimestampSchema,
} from '../model/constraints'
import { applicationCompensations } from '../tables/compensations'
import { optionalNullableInsertField } from './optional-nullable-insert-field'

const applicationCompensationSelectRefinements = {
  currencyCode: () => CurrencyCodeSchema,
  minimumMinor: () => NonNegativeMinorAmountSchema,
  maximumMinor: () => NonNegativeMinorAmountSchema,
  createdAt: () => UtcIsoTimestampSchema,
  updatedAt: () => UtcIsoTimestampSchema,
}

const applicationCompensationInsertRefinements = {
  currencyCode: CurrencyCodeSchema,
  minimumMinor: optionalNullableInsertField(NonNegativeMinorAmountSchema),
  maximumMinor: optionalNullableInsertField(NonNegativeMinorAmountSchema),
  createdAt: UtcIsoTimestampSchema,
  updatedAt: UtcIsoTimestampSchema,
}

const applicationCompensationUpdateRefinements = {
  currencyCode: () => CurrencyCodeSchema,
  minimumMinor: () => NonNegativeMinorAmountSchema,
  maximumMinor: () => NonNegativeMinorAmountSchema,
  createdAt: () => UtcIsoTimestampSchema,
  updatedAt: () => UtcIsoTimestampSchema,
}

export const ApplicationCompensationSchema = createSelectSchema(
  applicationCompensations,
  applicationCompensationSelectRefinements
)

export type ApplicationCompensation =
  typeof applicationCompensations.$inferSelect

export const ApplicationCompensationInsertSchema = createInsertSchema(
  applicationCompensations,
  applicationCompensationInsertRefinements
)

export const ApplicationCompensationUpdateSchema = createUpdateSchema(
  applicationCompensations,
  applicationCompensationUpdateRefinements
)

export const ApplicationCompensationInputSchema = Schema.Struct(
  omit(ApplicationCompensationInsertSchema.fields, [
    'applicationId',
    'createdAt',
    'id',
    'updatedAt',
  ])
)

export type ApplicationCompensationInput = Schema.Schema.Type<
  typeof ApplicationCompensationInputSchema
>
