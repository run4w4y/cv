import { Field as FieldPrimitive } from '@base-ui/react/field'

import { cn } from './utils'

export const Field = ({ className, ...props }: FieldPrimitive.Root.Props) => (
  <FieldPrimitive.Root
    data-slot="field"
    className={cn('grid gap-2', className)}
    {...props}
  />
)

export const FieldLabel = ({
  className,
  ...props
}: FieldPrimitive.Label.Props) => (
  <FieldPrimitive.Label
    data-slot="field-label"
    className={cn('text-sm font-medium text-foreground', className)}
    {...props}
  />
)

export const FieldControl = ({
  className,
  ...props
}: FieldPrimitive.Control.Props) => (
  <FieldPrimitive.Control
    data-slot="field-control"
    className={cn(
      'h-9 min-w-0 rounded-md border border-border bg-card px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 data-invalid:border-destructive data-invalid:ring-destructive/20 disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  />
)

export const FieldDescription = ({
  className,
  ...props
}: FieldPrimitive.Description.Props) => (
  <FieldPrimitive.Description
    data-slot="field-description"
    className={cn('text-xs text-muted-foreground', className)}
    {...props}
  />
)

export const FieldError = ({
  className,
  ...props
}: FieldPrimitive.Error.Props) => (
  <FieldPrimitive.Error
    data-slot="field-error"
    className={cn('text-xs font-medium text-destructive', className)}
    {...props}
  />
)
