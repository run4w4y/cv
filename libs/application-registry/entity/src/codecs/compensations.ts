import {
  createInsertSchema,
  createSelectSchema,
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

export const compensationRangeOrderFilter = Schema.makeFilter(
  (value: {
    readonly maximumMinor?: number | null
    readonly minimumMinor?: number | null
  }) =>
    value.minimumMinor === undefined ||
    value.maximumMinor === undefined ||
    value.minimumMinor === null ||
    value.maximumMinor === null ||
    value.minimumMinor <= value.maximumMinor
      ? undefined
      : {
          path: ['maximumMinor'],
          issue:
            'Maximum compensation must be greater than or equal to minimum compensation.',
        }
)

export const ApplicationCompensationSchema = createSelectSchema(
  applicationCompensations,
  applicationCompensationSelectRefinements
).pipe(Schema.check(compensationRangeOrderFilter))

export type ApplicationCompensation =
  typeof applicationCompensations.$inferSelect

export const ApplicationCompensationInsertSchema = createInsertSchema(
  applicationCompensations,
  applicationCompensationInsertRefinements
)

export const ApplicationCompensationInputSchema = Schema.Struct(
  omit(ApplicationCompensationInsertSchema.fields, [
    'applicationId',
    'createdAt',
    'id',
    'updatedAt',
  ])
).pipe(Schema.check(compensationRangeOrderFilter))

export type ApplicationCompensationInput = Schema.Schema.Type<
  typeof ApplicationCompensationInputSchema
>
