import type { AnyQueryDefinition, QueryRequestOf } from '@cv/drizzle-query'
import type { Schema } from 'effect'

/** Additional query-string fields composed with a derived query request. */
export type QueryParamsExtras = Schema.Struct.Fields

/** @internal Decoded type represented by an extra Effect Schema field map. */
export type ExtrasType<Extras extends QueryParamsExtras> =
  Schema.Struct.Type<Extras>

/** @internal Encoded type represented by an extra Effect Schema field map. */
export type ExtrasEncoded<Extras extends QueryParamsExtras> =
  Schema.Struct.Encoded<Extras>

/** Decoded request produced by a query-parameter codec with extra fields. */
export type QueryParamsRequest<
  Definition extends AnyQueryDefinition,
  Extras extends QueryParamsExtras,
> = QueryRequestOf<Definition> & ExtrasType<Extras>

/** Encoded HTTP query fields produced by a query-parameter codec. */
export type EncodedQueryParams<Extras extends QueryParamsExtras> = {
  readonly filters?: string
  readonly orderBy?: string
  readonly after?: string
  readonly page?: string
  readonly size?: string
} & ExtrasEncoded<Extras>

/** Options for deriving an HTTP query-parameter codec. */
export interface QueryParamsSchemaOptions<
  Extras extends QueryParamsExtras = Record<never, never>,
> {
  /** Consumer-owned flat query parameters composed with the generic request. */
  readonly extras?: Extras
}
