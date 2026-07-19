import { cn } from '@cv/internal-ui'
import type * as React from 'react'

import type {
  ChartDatum,
  ChartLegendItem,
  ChartValueFormatter,
} from './chart-types'
import { formatChartValue } from './chart-types'

export interface ChartLegendProps
  extends Omit<React.ComponentProps<'ul'>, 'children'> {
  readonly ariaLabel?: string
  readonly items: readonly ChartLegendItem[]
  readonly valueFormat?: ChartValueFormatter
}

export const ChartLegend = ({
  ariaLabel = 'Chart legend',
  className,
  items,
  valueFormat = formatChartValue,
  ...props
}: ChartLegendProps) => (
  <ul
    aria-label={ariaLabel}
    className={cn(
      'flex flex-wrap items-center gap-x-4 gap-y-2 text-sm',
      className
    )}
    data-slot="chart-legend"
    {...props}
  >
    {items.map((item, index) => (
      <li
        className="flex min-w-0 items-center gap-2"
        key={item.id ?? `${item.label}-${index}`}
      >
        <span
          aria-hidden="true"
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: item.color }}
        />
        <span className="truncate text-muted-foreground">{item.label}</span>
        {item.value === undefined ? null : (
          <span className="font-medium tabular-nums">
            {valueFormat(item.value)}
          </span>
        )}
      </li>
    ))}
  </ul>
)

export interface ChartTableColumn {
  readonly format?: (value: unknown, row: ChartDatum) => React.ReactNode
  readonly key: string
  readonly label: string
}

export interface ChartDataTableProps
  extends Omit<React.ComponentProps<'table'>, 'children'> {
  readonly caption: string
  readonly columns: readonly ChartTableColumn[]
  readonly rows: readonly ChartDatum[]
  readonly visuallyHidden?: boolean
}

const renderCell = (column: ChartTableColumn, row: ChartDatum) => {
  const value = row[column.key]
  if (column.format) {
    return column.format(value, row)
  }
  return value === null || value === undefined ? '—' : String(value)
}

export const ChartDataTable = ({
  caption,
  className,
  columns,
  rows,
  visuallyHidden = true,
  ...props
}: ChartDataTableProps) => (
  <table
    className={cn(
      'w-full border-collapse text-sm',
      visuallyHidden && 'sr-only',
      className
    )}
    data-slot="chart-data-table"
    {...props}
  >
    <caption>{caption}</caption>
    <thead>
      <tr>
        {columns.map((column) => (
          <th
            className="p-2 text-left font-medium"
            key={column.key}
            scope="col"
          >
            {column.label}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((row, rowIndex) => (
        <tr
          key={
            typeof row.id === 'string'
              ? row.id
              : `${columns.map((column) => String(row[column.key])).join('|')}-${rowIndex}`
          }
        >
          {columns.map((column, columnIndex) => {
            const Component = columnIndex === 0 ? 'th' : 'td'
            return (
              <Component
                className="border-t border-border p-2 text-left tabular-nums"
                key={column.key}
                {...(columnIndex === 0 ? { scope: 'row' as const } : {})}
              >
                {renderCell(column, row)}
              </Component>
            )
          })}
        </tr>
      ))}
    </tbody>
  </table>
)

export interface ChartEmptyStateProps
  extends React.ComponentPropsWithoutRef<'div'> {
  readonly message?: string
}

export const ChartEmptyState = ({
  className,
  message = 'No data is available for this period.',
  ...props
}: ChartEmptyStateProps) => (
  <div
    className={cn(
      'flex min-h-56 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground',
      className
    )}
    data-slot="chart-empty-state"
    role="status"
    {...props}
  >
    {message}
  </div>
)
