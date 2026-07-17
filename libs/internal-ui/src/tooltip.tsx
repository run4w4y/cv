import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip'

import { portalLayerVariants } from './overlay-layer'
import { cn } from './utils'

export const TooltipProvider = TooltipPrimitive.Provider
export const Tooltip = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger

type TooltipContentProps = TooltipPrimitive.Popup.Props & {
  readonly align?: TooltipPrimitive.Positioner.Props['align']
  readonly side?: TooltipPrimitive.Positioner.Props['side']
  readonly sideOffset?: TooltipPrimitive.Positioner.Props['sideOffset']
}

export const TooltipContent = ({
  align = 'center',
  side = 'top',
  sideOffset = 6,
  className,
  ...props
}: TooltipContentProps) => (
  <TooltipPrimitive.Portal
    data-slot="tooltip-portal"
    className={portalLayerVariants({ layer: 'floating' })}
  >
    <TooltipPrimitive.Positioner
      align={align}
      side={side}
      sideOffset={sideOffset}
    >
      <TooltipPrimitive.Popup
        data-slot="tooltip-content"
        className={cn(
          'max-w-xs origin-(--transform-origin) rounded-sm bg-foreground px-2.5 py-1.5 text-xs text-background shadow-md transition-[transform,scale,opacity] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0',
          className
        )}
        {...props}
      />
    </TooltipPrimitive.Positioner>
  </TooltipPrimitive.Portal>
)
