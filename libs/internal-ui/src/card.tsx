import type * as React from 'react'

import { cn } from './utils'

export const Card = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div
    data-slot="card"
    className={cn(
      'rounded-lg border border-border bg-card text-card-foreground',
      className
    )}
    {...props}
  />
)

export const CardHeader = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => (
  <div
    data-slot="card-header"
    className={cn('flex flex-col gap-1.5 p-5', className)}
    {...props}
  />
)

export const CardTitle = ({
  className,
  ...props
}: React.ComponentProps<'h3'>) => (
  <h3
    data-slot="card-title"
    className={cn('font-semibold tracking-tight', className)}
    {...props}
  />
)

export const CardDescription = ({
  className,
  ...props
}: React.ComponentProps<'p'>) => (
  <p
    data-slot="card-description"
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
)

export const CardContent = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => (
  <div
    data-slot="card-content"
    className={cn('px-5 pb-5', className)}
    {...props}
  />
)

export const CardFooter = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => (
  <div
    data-slot="card-footer"
    className={cn('flex items-center gap-2 px-5 pb-5', className)}
    {...props}
  />
)
