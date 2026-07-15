export const CURSOR_VERSION = 2

/** @internal Reserved metadata key used by ordinary select projections. */
export const QUERY_METADATA_KEY = '__drizzleQuery' as const

/** @internal Prefix for flat cursor extras used by relational queries. */
export const CURSOR_EXTRA_PREFIX = '__drizzle_query_term_' as const
