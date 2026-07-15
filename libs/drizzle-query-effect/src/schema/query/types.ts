import type {
  AnyQueryDefinition,
  QueryFieldInfo,
  ResolvedPaginationOptions,
} from '@cv/drizzle-query'

/** Query-definition surface consumed by the Effect Schema integration. */
export type QuerySchemaDefinition<
  Definition extends AnyQueryDefinition = AnyQueryDefinition,
> = Definition & {
  readonly fields: readonly QueryFieldInfo[]
  readonly pagination: {
    readonly kind: string
    readonly options?: ResolvedPaginationOptions
  }
}
