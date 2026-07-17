import {
  type FilterNode,
  parseQueryFilterNodes,
  type QuerySearchParamsInput,
  queryParamValues,
  replaceQueryParam,
  serializeQueryFilterNodes,
} from '@cv/drizzle-query'
import {
  type EditableFilterCondition,
  emptyQueryFiltersState,
  filterNodesFromState,
  type QueryFilterDefinition,
  type QueryFilterFieldPresentation,
  type QueryFiltersState,
  resolveQueryFiltersState,
} from './model'

type SearchParamsLike = Exclude<QuerySearchParamsInput, string>

export type CanonicalQueryFiltersOptions = {
  readonly canonicalParamKey?: string
}

export type QueryFiltersUrlSource = 'canonical' | 'empty' | 'invalid'

export type DecodedQueryFiltersUrlState = {
  /** Untrusted-but-editable state, including incomplete conditions. */
  readonly editorState: QueryFiltersState
  /** Definition-valid state represented by `appliedFilters`. */
  readonly appliedState: QueryFiltersState
  /** The exact semantic value that can be forwarded to the query API. */
  readonly appliedFilters: readonly FilterNode[]
  /** Canonical decoded query value; absent when there are no valid filters. */
  readonly canonicalValue: string | undefined
  readonly source: QueryFiltersUrlSource
  /** Valid API filters that the current flat editor cannot represent. */
  readonly hasUnsupportedStructure: boolean
  /** Canonical filters valid for the API but hidden in this editor. */
  readonly hasUnsupportedEditorConditions: boolean
  /** Invalid canonical input must block reads instead of broadening the query. */
  readonly blocksRequest: boolean
  /** Whether the current URL should be replaced with `canonicalValue`. */
  readonly needsCanonicalWrite: boolean
}

export {
  normalizeQueryFilterNodes,
  parseQueryFilterNodes,
  serializeQueryFilterNodes,
} from '@cv/drizzle-query'

/**
 * Converts the subset currently rendered by the flat filter editor back to
 * editor state. The editor supports top-level AND and one top-level AND/OR
 * group; nested and NOT groups remain valid API shapes but are not editable.
 */
export const queryFiltersStateFromFilterNodes = (
  nodes: readonly FilterNode[]
): QueryFiltersState | undefined => {
  if (nodes.every((node) => node.type === 'condition')) {
    return {
      combinator: 'and',
      conditions: nodes as readonly EditableFilterCondition[],
    }
  }
  if (nodes.length !== 1) return undefined
  const [group] = nodes
  if (
    group?.type !== 'group' ||
    group.combinator === 'not' ||
    !group.children.every((node) => node.type === 'condition')
  ) {
    return undefined
  }
  return {
    combinator: group.combinator,
    conditions: group.children as readonly EditableFilterCondition[],
  }
}

export const parseCanonicalQueryFiltersState = (
  value: string | null | undefined
): QueryFiltersState | undefined => {
  const nodes = parseQueryFilterNodes(value)
  return nodes === undefined
    ? undefined
    : queryFiltersStateFromFilterNodes(nodes)
}

export const serializeCanonicalQueryFiltersState = (
  state: QueryFiltersState
): string | undefined => serializeQueryFilterNodes(filterNodesFromState(state))

const resolveFilterNode = (
  node: FilterNode,
  definition: QueryFilterDefinition
): FilterNode | undefined => {
  if (node.type === 'condition') {
    const resolved = resolveQueryFiltersState(
      { combinator: 'and', conditions: [node] },
      definition
    )
    return resolved.hasInvalidConditions
      ? undefined
      : (resolved.validConditions[0] as FilterNode | undefined)
  }

  const children = node.children.map((child) =>
    resolveFilterNode(child, definition)
  )
  if (children.some((child) => child === undefined)) return undefined
  return {
    ...node,
    children: children as unknown as typeof node.children,
  } as FilterNode
}

