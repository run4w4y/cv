import type { AnyQueryDefinition, QueryRequestOf } from '@cv/drizzle-query'
import { Schema } from 'effect'

import { filterNodeSchema, orderingSchema } from './filtering'
import { paginationRequestSchemaFor } from './pagination'
import type { QuerySchemaDefinition } from './types'

export { paginationRequestSchemaFor } from './pagination'
export type { QuerySchemaDefinition } from './types'

/** @internal Builds the runtime request schema before exposing its public type. */
export const runtimeQueryRequestSchema = (definition: QuerySchemaDefinition) =>
  Schema.Struct({
    filters: Schema.optional(Schema.Array(filterNodeSchema(definition.fields))),
    orderBy: Schema.optional(orderingSchema(definition.fields)),
    pagination: Schema.optional(paginationRequestSchemaFor(definition)),
  })

/**
 * Derives an Effect Schema for the complete typed request accepted by a query
 * definition. Fields, operators, ordering names, operand values, and the
 * selected built-in pagination mode all come from that definition.
 */
export const queryRequestSchema = <Definition extends AnyQueryDefinition>(
  definition: QuerySchemaDefinition<Definition>
): Schema.Codec<QueryRequestOf<Definition>, unknown> =>
  runtimeQueryRequestSchema(definition) as unknown as Schema.Codec<
    QueryRequestOf<Definition>,
    unknown
  >
