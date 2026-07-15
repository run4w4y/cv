import type { CursorCodec, CursorStateCodec } from '../cursor/index'
import type { FilterNode } from '../filtering/index'
import type { EffectiveOrderTerm } from '../ordering/index'
import type {
  PaginationPageInfo,
  PaginationResolution,
} from '../pagination/index'

/** @internal Static, renderer-independent description of one query definition. */
export type QueryDefinitionIr<FieldName extends string, CursorState = never> = {
  readonly identity: string
  readonly usesCursor: boolean
  readonly uniqueBy: readonly (readonly FieldName[])[]
  readonly defaultOrdering: readonly EffectiveOrderTerm<FieldName>[]
  readonly codec: CursorCodec | undefined
  readonly stateCodec: CursorStateCodec<CursorState> | undefined
  readonly contextFromState: ((state: CursorState) => unknown) | undefined
}

/** @internal Request state shared by every renderer for one resolved query. */
export type QueryRequestIr<
  FieldName extends string,
  Info extends PaginationPageInfo<Kind>,
  Kind extends string,
  CursorState = never,
> = {
  readonly filters: readonly FilterNode[]
  readonly ordering: readonly EffectiveOrderTerm<FieldName>[]
  readonly pagination: PaginationResolution<Info, Kind>
  readonly operatorContext: unknown
  readonly cursorIdentity: string | undefined
  readonly codec: CursorCodec | undefined
  readonly cursorState: CursorState | undefined
  readonly encodedCursorState: unknown
  readonly hasCursorState: boolean
}
