import type { ApplicationListItem } from '@cv/application-registry-api-contract'
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
  type Table as TanStackTable,
  useReactTable,
  type VisibilityState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown, Inbox } from 'lucide-react'
import * as React from 'react'
import { HeaderActions } from '../../../shell/header-actions'
import { useInfiniteScroll } from '../../../table-workspace/use-infinite-scroll'
import { createApplicationColumns } from './columns'
import { ApplicationRowEditor } from './row-editor'
import { type TableDensity, TableSettings } from './settings'

const densityClasses: Readonly<Record<TableDensity, string>> = {
  compact: 'py-2',
  comfortable: 'py-3',
  spacious: 'py-4',
}

const coreRowModel = getCoreRowModel()

export const ApplicationsTable = ({
  data,
  loading,
  sorting,
  onSortingChange,
  density,
  onDensityChange,
  columnVisibility,
  onColumnVisibilityChange,
  hasNextPage,
  loadingMore,
  onLoadMore,
  headerActions,
  renderViewControl,
  availableLabels,
}: {
  readonly data: ApplicationListItem[]
  readonly loading: boolean
  readonly sorting: SortingState
  readonly onSortingChange: OnChangeFn<SortingState>
  readonly density: TableDensity
  readonly onDensityChange: (density: TableDensity) => void
  readonly columnVisibility: VisibilityState
  readonly onColumnVisibilityChange: OnChangeFn<VisibilityState>
  readonly hasNextPage: boolean
  readonly loadingMore: boolean
  readonly onLoadMore: () => void
  readonly headerActions?: React.ReactNode
  readonly renderViewControl?: (
    table: TanStackTable<ApplicationListItem>
  ) => React.ReactNode
  readonly availableLabels: readonly string[]
}) => {
  const [editingRowId, setEditingRowId] = React.useState<string>()
  const effectiveEditingRowId = data.some(
    (application) => application.id === editingRowId
  )
    ? editingRowId
    : undefined
  const cancelEditing = () => setEditingRowId(undefined)
  const tableColumns = [
    ...createApplicationColumns({
      availableLabels,
      editingRowId: effectiveEditingRowId,
      onBeginEditing: (application) => setEditingRowId(application.id),
    }),
  ]
  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: coreRowModel,
    manualSorting: true,
    enableMultiSort: true,
    getRowId: (row) => row.id,
    state: { sorting, columnVisibility },
    onSortingChange,
    onColumnVisibilityChange,
  })
  const tableWidth = table.getTotalSize()
  const { rootRef, sentinelRef } = useInfiniteScroll({
    enabled: hasNextPage && !loading && !loadingMore,
    onLoadMore,
    rootMargin: '0px 0px 480px 0px',
  })

  return (
    <>
      <HeaderActions>
        {headerActions}
        {renderViewControl?.(table) ?? (
          <TableSettings
            table={table}
            density={density}
            onDensityChange={onDensityChange}
          />
        )}
      </HeaderActions>
      <div
        ref={rootRef}
        data-slot="applications-table"
        className="relative isolate min-h-0 min-w-full flex-1 overflow-auto overscroll-contain bg-card"
      >
        {loading && data.length > 0 ? (
          <div
            className="sticky top-0 left-0 z-20 h-1 w-full overflow-hidden bg-primary/15"
            role="status"
            aria-label="Updating applications"
          >
            <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
          </div>
        ) : null}
        <Table
          className="min-w-full table-fixed"
          style={{ width: tableWidth }}
          aria-busy={loading || loadingMore}
        >
          <TableHeader className="sticky top-0 z-10 bg-muted shadow-[0_1px_0_var(--border)]">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted()
                  const sortPriority = header.column.getSortIndex() + 1
                  return (
                    <TableHead
                      key={header.id}
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
          <TableBody
            className={loading && data.length > 0 ? 'opacity-55' : undefined}
          >
            {loading && data.length === 0
              ? Array.from(
                  { length: 9 },
                  (_, index) => `skeleton-${index}`
                ).map((key, rowIndex) => (
                  <TableRow key={key} aria-hidden>
                    {table
                      .getVisibleLeafColumns()
                      .map((column, columnIndex) => (
                        <TableCell
                          key={column.id}
                          className={densityClasses[density]}
                        >
                          <Skeleton
                            className={
                              (rowIndex + columnIndex) % 3 === 0
                                ? 'h-4 w-32'
                                : 'h-4 w-20'
                            }
                          />
                        </TableCell>
                      ))}
                  </TableRow>
                ))
              : table.getRowModel().rows.map((row) => {
                  const tableRow = (
                    <TableRow
                      key={row.id}
                      data-editing={
                        effectiveEditingRowId === row.original.id
                          ? 'true'
                          : undefined
                      }
                      className="bg-card data-[editing=true]:bg-muted/20"
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
                  )
                  return effectiveEditingRowId === row.original.id ? (
                    <ApplicationRowEditor
                      key={row.id}
                      application={row.original}
                      onCancel={cancelEditing}
                    >
                      {tableRow}
                    </ApplicationRowEditor>
                  ) : (
                    tableRow
                  )
                })}
            {loadingMore
              ? Array.from({ length: 3 }, (_, index) => `more-${index}`).map(
                  (key, rowIndex) => (
                    <TableRow key={key} aria-hidden>
                      {table
                        .getVisibleLeafColumns()
                        .map((column, columnIndex) => (
                          <TableCell
                            key={column.id}
                            className={`${densityClasses[density]} align-top`}
                          >
                            <Skeleton
                              className={
                                (rowIndex + columnIndex) % 3 === 0
                                  ? 'h-4 w-32'
                                  : 'h-4 w-20'
                              }
                            />
                          </TableCell>
                        ))}
                    </TableRow>
                  )
                )
              : null}
            {!loading && data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="h-72 p-4"
                >
                  <Empty className="h-full border-0 bg-transparent py-8">
                    <EmptyHeader>
                      <EmptyMedia>
                        <Inbox />
                      </EmptyMedia>
                      <EmptyTitle>No applications found</EmptyTitle>
                      <EmptyDescription>
                        Try removing a filter or changing the search query.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
        <div
          ref={sentinelRef}
          className="sticky left-0 flex min-h-14 w-full items-center justify-center border-t border-border bg-card px-4 py-3 text-sm text-muted-foreground"
          aria-live="polite"
        >
          {loadingMore
            ? 'Loading more applications…'
            : hasNextPage
              ? 'Scroll to load more'
              : data.length > 0
                ? `All ${data.length} loaded applications are shown`
                : null}
        </div>
      </div>
    </>
  )
}
