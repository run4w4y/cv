import { Button } from '@cv/internal-ui'
import type { Table as TanStackTable } from '@tanstack/react-table'
import { Check, Rows3 } from 'lucide-react'

import type { TableDensity } from './saved-view-model'

const densityOptions = [
  ['compact', 'Compact'],
  ['comfortable', 'Comfortable'],
  ['spacious', 'Spacious'],
] as const

export const TableViewSettings = <Row,>({
  table,
  density,
  onDensityChange,
}: {
  readonly table: TanStackTable<Row>
  readonly density: TableDensity
  readonly onDensityChange: (density: TableDensity) => void
}) => (
  <div className="border-b border-border p-3">
    <div className="flex items-center gap-2">
      <Rows3 className="size-4 text-muted-foreground" />
      <p className="text-sm font-semibold">Table view</p>
    </div>
    <p className="mt-3 text-xs font-medium text-muted-foreground">
      Row density
    </p>
    <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
      {densityOptions.map(([value, label]) => (
        <Button
          key={value}
          type="button"
          variant={density === value ? 'secondary' : 'ghost'}
          size="sm"
          aria-pressed={density === value}
          className="h-7 px-1.5 text-[0.6875rem]"
          onClick={() => onDensityChange(value)}
        >
          {label}
        </Button>
      ))}
    </div>
    <p className="mt-3 text-xs font-medium text-muted-foreground">Columns</p>
    <div className="mt-1.5 grid max-h-36 grid-cols-2 gap-1 overflow-y-auto">
      {table.getAllLeafColumns().map((column) => {
        if (!column.getCanHide()) return null
        const title =
          typeof column.columnDef.header === 'string'
            ? column.columnDef.header
            : column.id
        return (
          <button
            key={column.id}
            type="button"
            aria-pressed={column.getIsVisible()}
            onClick={() => column.toggleVisibility()}
            className="flex min-w-0 cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <span className="flex size-4 shrink-0 items-center justify-center rounded-sm border border-border bg-card">
              {column.getIsVisible() ? <Check className="size-3" /> : null}
            </span>
            <span className="truncate">{title}</span>
          </button>
        )
      })}
    </div>
  </div>
)
