import type { SQL, Table } from 'drizzle-orm'

import type { AnyQueryField } from '../../fields/index'
import type { PaginationPageInfo } from '../../pagination/index'
import type { QueryRequestIr } from '../../query/ir'
import {
  type CursorExtraKey,
  type FinalizedPage,
  finalizeRenderedRows,
  flatCursorReader,
  stripFlatCursorMetadata,
} from '../result'
import { createRelationalConfig } from './config'
import type {
  RelationalQueryConfig,
  RelationalRenderer,
  SelectableExpressionName,
} from './types'

export type { RelationalQueryConfig, SelectableExpressionName } from './types'

/**
 * A lazy view over shared query IR for Drizzle's relational query builder.
 * Consumers still own `columns`, `with`, the `findMany` call, and result mapping.
 */
export class RelationalQueryView<
  TTable extends Table,
  Fields extends readonly AnyQueryField[],
  FieldName extends string,
  Info extends PaginationPageInfo<Kind>,
  Kind extends string,
  Selected extends readonly SelectableExpressionName<Fields>[],
> {
  readonly #ir: QueryRequestIr<FieldName, Info, Kind, unknown>
  readonly #renderer: RelationalRenderer<Fields, FieldName, Kind>
  readonly #cursorKeys: readonly string[]
  readonly #privateKeys: readonly CursorExtraKey[]
  readonly #config: RelationalQueryConfig<TTable, Fields, Selected>

  /** @internal Created by a resolved query's relational renderer. */
  constructor(
    ir: QueryRequestIr<FieldName, Info, Kind, unknown>,
    renderer: RelationalRenderer<Fields, FieldName, Kind>,
    selected: Selected
  ) {
    this.#ir = ir
    this.#renderer = renderer

    const state = createRelationalConfig(
      ir,
      renderer,
      selected,
      (root) => this.where(root),
      (root) => this.orderBy(root)
    )
    this.#cursorKeys = state.cursorKeys
    this.#privateKeys = state.privateKeys
    this.#config = state.config
  }

  /** Fragment to spread into a relational `findMany` config. */
  get config(): RelationalQueryConfig<TTable, Fields, Selected> {
    return this.#config
  }

  /** Complete predicate rebound to the RQB root alias. */
  where(root: Table): SQL | undefined {
    return this.#renderer.render(root).where
  }

  /** Deterministic ordering rebound to the RQB root alias. */
  orderBy(root: Table): SQL[] {
    return [...this.#renderer.render(root).ordering.orderBy]
  }

  /** Finalizes look-ahead rows and removes private flat cursor extras. */
  finalize<Row>(
    rows: readonly Row[],
    totalItems?: number
  ): FinalizedPage<Row, Info> {
    const keys = this.#cursorKeys
    return finalizeRenderedRows(
      this.#ir,
      rows,
      totalItems,
      keys.length === 0 ? undefined : flatCursorReader(keys),
      (row) => stripFlatCursorMetadata(row, this.#privateKeys)
    )
  }
}
