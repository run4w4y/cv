import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import type * as React from 'react'

import { portalLayerVariants } from './overlay-layer'
import { cn } from './utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

export type DialogContentProps = DialogPrimitive.Popup.Props & {
  readonly showCloseButton?: boolean
}

export const DialogContent = ({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogContentProps) => (
  <DialogPrimitive.Portal
    data-slot="dialog-portal"
    className={portalLayerVariants({ layer: 'modal' })}
  >
    <DialogPrimitive.Backdrop className="fixed inset-0 z-(--z-overlay-backdrop) bg-slate-950/45 backdrop-blur-xs transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
    <DialogPrimitive.Viewport
      data-slot="dialog-viewport"
      className="fixed inset-0 z-(--z-overlay-surface) flex items-center justify-center overflow-y-auto p-4"
    >
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          'relative my-auto grid w-full max-w-lg gap-4 rounded-lg border border-border bg-card p-5 text-card-foreground shadow-xl outline-none transition-[transform,scale,opacity] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0',
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <DialogPrimitive.Close
            aria-label="Close dialog"
            className="absolute top-3 right-3 flex size-8 cursor-pointer items-center justify-center rounded-sm text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/25"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Viewport>
  </DialogPrimitive.Portal>
)

export const DialogHeader = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => (
  <div
    data-slot="dialog-header"
    className={cn('flex flex-col gap-1.5 pr-8', className)}
    {...props}
  />
)

export const DialogFooter = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => (
  <div
    data-slot="dialog-footer"
    className={cn(
      'mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
      className
    )}
    {...props}
  />
)

export const DialogTitle = ({
  className,
  ...props
}: DialogPrimitive.Title.Props) => (
  <DialogPrimitive.Title
    data-slot="dialog-title"
    className={cn('text-lg font-semibold tracking-tight', className)}
    {...props}
  />
)

export const DialogDescription = ({
  className,
  ...props
}: DialogPrimitive.Description.Props) => (
  <DialogPrimitive.Description
    data-slot="dialog-description"
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
)
