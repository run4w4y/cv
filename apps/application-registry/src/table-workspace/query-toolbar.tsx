import {
  QueryFiltersPanel,
  QueryFiltersRoot,
  QueryFiltersToggle,
  type QueryFilterDefinition,
  type QueryFilterFieldPresentation,
} from '@cv/drizzle-query-ui'
import { Badge, Button } from '@cv/internal-ui'
import { RefreshCw, ShieldAlert } from 'lucide-react'
import type React from 'react'

import type { CanonicalQueryFiltersController } from './query-filters'

export const QueryWorkspaceToolbar = ({
  title,
  description,
  entityName,
  loadedCount,
  loading,
  refreshing,
  refreshDisabled,
  onRefresh,
  definition,
  presentation,
  filters,
  children,
}: {
  readonly title: string
  readonly description: string
  readonly entityName: string
  readonly loadedCount: number
  readonly loading: boolean
  readonly refreshing: boolean
  readonly refreshDisabled: boolean
  readonly onRefresh: () => void
  readonly definition: QueryFilterDefinition
  readonly presentation?: Readonly<Record<string, QueryFilterFieldPresentation>>
  readonly filters: CanonicalQueryFiltersController
  readonly children?: React.ReactNode
}) => (
  <header className="w-full min-w-full shrink-0 border-b border-border bg-card px-4 pt-4 pb-3 lg:px-5">
    <QueryFiltersRoot
      definition={definition}
      value={filters.editorState}
      onValueChange={filters.onEditorStateChange}
      fields={presentation}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-semibold tracking-tight">
              {title}
            </h1>
            <Badge variant="outline">
              {loading && loadedCount === 0
                ? 'Loading'
                : `${loadedCount} loaded`}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
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
            Invalid filters URL; the table request is blocked
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
        {filters.requiresReplacement ? (
          <Button
            type="button"
            variant="outline"
            onClick={filters.replaceUneditable}
          >
            Replace URL filters
          </Button>
        ) : (
          <QueryFiltersToggle />
        )}
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Refresh ${entityName}`}
          disabled={refreshDisabled}
          onClick={onRefresh}
        >
          <RefreshCw className={refreshing ? 'animate-spin' : undefined} />
        </Button>
      </div>
      {filters.requiresReplacement ? null : (
        <QueryFiltersPanel className="mt-3" />
      )}
    </QueryFiltersRoot>
  </header>
)
