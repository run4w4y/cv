import { Menu as MenuPrimitive } from '@base-ui/react/menu'
import { Check, Circle } from 'lucide-react'
import type * as React from 'react'

import { portalLayerVariants } from './overlay-layer'
import { cn } from './utils'

export const DropdownMenu = MenuPrimitive.Root
export const DropdownMenuTrigger = MenuPrimitive.Trigger
export const DropdownMenuGroup = MenuPrimitive.Group
export const DropdownMenuRadioGroup = MenuPrimitive.RadioGroup

type DropdownMenuContentProps = MenuPrimitive.Popup.Props & {
  readonly align?: MenuPrimitive.Positioner.Props['align']
  readonly side?: MenuPrimitive.Positioner.Props['side']
  readonly sideOffset?: MenuPrimitive.Positioner.Props['sideOffset']
}

export const DropdownMenuContent = ({
  align = 'start',
  side = 'bottom',
  sideOffset = 6,
  className,
  ...props
}: DropdownMenuContentProps) => (
  <MenuPrimitive.Portal
    data-slot="dropdown-menu-portal"
    className={portalLayerVariants({ layer: 'floating' })}
  >
    <MenuPrimitive.Positioner align={align} side={side} sideOffset={sideOffset}>
      <MenuPrimitive.Popup
        data-slot="dropdown-menu-content"
        className={cn(
          'min-w-44 origin-(--transform-origin) rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none transition-[transform,scale,opacity] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0',
          className
        )}
        {...props}
      />
    </MenuPrimitive.Positioner>
  </MenuPrimitive.Portal>
)

export const DropdownMenuItem = ({
  className,
  ...props
}: MenuPrimitive.Item.Props) => (
  <MenuPrimitive.Item
    data-slot="dropdown-menu-item"
    className={cn(
      'relative flex min-h-8 cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none data-highlighted:bg-muted data-highlighted:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
      className
    )}
    {...props}
  />
)

export const DropdownMenuCheckboxItem = ({
  className,
  children,
  ...props
}: MenuPrimitive.CheckboxItem.Props) => (
  <MenuPrimitive.CheckboxItem
    data-slot="dropdown-menu-checkbox-item"
    className={cn(
      'relative flex min-h-8 cursor-default items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none select-none data-highlighted:bg-muted data-disabled:pointer-events-none data-disabled:opacity-50',
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex size-4 items-center justify-center">
      <MenuPrimitive.CheckboxItemIndicator>
        <Check className="size-4" />
      </MenuPrimitive.CheckboxItemIndicator>
    </span>
    {children}
  </MenuPrimitive.CheckboxItem>
)

export const DropdownMenuRadioItem = ({
  className,
  children,
  ...props
}: MenuPrimitive.RadioItem.Props) => (
  <MenuPrimitive.RadioItem
    data-slot="dropdown-menu-radio-item"
    className={cn(
      'relative flex min-h-8 cursor-default items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none select-none data-highlighted:bg-muted data-disabled:pointer-events-none data-disabled:opacity-50',
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex size-4 items-center justify-center">
      <MenuPrimitive.RadioItemIndicator>
        <Circle className="size-2 fill-current" />
      </MenuPrimitive.RadioItemIndicator>
    </span>
    {children}
  </MenuPrimitive.RadioItem>
)

export const DropdownMenuLabel = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => (
  <div
    data-slot="dropdown-menu-label"
    className={cn(
      'px-2 py-1.5 text-xs font-semibold text-muted-foreground',
      className
    )}
    {...props}
  />
)

export const DropdownMenuSeparator = ({
  className,
  ...props
}: MenuPrimitive.Separator.Props) => (
  <MenuPrimitive.Separator
    data-slot="dropdown-menu-separator"
    className={cn('-mx-1 my-1 h-px bg-border', className)}
    {...props}
  />
)
