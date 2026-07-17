import type * as React from 'react'

import { cn } from './utils'

export const Input = ({
  className,
  type,
  ...props
}: React.ComponentProps<'input'>) => (
  <input
    data-slot="input"
    type={type}
    className={cn(
      'h-9 min-w-0 rounded-md border border-border bg-card px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 aria-invalid:focus-visible:border-destructive aria-invalid:focus-visible:ring-destructive/20 disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  />
)