const resolveFilterNodes = (
  nodes: readonly FilterNode[],
  definition: QueryFilterDefinition
): readonly FilterNode[] | undefined => {
  const resolved = nodes.map((node) => resolveFilterNode(node, definition))
  return resolved.some((node) => node === undefined)
    ? undefined
    : (resolved as readonly FilterNode[])
}

/**
 * Reads the canonical browser filter parameter. Malformed or duplicate input
 * blocks the request so invalid URL state can never silently broaden a query.
 */
export const decodeQueryFiltersUrlState = (
  input: SearchParamsLike,
  definition: QueryFilterDefinition,
  presentation: Readonly<Record<string, QueryFilterFieldPresentation>> = {},
  { canonicalParamKey = 'filters' }: CanonicalQueryFiltersOptions = {}
): DecodedQueryFiltersUrlState => {
  const canonicalValues = queryParamValues(input, canonicalParamKey)

  let editorState = emptyQueryFiltersState()
  let source: QueryFiltersUrlSource = 'empty'
  let structurallyValid = true
  let unsupportedFilters: readonly FilterNode[] | undefined

  if (canonicalValues.length > 0) {
    source = 'canonical'
    if (canonicalValues.length !== 1) {
      structurallyValid = false
      source = 'invalid'
    } else {
      const canonical = canonicalValues[0] ?? ''
      const nodes = parseQueryFilterNodes(canonical)
      const canonicalState =
        nodes === undefined
          ? undefined
          : queryFiltersStateFromFilterNodes(nodes)
      if (canonicalState !== undefined) {
        editorState = canonicalState
      } else if (nodes !== undefined) {
        unsupportedFilters = nodes
      } else {
        structurallyValid = false
        source = 'invalid'
      }
    }
  }

  const resolved = structurallyValid
    ? resolveQueryFiltersState(editorState, definition)
    : resolveQueryFiltersState(emptyQueryFiltersState(), definition)
  const validatedUnsupportedFilters =
    unsupportedFilters === undefined
      ? undefined
      : resolveFilterNodes(unsupportedFilters, definition)
  const blocksRequest =
    source === 'invalid' ||
    (source === 'canonical' &&
      (resolved.hasInvalidConditions ||
        (unsupportedFilters !== undefined &&
          validatedUnsupportedFilters === undefined)))
  const editorResolution = resolveQueryFiltersState(
    editorState,
    definition,
    presentation
  )
  const hasUnsupportedEditorConditions =
    source === 'canonical' &&
    !blocksRequest &&
    editorResolution.hasInvalidConditions
  const appliedFilters = blocksRequest
    ? []
    : (validatedUnsupportedFilters ?? filterNodesFromState(resolved.validState))
  const canonicalValue = blocksRequest
    ? undefined
    : serializeQueryFilterNodes(appliedFilters)
  const currentCanonical =
    canonicalValues.length === 1 ? canonicalValues[0] : undefined
  const needsCanonicalWrite =
    !blocksRequest &&
    source === 'canonical' &&
    currentCanonical !== canonicalValue

  return {
    editorState,
    appliedState: resolved.validState,
    appliedFilters,
    canonicalValue,
    source,
    hasUnsupportedStructure: unsupportedFilters !== undefined,
    hasUnsupportedEditorConditions,
    blocksRequest,
    needsCanonicalWrite,
  }
}

/** Replaces only filter-related parameters, preserving unrelated URL state. */
export const writeCanonicalQueryFiltersUrlState = (
  input: URLSearchParams,
  canonicalValue: string | undefined,
  { canonicalParamKey = 'filters' }: CanonicalQueryFiltersOptions = {}
): URLSearchParams => {
  return replaceQueryParam(input, canonicalParamKey, canonicalValue)
}

export const areQueryFiltersStatesEqual = (
  left: QueryFiltersState,
  right: QueryFiltersState
): boolean =>
  serializeCanonicalQueryFiltersState(left) ===
  serializeCanonicalQueryFiltersState(right)
