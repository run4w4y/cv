import type { RegistryActivityListItem } from '@cv/application-registry-api-contract'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@cv/internal-ui'
import {
  flexRender,
  getCoreRowModel,
  type OnChangeFn,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from '@tanstack/react-table'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  History,
  LoaderCircle,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { HeaderActions } from '../../../shell/header-actions'
import { useInfiniteScroll } from '../../../table-workspace/use-infinite-scroll'
import {
  type EventsSavedViewState,
  type EventsTableDensity,
  EventsViewMenu,
} from '../saved-views'
import { eventColumns } from './columns'

const densityClasses: Readonly<Record<EventsTableDensity, string>> = {
  compact: 'py-2',
  comfortable: 'py-3',
  spacious: 'py-4',
}

const coreRowModel = getCoreRowModel()

const SkeletonRows = ({
  count,
  columns,
  density,
}: {
  readonly count: number
  readonly columns: readonly { readonly id: string }[]
  readonly density: EventsTableDensity
}) => (
  <>
    {Array.from({ length: count }, (_, index) => `skeleton-${index}`).map(
      (key, rowIndex) => (
        <TableRow key={key} aria-hidden>
          {columns.map((column, columnIndex) => (
            <TableCell key={column.id} className={densityClasses[density]}>
              <Skeleton
                className={
                  (rowIndex + columnIndex) % 3 === 0 ? 'h-4 w-32' : 'h-4 w-20'
                }
              />
            </TableCell>
          ))}
        </TableRow>
      )
    )}
  </>
)

export const EventsTable = ({
  data,
  loading,
  refreshing,
  loadingMore,
  hasNextPage,
  sorting,
  onSortingChange,
  density,
  onDensityChange,
  columnVisibility,
  onColumnVisibilityChange,
  currentViewState,
  onApplyView,
  onLoadMore,
}: {
  readonly data: RegistryActivityListItem[]
  readonly loading: boolean
  readonly refreshing: boolean
  readonly loadingMore: boolean
  readonly hasNextPage: boolean
  readonly sorting: SortingState
  readonly onSortingChange: OnChangeFn<SortingState>
  readonly density: EventsTableDensity
  readonly onDensityChange: (density: EventsTableDensity) => void
  readonly columnVisibility: VisibilityState
  readonly onColumnVisibilityChange: OnChangeFn<VisibilityState>
  readonly currentViewState: EventsSavedViewState
  readonly onApplyView: (state: EventsSavedViewState) => void
  readonly onLoadMore: () => void
}) => {
  const navigate = useNavigate()
  const table = useReactTable({
    data,
    columns: eventColumns,
    getCoreRowModel: coreRowModel,
    manualSorting: true,
    enableMultiSort: true,
    state: { sorting, columnVisibility },
    onSortingChange,
    onColumnVisibilityChange,
  })
  const { rootRef, sentinelRef } = useInfiniteScroll({
    enabled: hasNextPage && !loading && !refreshing && !loadingMore,
    onLoadMore,
    rootMargin: '240px 0px',
  })

  const tableWidth = table.getTotalSize()
  const visibleColumns = table.getVisibleLeafColumns()

  return (
    <div
      ref={rootRef}
      className="relative isolate min-h-0 min-w-full flex-1 overflow-auto overscroll-contain"
    >
      <HeaderActions>
        <EventsViewMenu
          table={table}
          density={density}
          onDensityChange={onDensityChange}
          currentState={currentViewState}
          onApply={onApplyView}
        />
      </HeaderActions>

      {refreshing ? (
        <div
          data-slot="activities-refresh-overlay"
          className="pointer-events-none sticky top-0 left-0 z-20 flex h-0 w-full min-w-full justify-center overflow-visible"
        >
          <div className="flex h-[calc(100dvh-4rem)] w-full items-center justify-center bg-card/70 backdrop-blur-[1px]">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2">
              <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
              <span className="text-sm font-medium">
                Refreshing activities…
              </span>
            </div>
          </div>
        </div>
      ) : null}

      <div
        data-slot="activities-table"
        className="w-max min-w-full flex-1 overflow-visible"
      >
        <Table className="min-w-full table-fixed" style={{ width: tableWidth }}>
          <TableHeader className="sticky top-0 z-10 bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted()
                  const sortPriority = header.column.getSortIndex() + 1
                  return (
                    <TableHead
                      key={header.id}
                      className="normal-case"
                      style={{
                        width: header.getSize(),
                        minWidth: header.getSize(),
                        maxWidth: header.getSize(),
                      }}
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          title="Click to sort. Shift-click to add this column to the current sort."
                          className="flex w-full cursor-pointer items-center gap-1.5 text-left hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {sorted === 'asc' ? (
                            <ArrowUp className="size-3.5" />
                          ) : sorted === 'desc' ? (
                            <ArrowDown className="size-3.5" />
                          ) : (
                            <ArrowUpDown className="size-3.5 opacity-40" />
                          )}
                          {sorted === false ? null : (
                            <span
                              data-slot="sort-priority"
                              aria-hidden="true"
                              className="inline-flex size-5 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                            >
                              {sortPriority}
                            </span>
                          )}
                          {sorted === false ? null : (
                            <span className="sr-only">
                              Sort priority {sortPriority}
                            </span>
                          )}
                        </button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading && data.length === 0 ? (
              <SkeletonRows
                count={9}
                columns={visibleColumns}
                density={density}
              />
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  tabIndex={0}
                  role="link"
                  aria-label={`Open ${row.original.company}, ${row.original.role}`}
                  onClick={() =>
                    navigate(`/applications/${row.original.applicationId}`)
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      navigate(`/applications/${row.original.applicationId}`)
                    }
                  }}
                  className="cursor-pointer bg-card focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      style={{
                        width: cell.column.getSize(),
                        minWidth: cell.column.getSize(),
                        maxWidth: cell.column.getSize(),
                      }}
                      className={`${densityClasses[density]} align-top whitespace-normal`}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}

            {!loading && data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleColumns.length} className="h-72 p-4">
                  <Empty className="h-full border-0 bg-transparent py-8">
                    <EmptyHeader>
                      <EmptyMedia>
                        <History />
                      </EmptyMedia>
                      <EmptyTitle>No activities found</EmptyTitle>
                      <EmptyDescription>
                        Try removing a filter or changing the current view.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : null}

            {loadingMore ? (
              <SkeletonRows
                count={3}
                columns={visibleColumns}
                density={density}
              />
            ) : null}
          </TableBody>
        </Table>
      </div>

      <div
        ref={sentinelRef}
        data-slot="events-load-sentinel"
        className="sticky left-0 flex min-h-14 w-full min-w-full items-center justify-center border-t border-border bg-card px-4 py-3 text-xs text-muted-foreground"
        aria-live="polite"
      >
        {loadingMore ? (
          <span className="inline-flex items-center gap-2">
            <LoaderCircle className="size-4 animate-spin" />
            Loading more activities…
          </span>
        ) : hasNextPage ? (
          'Scroll to load more activities'
        ) : data.length > 0 ? (
          `All ${data.length} loaded activities are visible`
        ) : null}
      </div>
    </div>
  )
}
