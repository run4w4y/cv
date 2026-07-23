import {
  type QueryFilterDefinition,
  type QueryFilterFieldPresentation,
  QueryFiltersPanel,
  QueryFiltersRoot,
  QueryFiltersToggle,
} from '@cv/drizzle-query-ui'
import { Badge, Button } from '@cv/internal-ui'
import { ShieldAlert } from 'lucide-react'
import type React from 'react'

import { HeaderActions } from '../shell/header-actions'
import type { CanonicalQueryFiltersController } from './query-filters'

export const QueryWorkspaceToolbar = ({
  title,
  totalCount,
  loading,
  definition,
  presentation,
  filters,
  children,
}: {
  readonly title: string
  readonly totalCount?: number
  readonly loading: boolean
  readonly definition: QueryFilterDefinition
  readonly presentation?: Readonly<Record<string, QueryFilterFieldPresentation>>
  readonly filters: CanonicalQueryFiltersController
  readonly children?: React.ReactNode
}) => (
  <header className="w-full min-w-full shrink-0 border-b border-border bg-card px-4 py-3 lg:px-5">
    <QueryFiltersRoot
      definition={definition}
      value={filters.editorState}
      onValueChange={filters.onEditorStateChange}
      fields={presentation}
    >
      <HeaderActions>
        {filters.requiresReplacement ? (
          <Button
            type="button"
            variant="outline"
            onClick={filters.replaceUneditable}
          >
            {filters.replacementLabel}
          </Button>
        ) : (
          <QueryFiltersToggle />
        )}
      </HeaderActions>
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-semibold tracking-tight">
              {title}
            </h1>
            {loading && totalCount === undefined ? (
              <Badge variant="outline">Loading</Badge>
            ) : totalCount === undefined ? null : (
              <Badge variant="outline">{totalCount} total</Badge>
            )}
          </div>
        </div>
        {children}
        {filters.resolved.hasInvalidConditions &&
        !filters.decoded.hasUnsupportedEditorConditions ? (
          <Badge
            variant="warning"
            role="alert"
            className="min-h-8 max-w-full whitespace-normal"
          >
            <ShieldAlert className="size-3.5" />
            Finish or remove {filters.resolved.issues.length} incomplete or
            invalid{' '}
            {filters.resolved.issues.length === 1 ? 'filter' : 'filters'} before
            applying changes
          </Badge>
        ) : null}
        {filters.decoded.blocksRequest ? (
          <Badge
            variant="warning"
            role="alert"
            className="min-h-8 max-w-full whitespace-normal"
          >
            <ShieldAlert className="size-3.5" />
            Invalid query URL; the table request is blocked
          </Badge>
        ) : null}
        {(filters.decoded.hasUnsupportedStructure ||
          filters.decoded.hasUnsupportedEditorConditions) &&
        !filters.decoded.blocksRequest ? (
          <Badge
            variant="warning"
            role="alert"
            className="min-h-8 max-w-full whitespace-normal"
          >
            <ShieldAlert className="size-3.5" />
            URL filters are applied, but this editor cannot display them yet
          </Badge>
        ) : null}
      </div>
      {filters.requiresReplacement ? null : (
        <QueryFiltersPanel className="mt-3" />
      )}
    </QueryFiltersRoot>
  </header>
)
