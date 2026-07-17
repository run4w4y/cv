import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'

import { cn } from './utils'

const alertVariants = cva(
  'relative grid w-full grid-cols-[auto_1fr] items-start gap-x-3 rounded-md border p-3 text-sm [&>svg]:mt-0.5 [&>svg]:size-4',
  {
    variants: {
      variant: {
        default: 'border-border bg-card text-card-foreground',
        destructive: 'border-destructive/30 bg-destructive/10 text-destructive',
        warning:
          'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export const Alert = ({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) => (
  <div
    data-slot="alert"
    role="alert"
    className={cn(alertVariants({ variant, className }))}
    {...props}
  />
)

export const AlertTitle = ({
  className,
  ...props
}: React.ComponentProps<'h5'>) => (
  <h5
    data-slot="alert-title"
    className={cn('col-start-2 font-medium', className)}
    {...props}
  />
)

export const AlertDescription = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => (
  <div
    data-slot="alert-description"
    className={cn('col-start-2 text-sm opacity-85', className)}
    {...props}
  />
)
