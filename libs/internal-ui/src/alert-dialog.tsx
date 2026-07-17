import { AlertDialog as AlertDialogPrimitive } from '@base-ui/react/alert-dialog'
import type * as React from 'react'

import { buttonVariants } from './button'
import { portalLayerVariants } from './overlay-layer'
import { cn } from './utils'

export const AlertDialog = AlertDialogPrimitive.Root
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger

export const AlertDialogContent = ({
  className,
  ...props
}: AlertDialogPrimitive.Popup.Props) => (
  <AlertDialogPrimitive.Portal
    data-slot="alert-dialog-portal"
    className={portalLayerVariants({ layer: 'modal' })}
  >
    <AlertDialogPrimitive.Backdrop className="fixed inset-0 z-(--z-overlay-backdrop) bg-slate-950/45 backdrop-blur-xs transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
    <AlertDialogPrimitive.Viewport
      data-slot="alert-dialog-viewport"
      className="fixed inset-0 z-(--z-overlay-surface) flex items-center justify-center overflow-y-auto p-4"
    >
      <AlertDialogPrimitive.Popup
        data-slot="alert-dialog-content"
        className={cn(
          'my-auto grid w-full max-w-lg gap-4 rounded-lg border border-border bg-card p-5 text-card-foreground shadow-xl outline-none transition-[transform,scale,opacity] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0',
          className
        )}
        {...props}
      />
    </AlertDialogPrimitive.Viewport>
  </AlertDialogPrimitive.Portal>
)

export const AlertDialogHeader = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => (
  <div className={cn('flex flex-col gap-1.5', className)} {...props} />
)

export const AlertDialogFooter = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => (
  <div
    className={cn(
      'mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
      className
    )}
    {...props}
  />
)

export const AlertDialogTitle = ({
  className,
  ...props
}: AlertDialogPrimitive.Title.Props) => (
  <AlertDialogPrimitive.Title
    className={cn('text-lg font-semibold tracking-tight', className)}
    {...props}
  />
)

export const AlertDialogDescription = ({
  className,
  ...props
}: AlertDialogPrimitive.Description.Props) => (
  <AlertDialogPrimitive.Description
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
)

export const AlertDialogAction = ({
  className,
  ...props
}: AlertDialogPrimitive.Close.Props) => (
  <AlertDialogPrimitive.Close
    className={cn(buttonVariants(), className)}
    {...props}
  />
)

export const AlertDialogCancel = ({
  className,
  ...props
}: AlertDialogPrimitive.Close.Props) => (
  <AlertDialogPrimitive.Close
    className={cn(buttonVariants({ variant: 'outline' }), className)}
    {...props}
  />
)
