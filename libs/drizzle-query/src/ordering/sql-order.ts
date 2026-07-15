import { asc, desc, type SQL, sql } from 'drizzle-orm'

import type { ResolvedOrderTerm } from './types'

export const explicitOrderBy = <FieldName extends string>(
  term: ResolvedOrderTerm<FieldName>
): readonly SQL[] => {
  const valueOrder =
    term.public.direction === 'asc'
      ? asc(term.sort.expression)
      : desc(term.sort.expression)

  // Avoid an unnecessary expression ahead of an indexable column when nulls
  // cannot occur. Nullable terms still need a dialect-neutral rank because
  // dialects disagree about their implicit null ordering.
  if (!term.sort.nullable) {
    return [valueOrder]
  }

  const rank =
    term.public.nulls === 'first'
      ? sql`case when ${term.sort.expression} is null then 0 else 1 end`
      : sql`case when ${term.sort.expression} is null then 1 else 0 end`

  return [asc(rank), valueOrder]
}
