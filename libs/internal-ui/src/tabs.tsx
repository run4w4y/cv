import { Tabs as TabsPrimitive } from '@base-ui/react/tabs'

import { cn } from './utils'

export const Tabs = TabsPrimitive.Root

export const TabsList = ({ className, ...props }: TabsPrimitive.List.Props) => (
  <TabsPrimitive.List
    data-slot="tabs-list"
    className={cn(
      'inline-flex h-9 w-fit items-center rounded-md bg-muted p-1 text-muted-foreground',
      className
    )}
    {...props}
  />
)

export const TabsTrigger = ({
  className,
  ...props
}: TabsPrimitive.Tab.Props) => (
  <TabsPrimitive.Tab
    data-slot="tabs-trigger"
    className={cn(
      'inline-flex h-7 cursor-pointer items-center justify-center gap-1.5 rounded-sm px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/25 data-active:bg-background data-active:text-foreground data-active:shadow-xs data-disabled:pointer-events-none data-disabled:opacity-50',
      className
    )}
    {...props}
  />
)

export const TabsContent = ({
  className,
  ...props
}: TabsPrimitive.Panel.Props) => (
  <TabsPrimitive.Panel
    data-slot="tabs-content"
    className={cn('mt-3 outline-none', className)}
    {...props}
  />
)
