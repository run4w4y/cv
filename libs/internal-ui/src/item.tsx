import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'

import { cn } from './utils'

const itemVariants = cva(
  'group/item flex flex-wrap items-center rounded-md border border-transparent text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/25',
  {
    variants: {
      variant: {
        default: 'bg-card hover:bg-muted/60',
        outline: 'border-border bg-card hover:bg-muted/60',
        muted: 'bg-muted',
      },
      size: {
        default: 'gap-4 p-4',
        sm: 'gap-3 px-3 py-2.5',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)

export const ItemGroup = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => (
  <div
    data-slot="item-group"
    className={cn('flex flex-col gap-2', className)}
    {...props}
  />
)

export const Item = ({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof itemVariants>) => (
  <div
    data-slot="item"
    className={cn(itemVariants({ variant, size, className }))}
    {...props}
  />
)

export const ItemMedia = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => (
  <div
    data-slot="item-media"
    className={cn(
      'flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground [&_svg]:size-5',
      className
    )}
    {...props}
  />
)

export const ItemContent = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => (
  <div
    data-slot="item-content"
    className={cn('flex min-w-0 flex-1 flex-col gap-1', className)}
    {...props}
  />
)

export const ItemTitle = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => (
  <div
    data-slot="item-title"
    className={cn('font-medium text-foreground', className)}
    {...props}
  />
)

export const ItemDescription = ({
  className,
  ...props
}: React.ComponentProps<'p'>) => (
  <p
    data-slot="item-description"
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
)

export const ItemActions = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => (
  <div
    data-slot="item-actions"
    className={cn('flex shrink-0 items-center gap-2', className)}
    {...props}
  />
)
