import { omit } from 'es-toolkit/object'
import { isPlainObject } from 'es-toolkit/predicate'
import {
  type CURSOR_EXTRA_PREFIX,
  QUERY_METADATA_KEY,
} from '../cursor/constants'
import { encodeCursor } from '../cursor/index'
import { QueryError } from '../error'
import type { PaginationPageInfo } from '../pagination/index'
import type { QueryRequestIr } from '../query/ir'

export { QUERY_METADATA_KEY }

/** Private extras key-space used by Drizzle's relational query builder. */
export type CursorExtraKey = `${typeof CURSOR_EXTRA_PREFIX}${number}`

/** A finalized API page with target-private cursor metadata removed. */
export type FinalizedPage<Row, Info> = {
  readonly items: readonly Row[]
  readonly pageInfo: Info
}

/** Row reader supplied by a concrete rendering target. */
export type CursorValueReader = (row: unknown) => readonly unknown[]

const objectRow = (row: unknown): Readonly<Record<string, unknown>> => {
  if (!isPlainObject(row)) {
    throw new QueryError(
      'invalid-ordering',
      'A cursor can only be created from an object row.',
      { path: 'row' }
    )
  }
  return row
}

/** Reads nested cursor metadata emitted by an ordinary select projection. */
export const nestedCursorReader = (
  aliases: readonly CursorExtraKey[]
): CursorValueReader => {
  return (row) => {
    const metadata = objectRow(row)[QUERY_METADATA_KEY]
    if (!isPlainObject(metadata)) {
      throw new QueryError(
        'invalid-ordering',
        `The row is missing the "${QUERY_METADATA_KEY}" ordering selection.`,
        { path: `row.${QUERY_METADATA_KEY}` }
      )
    }
    return aliases.map((alias) => metadata[alias])
  }
}

/** Reads cursor values emitted as private relational-query extras. */
export const flatCursorReader =
  (keys: readonly string[]): CursorValueReader =>
  (row) => {
    const record = objectRow(row)
    return keys.map((key) => record[key])
  }

/** Removes ordinary-select metadata without changing the source row. */
export const stripNestedCursorMetadata = <Row>(row: Row): Row => {
  if (!isPlainObject(row) || !(QUERY_METADATA_KEY in row)) return row
  return omit(row, [QUERY_METADATA_KEY]) as Row
}

/** Removes private relational extras without changing the source row. */
export const stripFlatCursorMetadata = <Row>(
  row: Row,
  keys: readonly CursorExtraKey[]
): Row => {
  if (!isPlainObject(row) || keys.length === 0) return row
  return omit(row, keys) as Row
}

/** Finalizes look-ahead rows using the cursor projection of one renderer. */
export const finalizeRenderedRows = <
  Row,
  FieldName extends string,
  Info extends PaginationPageInfo<Kind>,
  Kind extends string,
>(
  ir: QueryRequestIr<FieldName, Info, Kind, unknown>,
  rows: readonly Row[],
  totalItems: number | undefined,
  readCursorValues: CursorValueReader | undefined,
  strip: (row: Row) => Row
): FinalizedPage<Row, Info> => {
  const cursorIdentity = ir.cursorIdentity
  const encode =
    cursorIdentity === undefined || readCursorValues === undefined
      ? undefined
      : (row: unknown) =>
          encodeCursor(readCursorValues(row), {
            query: cursorIdentity,
            ...(ir.codec === undefined ? {} : { codec: ir.codec }),
            ...(ir.hasCursorState
              ? { encodedState: ir.encodedCursorState }
              : {}),
            path: 'cursor',
          })
  const page = ir.pagination.finish(
    rows,
    totalItems,
    encode === undefined ? {} : { encodeCursor: encode }
  )

  return {
    items: page.items.map(strip),
    pageInfo: page.pageInfo,
  }
}
