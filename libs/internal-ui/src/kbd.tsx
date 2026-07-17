import type * as React from 'react'

import { cn } from './utils'

export const Kbd = ({ className, ...props }: React.ComponentProps<'kbd'>) => (
  <kbd
    data-slot="kbd"
    className={cn(
      'pointer-events-none inline-flex min-w-6 items-center justify-center rounded-xs border border-border bg-muted px-1.5 py-0.5 font-sans text-xs font-medium text-muted-foreground',
      className
    )}
    {...props}
  />
)

export const KbdGroup = ({
  className,
  ...props
}: React.ComponentProps<'span'>) => (
  <span
    data-slot="kbd-group"
    className={cn('inline-flex items-center gap-1', className)}
    {...props}
  />
)
