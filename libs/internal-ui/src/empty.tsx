import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'

import { cn } from './utils'

export const Empty = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div
    data-slot="empty"
    className={cn(
      'flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-8 py-14 text-center',
      className
    )}
    {...props}
  />
)

export const EmptyHeader = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => (
  <div
    data-slot="empty-header"
    className={cn('flex max-w-sm flex-col items-center gap-2', className)}
    {...props}
  />
)

const emptyMediaVariants = cva(
  'flex shrink-0 items-center justify-center text-muted-foreground [&_svg]:size-6',
  {
    variants: {
      variant: {
        default: 'size-12 rounded-full border border-border bg-muted',
        icon: 'size-8',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export const EmptyMedia = ({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof emptyMediaVariants>) => (
  <div
    data-slot="empty-media"
    className={cn(emptyMediaVariants({ variant, className }))}
    {...props}
  />
)

export const EmptyTitle = ({
  className,
  ...props
}: React.ComponentProps<'h3'>) => (
  <h3
    data-slot="empty-title"
    className={cn('text-base font-semibold', className)}
    {...props}
  />
)

export const EmptyDescription = ({
  className,
  ...props
}: React.ComponentProps<'p'>) => (
  <p
    data-slot="empty-description"
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
)

export const EmptyContent = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => (
  <div
    data-slot="empty-content"
    className={cn('mt-4 flex items-center gap-2', className)}
    {...props}
  />
)
