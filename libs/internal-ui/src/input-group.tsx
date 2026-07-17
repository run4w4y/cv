import type * as React from 'react'

import { Button, type ButtonProps } from './button'
import { Input } from './input'
import { Textarea } from './textarea'
import { cn } from './utils'

export const InputGroup = ({
  className,
  ...props
}: React.ComponentProps<'fieldset'>) => (
  <fieldset
    data-slot="input-group"
    className={cn(
      'group/input-group flex min-h-9 w-full min-w-0 items-stretch rounded-md border border-border bg-card outline-none has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-2 has-[[data-slot=input-group-control]:focus-visible]:ring-ring/25',
      className
    )}
    {...props}
  />
)

export const InputGroupAddon = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => (
  <div
    data-slot="input-group-addon"
    className={cn(
      'flex shrink-0 items-center gap-2 px-3 text-sm text-muted-foreground [&_svg]:size-4',
      className
    )}
    {...props}
  />
)

export const InputGroupText = ({
  className,
  ...props
}: React.ComponentProps<'span'>) => (
  <span
    data-slot="input-group-text"
    className={cn(
      'flex shrink-0 items-center gap-2 bg-muted px-3 text-sm text-muted-foreground [&_svg]:pointer-events-none [&_svg]:size-4',
      className
    )}
    {...props}
  />
)

export const InputGroupInput = ({
  className,
  ...props
}: React.ComponentProps<'input'>) => (
  <Input
    data-slot="input-group-control"
    className={cn(
      'h-auto min-h-9 flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0',
      className
    )}
    {...props}
  />
)

export const InputGroupTextarea = ({
  className,
  ...props
}: React.ComponentProps<'textarea'>) => (
  <Textarea
    data-slot="input-group-control"
    className={cn(
      'flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0',
      className
    )}
    {...props}
  />
)

export const InputGroupButton = ({
  className,
  variant = 'ghost',
  size = 'icon-sm',
  ...props
}: ButtonProps) => (
  <Button
    data-slot="input-group-button"
    variant={variant}
    size={size}
    className={cn('my-auto shrink-0', className)}
    {...props}
  />
)
