import { Progress as ProgressPrimitive } from '@base-ui/react/progress'

import { cn } from './utils'

export type ProgressProps = Omit<ProgressPrimitive.Root.Props, 'children'> & {
  readonly indicatorClassName?: string
}

export const Progress = ({
  className,
  indicatorClassName,
  ...props
}: ProgressProps) => (
  <ProgressPrimitive.Root
    data-slot="progress"
    className={cn(
      'relative h-2 w-full overflow-hidden rounded-full bg-primary/20',
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Track data-slot="progress-track" className="size-full">
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          'h-full rounded-full bg-primary transition-[width] duration-300 data-indeterminate:w-1/2 data-indeterminate:animate-pulse motion-reduce:transition-none',
          indicatorClassName
        )}
      />
    </ProgressPrimitive.Track>
  </ProgressPrimitive.Root>
)
