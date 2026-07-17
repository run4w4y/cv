import { Popover as PopoverPrimitive } from '@base-ui/react/popover'

import { portalLayerVariants } from './overlay-layer'
import { cn } from './utils'

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger

type PopoverContentProps = PopoverPrimitive.Popup.Props & {
  readonly align?: PopoverPrimitive.Positioner.Props['align']
  readonly anchor?: PopoverPrimitive.Positioner.Props['anchor']
  readonly side?: PopoverPrimitive.Positioner.Props['side']
  readonly sideOffset?: PopoverPrimitive.Positioner.Props['sideOffset']
}

export const PopoverContent = ({
  align = 'center',
  anchor,
  side = 'bottom',
  sideOffset = 8,
  className,
  ...props
}: PopoverContentProps) => (
  <PopoverPrimitive.Portal
    data-slot="popover-portal"
    className={portalLayerVariants({ layer: 'floating' })}
  >
    <PopoverPrimitive.Positioner
      align={align}
      anchor={anchor}
      side={side}
      sideOffset={sideOffset}
    >
      <PopoverPrimitive.Popup
        data-slot="popover-content"
        className={cn(
          'w-72 origin-(--transform-origin) rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-md outline-none transition-[transform,scale,opacity] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0',
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Positioner>
  </PopoverPrimitive.Portal>
)
