import { Radio as RadioPrimitive } from '@base-ui/react/radio'
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group'
import { Circle } from 'lucide-react'

import { cn } from './utils'

export const RadioGroup = <Value,>({
  className,
  ...props
}: RadioGroupPrimitive.Props<Value>) => (
  <RadioGroupPrimitive<Value>
    data-slot="radio-group"
    className={cn('grid gap-2', className)}
    {...props}
  />
)

export const RadioGroupItem = <Value,>({
  className,
  ...props
}: RadioPrimitive.Root.Props<Value>) => (
  <RadioPrimitive.Root<Value>
    data-slot="radio-group-item"
    className={cn(
      'flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-full border border-input bg-background text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/25 data-checked:border-primary data-disabled:cursor-not-allowed data-disabled:opacity-50',
      className
    )}
    {...props}
  >
    <RadioPrimitive.Indicator>
      <Circle className="size-2 fill-current" />
    </RadioPrimitive.Indicator>
  </RadioPrimitive.Root>
)
