import { schemaBinaryFilterOperator } from '@cv/drizzle-query-effect/schema'
import { between, eq, gt, gte, lt, lte, ne, notBetween } from 'drizzle-orm'
import { Schema } from 'effect'

import { UtcIsoTimestampSchema } from '../model/constraints'

const timestampValue = { type: 'date' as const }
const timestampRangeValue = {
  type: 'tuple' as const,
  items: [timestampValue, timestampValue] as const,
}

const timestampEq = schemaBinaryFilterOperator('eq', UtcIsoTimestampSchema, {
  valueDescriptor: timestampValue,
  compile: ({ expression, value }) => eq(expression, value),
})

const timestampNe = schemaBinaryFilterOperator('ne', UtcIsoTimestampSchema, {
  valueDescriptor: timestampValue,
  compile: ({ expression, value }) => ne(expression, value),
})

const timestampGt = schemaBinaryFilterOperator('gt', UtcIsoTimestampSchema, {
  valueDescriptor: timestampValue,
  compile: ({ expression, value }) => gt(expression, value),
})

const timestampGte = schemaBinaryFilterOperator('gte', UtcIsoTimestampSchema, {
  valueDescriptor: timestampValue,
  compile: ({ expression, value }) => gte(expression, value),
})

const timestampLt = schemaBinaryFilterOperator('lt', UtcIsoTimestampSchema, {
  valueDescriptor: timestampValue,
  compile: ({ expression, value }) => lt(expression, value),
})

const timestampLte = schemaBinaryFilterOperator('lte', UtcIsoTimestampSchema, {
  valueDescriptor: timestampValue,
  compile: ({ expression, value }) => lte(expression, value),
})

const TimestampRangeSchema = Schema.Tuple([
  UtcIsoTimestampSchema,
  UtcIsoTimestampSchema,
])

const timestampBetween = schemaBinaryFilterOperator(
  'between',
  TimestampRangeSchema,
  {
    valueDescriptor: timestampRangeValue,
    compile: ({ expression, value }) => between(expression, value[0], value[1]),
  }
)

const timestampNotBetween = schemaBinaryFilterOperator(
  'notBetween',
  TimestampRangeSchema,
  {
    valueDescriptor: timestampRangeValue,
    compile: ({ expression, value }) =>
      notBetween(expression, value[0], value[1]),
  }
)

/** UTC timestamp comparisons shared by registry query definitions. */
export const timestampFilterOperators = [
  timestampEq,
  timestampNe,
  timestampGt,
  timestampGte,
  timestampLt,
  timestampLte,
  timestampBetween,
  timestampNotBetween,
] as const
