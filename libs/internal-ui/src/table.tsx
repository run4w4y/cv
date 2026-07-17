import type * as React from 'react'

import { cn } from './utils'

export const Table = ({
  className,
  ...props
}: React.ComponentProps<'table'>) => (
  <table
    data-slot="table"
    className={cn('w-full caption-bottom border-collapse text-sm', className)}
    {...props}
  />
)

export const TableHeader = ({
  className,
  ...props
}: React.ComponentProps<'thead'>) => (
  <thead
    data-slot="table-header"
    className={cn('[&_tr]:border-b', className)}
    {...props}
  />
)

export const TableBody = ({
  className,
  ...props
}: React.ComponentProps<'tbody'>) => (
  <tbody
    data-slot="table-body"
    className={cn('[&_tr:last-child]:border-0', className)}
    {...props}
  />
)

export const TableRow = ({
  className,
  ...props
}: React.ComponentProps<'tr'>) => (
  <tr
    data-slot="table-row"
    className={cn(
      'border-b border-border transition-colors hover:bg-muted/60 data-[selected=true]:bg-muted',
      className
    )}
    {...props}
  />
)

export const TableHead = ({
  className,
  ...props
}: React.ComponentProps<'th'>) => (
  <th
    data-slot="table-head"
    className={cn(
      'h-11 px-4 text-left align-middle text-xs font-semibold tracking-wide whitespace-nowrap text-muted-foreground uppercase',
      className
    )}
    {...props}
  />
)

export const TableCell = ({
  className,
  ...props
}: React.ComponentProps<'td'>) => (
  <td
    data-slot="table-cell"
    className={cn('px-4 py-3 align-middle', className)}
    {...props}
  />
)
