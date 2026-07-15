import { schemaBinaryFilterOperator } from '@cv/drizzle-query-effect/schema'
import { gt, gte, lt, lte } from 'drizzle-orm'

import { UtcIsoTimestampSchema } from '../model/constraints'

const timestampGt = schemaBinaryFilterOperator('gt', UtcIsoTimestampSchema, {
  compile: ({ expression, value }) => gt(expression, value),
})

const timestampGte = schemaBinaryFilterOperator('gte', UtcIsoTimestampSchema, {
  compile: ({ expression, value }) => gte(expression, value),
})

const timestampLt = schemaBinaryFilterOperator('lt', UtcIsoTimestampSchema, {
  compile: ({ expression, value }) => lt(expression, value),
})

const timestampLte = schemaBinaryFilterOperator('lte', UtcIsoTimestampSchema, {
  compile: ({ expression, value }) => lte(expression, value),
})

/** UTC timestamp comparisons shared by registry query definitions. */
export const timestampFilterOperators = [
  timestampGt,
  timestampGte,
  timestampLt,
  timestampLte,
] as const
