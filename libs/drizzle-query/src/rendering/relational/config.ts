import { type SQL, type SQLWrapper, sql, type Table } from 'drizzle-orm'

import { CURSOR_EXTRA_PREFIX } from '../../cursor/constants'
import { QueryError } from '../../error'
import type { AnyQueryField } from '../../fields/index'
import type { PaginationPageInfo } from '../../pagination/index'
import type { QueryRequestIr } from '../../query/ir'
import type { CursorExtraKey } from '../result'
import type {
  RelationalQueryConfig,
  RelationalRenderer,
  SelectableExpressionName,
  SelectedExpressionExtras,
} from './types'

/** @internal Config plus target-specific cursor metadata used by finalization. */
export type RelationalConfigState<
  TTable extends Table,
  Fields extends readonly AnyQueryField[],
  Selected extends readonly SelectableExpressionName<Fields>[],
> = {
  readonly config: RelationalQueryConfig<TTable, Fields, Selected>
  readonly cursorKeys: readonly string[]
  readonly privateKeys: readonly CursorExtraKey[]
}

/** @internal Builds the package-owned fragment of one RQB `findMany` config. */
export const createRelationalConfig = <
  TTable extends Table,
  Fields extends readonly AnyQueryField[],
  FieldName extends string,
  Info extends PaginationPageInfo<Kind>,
  Kind extends string,
  Selected extends readonly SelectableExpressionName<Fields>[],
>(
  ir: QueryRequestIr<FieldName, Info, Kind, unknown>,
  renderer: RelationalRenderer<Fields, FieldName, Kind>,
  selected: Selected,
  where: (root: Table) => SQL | undefined,
  orderBy: (root: Table) => SQL[]
): RelationalConfigState<TTable, Fields, Selected> => {
  const selectedNames = new Set<string>(selected)
  const publicExtras = Object.fromEntries(
    selected.map((name) => [
      name,
      (root: TTable): SQL<unknown> => {
        const field = renderer.bind(root).registry.get(name)
        if (field?.origin !== 'expression' || field.selection === undefined) {
          throw new QueryError(
            'invalid-definition',
            `The query field "${name}" is not a selectable expression.`,
            { path: `fields.${name}` }
          )
        }
        return field.expression.getSQL()
      },
    ])
  )

  const cursorFields =
    ir.cursorIdentity === undefined ? [] : ir.ordering.map(({ field }) => field)
  const cursorKeys = cursorFields.map((field, index) =>
    selectedNames.has(field) && renderer.canReuseCursorValue(field)
      ? field
      : `${CURSOR_EXTRA_PREFIX}${index}`
  )
  const privateKeys = cursorKeys.filter((key): key is CursorExtraKey =>
    key.startsWith(CURSOR_EXTRA_PREFIX)
  )
  const privateExtras = Object.fromEntries(
    privateKeys.map((key) => {
      const index = Number(key.slice(CURSOR_EXTRA_PREFIX.length))
      return [
        key,
        (root: TTable): SQLWrapper => {
          const projection =
            renderer.render(root).ordering.cursorProjections[index]
          if (projection === undefined) {
            throw new QueryError(
              'invalid-ordering',
              'The relational cursor projection is incomplete.',
              { path: `ordering[${index}]` }
            )
          }
          return projection.selection
        },
      ]
    })
  )
  const extras = { ...publicExtras, ...privateExtras }
  const hasWhere =
    ir.filters.length > 0 || ir.pagination.cursorValues !== undefined
  const offset = ir.pagination.offset

  return {
    config: {
      ...(hasWhere
        ? { where: { RAW: (root: TTable) => where(root) ?? sql`1 = 1` } }
        : {}),
      orderBy: (root: TTable) => orderBy(root),
      limit: ir.pagination.limit,
      ...(offset === undefined ? {} : { offset }),
      // Private cursor extras exist only at runtime. Erasing their names keeps
      // Drizzle from adding package metadata to the inferred result row.
      extras: extras as SelectedExpressionExtras<TTable, Fields, Selected>,
    },
    cursorKeys,
    privateKeys,
  }
}
