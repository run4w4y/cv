import type * as React from 'react'

import { cn } from './utils'

export const Skeleton = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => (
  <div
    data-slot="skeleton"
    className={cn('animate-pulse rounded-sm bg-muted', className)}
    {...props}
  />
)
