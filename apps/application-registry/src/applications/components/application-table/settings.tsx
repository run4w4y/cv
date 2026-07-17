import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@cv/internal-ui'
import type { Table as TanStackTable } from '@tanstack/react-table'
import { Check, Rows3, Settings2 } from 'lucide-react'

import type { ApplicationListItem } from '@cv/application-registry-api-contract'

export type TableDensity = 'compact' | 'comfortable' | 'spacious'

export const TableSettings = ({
  table,
  density,
  onDensityChange,
}: {
  readonly table: TanStackTable<ApplicationListItem>
  readonly density: TableDensity
  readonly onDensityChange: (density: TableDensity) => void
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      render={
        <Button type="button" variant="ghost" size="sm">
          <Settings2 />
          View
        </Button>
      }
    />
    <DropdownMenuContent align="end" className="w-64">
      <DropdownMenuLabel className="flex items-center gap-2">
        <Rows3 className="size-4" />
        Table density
      </DropdownMenuLabel>
      {(
        [
          ['compact', 'Compact'],
          ['comfortable', 'Comfortable'],
          ['spacious', 'Spacious'],
        ] as const
      ).map(([value, label]) => (
        <DropdownMenuItem
          key={value}
          onClick={() => {
            window.setTimeout(() => onDensityChange(value), 0)
          }}
          className="pl-8"
        >
          <Check
            className={
              density === value
                ? 'absolute left-2 opacity-100'
                : 'absolute left-2 opacity-0'
            }
          />
          {label}
        </DropdownMenuItem>
      ))}

      <DropdownMenuSeparator />
      <DropdownMenuLabel>Columns</DropdownMenuLabel>
      {table.getAllLeafColumns().map((column) => {
        if (!column.getCanHide()) return null
        const title =
          typeof column.columnDef.header === 'string'
            ? column.columnDef.header
            : column.id
        return (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={column.getIsVisible()}
            onCheckedChange={(checked) => column.toggleVisibility(checked)}
          >
            <span className="truncate">{title}</span>
          </DropdownMenuCheckboxItem>
        )
      })}
    </DropdownMenuContent>
  </DropdownMenu>
)
