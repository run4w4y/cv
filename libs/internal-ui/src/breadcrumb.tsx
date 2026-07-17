import { ChevronRight, Ellipsis } from 'lucide-react'
import type * as React from 'react'

import { cn } from './utils'

export const Breadcrumb = (props: React.ComponentProps<'nav'>) => (
  <nav data-slot="breadcrumb" aria-label="Breadcrumb" {...props} />
)

export const BreadcrumbList = ({
  className,
  ...props
}: React.ComponentProps<'ol'>) => (
  <ol
    data-slot="breadcrumb-list"
    className={cn(
      'flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground',
      className
    )}
    {...props}
  />
)

export const BreadcrumbItem = ({
  className,
  ...props
}: React.ComponentProps<'li'>) => (
  <li
    data-slot="breadcrumb-item"
    className={cn('inline-flex items-center gap-1.5', className)}
    {...props}
  />
)

export const BreadcrumbLink = ({
  className,
  ...props
}: React.ComponentProps<'a'>) => (
  <a
    data-slot="breadcrumb-link"
    className={cn(
      'transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring',
      className
    )}
    {...props}
  />
)

export const BreadcrumbPage = ({
  className,
  ...props
}: React.ComponentProps<'span'>) => (
  <span
    data-slot="breadcrumb-page"
    aria-current="page"
    className={cn('font-medium text-foreground', className)}
    {...props}
  />
)

export const BreadcrumbSeparator = ({
  children,
  className,
  ...props
}: React.ComponentProps<'li'>) => (
  <li
    data-slot="breadcrumb-separator"
    role="presentation"
    className={cn('text-muted-foreground [&_svg]:size-3.5', className)}
    {...props}
  >
    {children ?? <ChevronRight />}
  </li>
)

export const BreadcrumbEllipsis = ({
  className,
  ...props
}: React.ComponentProps<'span'>) => (
  <span
    data-slot="breadcrumb-ellipsis"
    role="presentation"
    className={cn(
      'flex size-8 items-center justify-center text-muted-foreground',
      className
    )}
    {...props}
  >
    <Ellipsis className="size-4" />
    <span className="sr-only">More</span>
  </span>
)
