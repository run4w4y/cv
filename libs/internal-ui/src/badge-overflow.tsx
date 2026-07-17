import type * as React from 'react'

import { Badge, type BadgeProps } from './badge'
import { cn } from './utils'

export type BadgeOverflowProps<T> = React.ComponentProps<'div'> & {
  readonly items: readonly T[]
  readonly getLabel?: (item: T) => string
  readonly getKey?: (item: T) => React.Key
  readonly maxVisible?: number
  readonly badgeVariant?: BadgeProps['variant']
  readonly renderBadge?: (item: T, label: string) => React.ReactNode
  readonly renderOverflow?: (count: number) => React.ReactNode
}

export const BadgeOverflow = <T,>({
  items,
  getLabel = String,
  getKey = getLabel,
  maxVisible = 2,
  badgeVariant = 'outline',
  renderBadge,
  renderOverflow,
  className,
  ...props
}: BadgeOverflowProps<T>) => {
  const visible = items.slice(0, Math.max(0, maxVisible))
  const overflow = Math.max(0, items.length - visible.length)

  return (
    <div
      data-slot="badge-overflow"
      className={cn('flex min-w-0 flex-wrap items-center gap-1', className)}
      {...props}
    >
      {visible.map((item) => {
        const label = getLabel(item)
        return (
          <Badge key={getKey(item)} variant={badgeVariant}>
            {renderBadge?.(item, label) ?? label}
          </Badge>
        )
      })}
      {overflow > 0 ? (
        <Badge variant={badgeVariant} className="shrink-0">
          {renderOverflow?.(overflow) ?? `+${overflow}`}
        </Badge>
      ) : null}
    </div>
  )
}
