import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'

import { Separator } from './separator'
import { cn } from './utils'

export const buttonGroupVariants = cva(
  'inline-flex w-fit items-stretch isolate [&>*]:focus-visible:relative [&>*]:focus-visible:z-10',
  {
    variants: {
      orientation: {
        horizontal:
          '[&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:border-l-0 [&>*:not(:last-child)]:rounded-r-none',
        vertical:
          'flex-col [&>*:not(:first-child)]:rounded-t-none [&>*:not(:first-child)]:border-t-0 [&>*:not(:last-child)]:rounded-b-none',
      },
    },
    defaultVariants: { orientation: 'horizontal' },
  }
)

export const ButtonGroup = ({
  className,
  orientation,
  ...props
}: React.ComponentProps<'fieldset'> &
  VariantProps<typeof buttonGroupVariants>) => (
  <fieldset
    data-slot="button-group"
    data-orientation={orientation ?? 'horizontal'}
    className={cn(buttonGroupVariants({ orientation, className }))}
    {...props}
  />
)

export const ButtonGroupText = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => (
  <div
    data-slot="button-group-text"
    className={cn(
      'inline-flex items-center gap-2 border border-border bg-muted px-3 text-sm font-medium text-foreground',
      className
    )}
    {...props}
  />
)

export const ButtonGroupSeparator = ({
  className,
  orientation = 'vertical',
  ...props
}: React.ComponentProps<typeof Separator>) => (
  <Separator
    data-slot="button-group-separator"
    orientation={orientation}
    className={cn(
      'm-0 self-stretch',
      orientation === 'vertical' ? 'h-auto' : 'w-full',
      className
    )}
    {...props}
  />
)
