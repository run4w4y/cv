import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox'
import { Check, Minus } from 'lucide-react'

import { cn } from './utils'

export const Checkbox = ({
  className,
  ...props
}: CheckboxPrimitive.Root.Props) => (
  <CheckboxPrimitive.Root
    data-slot="checkbox"
    className={cn(
      'peer flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-xs border border-input bg-background text-primary-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 data-checked:border-primary data-checked:bg-primary data-indeterminate:border-primary data-indeterminate:bg-primary disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      data-slot="checkbox-indicator"
      className="flex items-center justify-center"
    >
      <Check className="size-3 data-indeterminate:hidden" />
      <Minus className="hidden size-3 data-indeterminate:block" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
)
