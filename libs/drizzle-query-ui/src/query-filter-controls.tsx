import {
  Button,
  cn,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@cv/internal-ui'
import { Filter, Plus, Search } from 'lucide-react'
import * as React from 'react'

import { QueryFiltersChips } from './query-filter-chips'
import { QueryFiltersRows } from './query-filter-rows'
import { useQueryFilters } from './query-filters-context'

export const QueryFiltersAddButton = () => {
  const context = useQueryFilters()
  const [query, setQuery] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const normalizedQuery = query.trim().toLocaleLowerCase('en-US')
  const visibleFields = context.fields.filter((field) =>
    `${field.label} ${field.name}`
      .toLocaleLowerCase('en-US')
      .includes(normalizedQuery)
  )

  if (context.fields.length === 0) return null

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setQuery('')
      }}
    >
      <PopoverTrigger
        render={
          <Button type="button" className="h-10 shrink-0">
            <Plus />
            Add filter
          </Button>
        }
      />
      <PopoverContent
        id="query-filter-field-picker"
        align="start"
        className="w-[calc(100vw-2rem)] max-w-70 overflow-hidden p-0 shadow-md"
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search fields..."
            aria-label="Search filter fields"
            className="h-10 min-w-0 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            autoFocus
          />
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {visibleFields.map((field) => (
            <button
              key={field.name}
              type="button"
              onClick={() => {
                context.addCondition(field)
                setOpen(false)
                setQuery('')
              }}
              className="flex min-h-9 w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-left text-sm font-medium outline-none hover:bg-muted focus-visible:bg-muted"
            >
              {field.label}
            </button>
          ))}
          {visibleFields.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No fields found.
            </p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export const QueryFiltersToggle = ({
  className,
}: {
  readonly className?: string
}) => {
  const context = useQueryFilters()

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className}
      aria-expanded={context.expanded}
      onClick={() => context.setExpanded(!context.expanded)}
    >
      <Filter />
      {context.expanded ? 'Hide filters' : 'Show filters'}
      {context.value.conditions.length > 0 ? (
        <span className="ml-1 flex size-5 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {context.value.conditions.length}
        </span>
      ) : null}
    </Button>
  )
}

export const QueryFiltersPanel = ({
  className,
  showChips = true,
}: {
  readonly className?: string
  readonly showChips?: boolean
}) => {
  const context = useQueryFilters()
  const hasFilters = context.value.conditions.length > 0

  if (!hasFilters && !context.expanded) return null

  return (
    <div className={cn('space-y-3', className)} data-slot="query-filters-panel">
      {showChips && hasFilters ? <QueryFiltersChips /> : null}
      <div
        hidden={!context.expanded}
        data-state={context.expanded ? 'open' : 'closed'}
        data-slot="query-filters-editor"
      >
        <div className="flex flex-wrap items-start gap-2.5">
          <QueryFiltersAddButton />
          <QueryFiltersRows className="min-w-0" />
        </div>
      </div>
    </div>
  )
}
