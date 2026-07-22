import type { FilterNode } from '@cv/drizzle-query'
import {
  emptyQueryFiltersState,
  filterNodesFromState,
  type QueryFilterDefinition,
  type QueryFilterFieldPresentation,
  type QueryFiltersState,
  queryFiltersStateFromFilterNodes,
  resolveQueryFiltersState,
} from '@cv/drizzle-query-ui'
import * as React from 'react'

export type CanonicalQueryFiltersController = ReturnType<
  typeof useCanonicalQueryFilters
>

export const useCanonicalQueryFilters = ({
  searchParams,
  appliedFilters,
  blocksRequest,
  definition,
  presentation,
  onFiltersChange,
  onClearInvalidQuery,
}: {
  readonly searchParams: URLSearchParams
  readonly appliedFilters: readonly FilterNode[]
  readonly blocksRequest: boolean
  readonly definition: QueryFilterDefinition
  readonly presentation?: Readonly<Record<string, QueryFilterFieldPresentation>>
  readonly onFiltersChange: (filters: readonly FilterNode[] | undefined) => void
  readonly onClearInvalidQuery: () => void
}) => {
  const locationSignature = JSON.stringify(searchParams.getAll('filter'))
  const representedState = queryFiltersStateFromFilterNodes(appliedFilters)
  const editorStateFromUrl = representedState ?? emptyQueryFiltersState()
  const appliedResolution = resolveQueryFiltersState(
    editorStateFromUrl,
    definition
  )
  const editorResolution = resolveQueryFiltersState(
    editorStateFromUrl,
    definition,
    presentation
  )
  const hasUnsupportedStructure =
    !blocksRequest &&
    representedState === undefined &&
    appliedFilters.length > 0
  const hasUnsupportedEditorConditions =
    !blocksRequest &&
    !hasUnsupportedStructure &&
    editorResolution.hasInvalidConditions
  const decoded = {
    editorState: editorStateFromUrl,
    appliedState: appliedResolution.validState,
    appliedFilters,
    source: blocksRequest
      ? ('invalid' as const)
      : appliedFilters.length === 0
        ? ('empty' as const)
        : ('canonical' as const),
    hasUnsupportedStructure,
    hasUnsupportedEditorConditions,
    blocksRequest,
  }
  const [editorState, setEditorState] =
    React.useState<QueryFiltersState>(editorStateFromUrl)
  const editorStateFromUrlRef = React.useRef(editorStateFromUrl)
  editorStateFromUrlRef.current = editorStateFromUrl
  const previousLocationSignature = React.useRef(locationSignature)

  React.useEffect(() => {
    if (previousLocationSignature.current === locationSignature) return
    previousLocationSignature.current = locationSignature
    setEditorState(editorStateFromUrlRef.current)
  }, [locationSignature])

  const resolved = resolveQueryFiltersState(
    editorState,
    definition,
    presentation
  )
  const requiresReplacement =
    hasUnsupportedStructure ||
    hasUnsupportedEditorConditions ||
    (blocksRequest && editorStateFromUrl.conditions.length === 0)

  const replaceUneditable = () => {
    setEditorState(emptyQueryFiltersState())
    if (blocksRequest) onClearInvalidQuery()
    else onFiltersChange(undefined)
  }

  const onEditorStateChange = (nextState: QueryFiltersState) => {
    setEditorState(nextState)
    const nextResolution = resolveQueryFiltersState(
      nextState,
      definition,
      presentation
    )
    if (nextResolution.hasInvalidConditions) return
    const nextFilters = filterNodesFromState(nextResolution.validState)
    onFiltersChange(nextFilters.length === 0 ? undefined : nextFilters)
  }

  return {
    decoded,
    editorState,
    onEditorStateChange,
    queryFilters: appliedFilters,
    replaceUneditable,
    replacementLabel: blocksRequest
      ? 'Clear invalid query'
      : 'Replace URL filters',
    requiresReplacement,
    resolved,
    setEditorState,
  }
}
