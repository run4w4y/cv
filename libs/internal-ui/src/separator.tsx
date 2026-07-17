import { Separator as SeparatorPrimitive } from '@base-ui/react/separator'

import { cn } from './utils'

export const Separator = ({
  className,
  orientation = 'horizontal',
  ...props
}: SeparatorPrimitive.Props) => (
  <SeparatorPrimitive
    data-slot="separator"
    orientation={orientation}
    className={cn(
      'shrink-0 bg-border',
      orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
      className
    )}
    {...props}
  />
)
