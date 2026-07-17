import {
  areQueryFiltersStatesEqual,
  decodeQueryFiltersUrlState,
  emptyQueryFiltersState,
  parseCanonicalQueryFiltersState,
  parseQueryFilterNodes,
  type QueryFilterDefinition,
  type QueryFilterFieldPresentation,
  type QueryFiltersState,
  resolveQueryFiltersState,
  serializeCanonicalQueryFiltersState,
  writeCanonicalQueryFiltersUrlState,
} from '@cv/drizzle-query-ui'
import { createParser } from 'nuqs'
import * as React from 'react'

export const canonicalFiltersParser = createParser<QueryFiltersState>({
  parse: (value) =>
    parseCanonicalQueryFiltersState(value) ?? emptyQueryFiltersState(),
  serialize: (state) => serializeCanonicalQueryFiltersState(state) ?? '[]',
  eq: areQueryFiltersStatesEqual,
}).withDefault(emptyQueryFiltersState())

export const filterUrlSignature = (searchParams: URLSearchParams): string =>
  JSON.stringify(searchParams.getAll('filters'))

export const canonicalFilterUrlSignature = (
  canonicalValue: string | undefined
): string =>
  JSON.stringify(canonicalValue === undefined ? [] : [canonicalValue])

export type CanonicalQueryFiltersController = ReturnType<
  typeof useCanonicalQueryFilters
>

export const useCanonicalQueryFilters = ({
  searchParams,
  setSearchParams,
  definition,
  presentation,
  applyState,
}: {
  readonly searchParams: URLSearchParams
  readonly setSearchParams: (
    next: URLSearchParams,
    options: { readonly replace: boolean }
  ) => void
  readonly definition: QueryFilterDefinition
  readonly presentation?: Readonly<Record<string, QueryFilterFieldPresentation>>
  readonly applyState: (state: QueryFiltersState) => void
}) => {
  const locationSignature = filterUrlSignature(searchParams)
  const decoded = decodeQueryFiltersUrlState(
    searchParams,
    definition,
    presentation
  )
  const decodedEditorSignature = serializeCanonicalQueryFiltersState(
    decoded.editorState
  )
  const [editorState, setEditorState] = React.useState<QueryFiltersState>(
    decoded.editorState
  )
  const pendingSignature = React.useRef<string | null>(null)
  const [navigationTarget, setNavigationTarget] = React.useState<string | null>(
    null
  )

  // URL navigation is an external subscription boundary. Keep the editor in
  // sync with browser history, while preserving edits during our own write.
  React.useEffect(() => {
    if (pendingSignature.current === locationSignature) {
      pendingSignature.current = null
      setNavigationTarget((current) =>
        current === locationSignature ? null : current
      )
      return
    }
    setEditorState(
      decodedEditorSignature === undefined
        ? emptyQueryFiltersState()
        : (parseCanonicalQueryFiltersState(decodedEditorSignature) ??
            emptyQueryFiltersState())
    )
  }, [decodedEditorSignature, locationSignature])

  // Canonicalization changes browser state and therefore belongs in an effect,
  // not in render. Invalid URLs remain blocked and are never broadened.
  React.useEffect(() => {
    if (!decoded.needsCanonicalWrite) return
    const target = canonicalFilterUrlSignature(decoded.canonicalValue)
    pendingSignature.current = target
    setNavigationTarget(target)
    setSearchParams(
      writeCanonicalQueryFiltersUrlState(searchParams, decoded.canonicalValue),
      { replace: true }
    )
  }, [
    decoded.canonicalValue,
    decoded.needsCanonicalWrite,
    searchParams,
    setSearchParams,
  ])

  const resolved = resolveQueryFiltersState(
    editorState,
    definition,
    presentation
  )
  const queryFilters = parseQueryFilterNodes(decoded.canonicalValue ?? '') ?? []
  const requiresReplacement =
    decoded.hasUnsupportedStructure ||
    decoded.hasUnsupportedEditorConditions ||
    (decoded.blocksRequest && decoded.editorState.conditions.length === 0)

  const markNavigation = (canonicalValue: string | undefined) => {
    const target = canonicalFilterUrlSignature(canonicalValue)
    pendingSignature.current = target === locationSignature ? null : target
    setNavigationTarget(target === locationSignature ? null : target)
  }

  const replaceUneditable = () => {
    markNavigation(undefined)
    setEditorState(emptyQueryFiltersState())
    setSearchParams(
      writeCanonicalQueryFiltersUrlState(searchParams, undefined),
      { replace: true }
    )
  }

  const onEditorStateChange = (nextState: QueryFiltersState) => {
    setEditorState(nextState)
    const nextResolution = resolveQueryFiltersState(
      nextState,
      definition,
      presentation
    )
    if (nextResolution.hasInvalidConditions) return
    const nextStateToApply = nextResolution.validState
    markNavigation(serializeCanonicalQueryFiltersState(nextStateToApply))
    applyState(nextStateToApply)
  }

  return {
    decoded,
    editorState,
    locationSignature,
    markNavigation,
    navigationSettled: navigationTarget === null,
    onEditorStateChange,
    queryFilters,
    replaceUneditable,
    requiresReplacement,
    resolved,
    setEditorState,
  }
}
