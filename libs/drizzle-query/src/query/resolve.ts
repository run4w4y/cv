import { cursorQueryIdentity, decodeCursorContinuation } from '../cursor/index'
import { QueryError } from '../error'
import type { AnyQueryField, FieldRuntime } from '../fields/index'
import { bindOrderingTerms, resolveOrdering } from '../ordering/resolve'
import type { PaginationInfoOf } from '../pagination/index'
import type { QueryDefinitionIr, QueryRequestIr } from './ir'
import type {
  AnyPagination,
  QueryContext,
  QueryRequest,
  QueryResolveOptions,
  SortableFieldName,
} from './types'

type ResolutionState<
  Fields extends readonly AnyQueryField[],
  Pagination extends AnyPagination,
  CursorState,
> = {
  readonly registry: ReadonlyMap<string, FieldRuntime>
  readonly pagination: Pagination
  readonly ir: QueryDefinitionIr<SortableFieldName<Fields>, CursorState>
}

const requiredCursorState = <State>(state: State | undefined): State => {
  if (state === undefined) {
    throw new QueryError(
      'invalid-pagination',
      'This query requires state for the first cursor page.',
      { path: 'cursor.state' }
    )
  }
  return state
}

/** @internal Resolves one typed request into renderer-independent query IR. */
export const resolveQueryRequest = <
  Fields extends readonly AnyQueryField[],
  Pagination extends AnyPagination,
  CursorState = never,
>(
  state: ResolutionState<Fields, Pagination, CursorState>,
  request: QueryRequest<Fields, Pagination>,
  options: QueryResolveOptions<QueryContext<Fields>, CursorState>
): QueryRequestIr<
  SortableFieldName<Fields>,
  PaginationInfoOf<Pagination>,
  Pagination['kind'],
  CursorState
> => {
  const filters = request.filters ?? []
  const ordering =
    request.orderBy === undefined || request.orderBy.length === 0
      ? state.ir.defaultOrdering
      : resolveOrdering<SortableFieldName<Fields>>(
          state.registry,
          request.orderBy,
          {
            uniqueBy: state.ir.uniqueBy,
          }
        ).terms

  let cursorState = options.cursor?.initialState
  const identityFor = (resolvedState: CursorState | undefined): string =>
    cursorQueryIdentity({
      definition: state.ir.identity,
      filters,
      order: ordering.map(({ field, direction, nulls }) => ({
        field,
        direction,
        nulls,
      })),
      ...(options.cursorBinding === undefined &&
      state.ir.stateCodec === undefined
        ? {}
        : {
            consumer: {
              ...(options.cursorBinding === undefined
                ? {}
                : { binding: options.cursorBinding }),
              ...(state.ir.stateCodec === undefined
                ? {}
                : { state: requiredCursorState(resolvedState) }),
            },
          }),
    })
  const valueTypes = bindOrderingTerms(state.registry, ordering).map(
    (term) => term.sort.cursorType
  )
  const cursor = !state.ir.usesCursor
    ? undefined
    : {
        decode: (token: string) => {
          const decoded = decodeCursorContinuation(token, {
            query: identityFor,
            valueTypes,
            ...(state.ir.codec === undefined ? {} : { codec: state.ir.codec }),
            ...(state.ir.stateCodec === undefined
              ? {}
              : { stateCodec: state.ir.stateCodec }),
            path: 'pagination.after',
          })
          cursorState = decoded.state
          return decoded.values
        },
      }
  const pagination = state.pagination.compile(
    request.pagination,
    cursor === undefined ? {} : { cursor }
  )
  if (state.ir.usesCursor && state.ir.stateCodec !== undefined) {
    requiredCursorState(cursorState)
  }
  const cursorIdentity = state.ir.usesCursor
    ? identityFor(cursorState)
    : undefined
  let encodedCursorState: unknown
  if (state.ir.stateCodec !== undefined) {
    try {
      encodedCursorState = state.ir.stateCodec.encode(
        requiredCursorState(cursorState)
      )
    } catch (cause) {
      if (cause instanceof QueryError) throw cause
      throw new QueryError(
        'invalid-cursor',
        'Could not encode the cursor state.',
        { cause, path: 'cursor.state' }
      )
    }
  }
  const operatorContext =
    state.ir.contextFromState === undefined
      ? options.context
      : state.ir.contextFromState(requiredCursorState(cursorState))

  return {
    filters,
    ordering,
    pagination,
    operatorContext,
    cursorIdentity,
    codec: state.ir.codec,
    cursorState,
    encodedCursorState,
    hasCursorState: state.ir.stateCodec !== undefined,
  }
}
