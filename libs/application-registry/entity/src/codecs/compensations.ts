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
import { optionalNullable, refineWith } from './refinements'

const applicationCompensationSelectRefinements = {
  currencyCode: refineWith(CurrencyCodeSchema),
  minimumMinor: refineWith(NonNegativeMinorAmountSchema),
  maximumMinor: refineWith(NonNegativeMinorAmountSchema),
  createdAt: refineWith(UtcIsoTimestampSchema),
  updatedAt: refineWith(UtcIsoTimestampSchema),
}

const applicationCompensationInsertRefinements = {
  currencyCode: CurrencyCodeSchema,
  minimumMinor: optionalNullable(NonNegativeMinorAmountSchema),
  maximumMinor: optionalNullable(NonNegativeMinorAmountSchema),
  createdAt: UtcIsoTimestampSchema,
  updatedAt: UtcIsoTimestampSchema,
}

const applicationCompensationUpdateRefinements = {
  currencyCode: refineWith(CurrencyCodeSchema),
  minimumMinor: refineWith(NonNegativeMinorAmountSchema),
  maximumMinor: refineWith(NonNegativeMinorAmountSchema),
  createdAt: refineWith(UtcIsoTimestampSchema),
  updatedAt: refineWith(UtcIsoTimestampSchema),
}

export const ApplicationCompensationSchema = createSelectSchema(
  applicationCompensations,
  applicationCompensationSelectRefinements
)

export const ApplicationCompensationInsertSchema = createInsertSchema(
  applicationCompensations,
  applicationCompensationInsertRefinements
)

export const ApplicationCompensationUpdateSchema = createUpdateSchema(
  applicationCompensations,
  applicationCompensationUpdateRefinements
)

export type ApplicationCompensation = Schema.Schema.Type<
  typeof ApplicationCompensationSchema
>

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
