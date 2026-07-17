import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-react'

import { portalLayerVariants } from './overlay-layer'
import { cn } from './utils'

export const Sheet = DialogPrimitive.Root
export const SheetTrigger = DialogPrimitive.Trigger
export const SheetClose = DialogPrimitive.Close

const sheetVariants = cva(
  'pointer-events-auto fixed flex flex-col gap-4 border-border bg-card p-5 text-card-foreground shadow-xl outline-none transition-transform duration-200',
  {
    variants: {
      side: {
        right:
          'inset-y-0 right-0 h-full w-4/5 max-w-sm border-l data-ending-style:translate-x-full data-starting-style:translate-x-full',
        left: 'inset-y-0 left-0 h-full w-4/5 max-w-sm border-r data-ending-style:-translate-x-full data-starting-style:-translate-x-full',
        top: 'inset-x-0 top-0 border-b data-ending-style:-translate-y-full data-starting-style:-translate-y-full',
        bottom:
          'inset-x-0 bottom-0 border-t data-ending-style:translate-y-full data-starting-style:translate-y-full',
      },
    },
    defaultVariants: { side: 'right' },
  }
)

export const SheetContent = ({
  className,
  side,
  children,
  ...props
}: DialogPrimitive.Popup.Props & VariantProps<typeof sheetVariants>) => (
  <DialogPrimitive.Portal
    data-slot="sheet-portal"
    className={portalLayerVariants({ layer: 'modal' })}
  >
    <DialogPrimitive.Backdrop className="fixed inset-0 z-(--z-overlay-backdrop) bg-slate-950/40 backdrop-blur-xs transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
    <DialogPrimitive.Viewport
      data-slot="sheet-viewport"
      className="pointer-events-none fixed inset-0 z-(--z-overlay-surface)"
    >
      <DialogPrimitive.Popup
        data-slot="sheet-content"
        className={cn(sheetVariants({ side, className }))}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label="Close panel"
          className="absolute top-3 right-3 flex size-8 cursor-pointer items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/25"
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Popup>
    </DialogPrimitive.Viewport>
  </DialogPrimitive.Portal>
)

export {
  DialogDescription as SheetDescription,
  DialogFooter as SheetFooter,
  DialogHeader as SheetHeader,
  DialogTitle as SheetTitle,
} from './dialog'
