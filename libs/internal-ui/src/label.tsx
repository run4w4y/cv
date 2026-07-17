import type * as React from 'react'

import { cn } from './utils'

export const Label = ({
  className,
  ...props
}: React.ComponentProps<'label'>) => (
  // biome-ignore lint/a11y/noLabelWithoutControl: consumers associate this reusable label through htmlFor or nested controls.
  <label
    data-slot="label"
    className={cn(
      'flex w-fit items-center gap-2 text-sm font-medium text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
      className
    )}
    {...props}
  />
)
