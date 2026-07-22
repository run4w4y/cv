import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible'

import { cn } from './utils'

export const Collapsible = ({
  className,
  ...props
}: CollapsiblePrimitive.Root.Props) => (
  <CollapsiblePrimitive.Root
    data-slot="collapsible"
    className={className}
    {...props}
  />
)

export const CollapsibleTrigger = ({
  className,
  ...props
}: CollapsiblePrimitive.Trigger.Props) => (
  <CollapsiblePrimitive.Trigger
    data-slot="collapsible-trigger"
    className={cn(
      'outline-none focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  />
)

export const CollapsibleContent = ({
  className,
  ...props
}: CollapsiblePrimitive.Panel.Props) => (
  <CollapsiblePrimitive.Panel
    data-slot="collapsible-content"
    className={cn(
      'h-(--collapsible-panel-height) overflow-hidden transition-[height,opacity] duration-200 data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0 motion-reduce:transition-none',
      className
    )}
    {...props}
  />
)
