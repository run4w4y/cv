import { cva } from 'class-variance-authority'
import { AlertCircle, Check } from 'lucide-react'
import * as React from 'react'

import { cn } from './utils'

export type StepperStatus = 'pending' | 'active' | 'complete' | 'error'
type StepperOrientation = 'horizontal' | 'vertical'

type StepperContextValue = {
  readonly value: number
  readonly orientation: StepperOrientation
  readonly baseId: string
  readonly setValue: (value: number) => void
}

const StepperContext = React.createContext<StepperContextValue | undefined>(
  undefined
)

const useStepper = () => {
  const context = React.useContext(StepperContext)
  if (context === undefined) {
    throw new Error('Stepper parts must be used within Stepper.')
  }
  return context
}

type StepperItemContextValue = {
  readonly step: number
  readonly status: StepperStatus
  readonly disabled: boolean
}

const StepperItemContext = React.createContext<
  StepperItemContextValue | undefined
>(undefined)

const useStepperItem = () => {
  const context = React.useContext(StepperItemContext)
  if (context === undefined) {
    throw new Error('Stepper item parts must be used within StepperItem.')
  }
  return context
}

export type StepperProps = Omit<React.ComponentProps<'div'>, 'onChange'> & {
  readonly value?: number
  readonly defaultValue?: number
  readonly onValueChange?: (value: number) => void
  readonly orientation?: StepperOrientation
}

export const Stepper = ({
  value,
  defaultValue = 1,
  onValueChange,
  orientation = 'horizontal',
  id,
  className,
  ...props
}: StepperProps) => {
  const generatedId = React.useId()
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue)
  const currentValue = value ?? uncontrolledValue
  const baseId = id ?? generatedId

  const setValue = React.useCallback(
    (nextValue: number) => {
      if (value === undefined) setUncontrolledValue(nextValue)
      onValueChange?.(nextValue)
    },
    [onValueChange, value]
  )

  const contextValue = React.useMemo(
    () => ({ value: currentValue, orientation, baseId, setValue }),
    [baseId, currentValue, orientation, setValue]
  )

  return (
    <StepperContext.Provider value={contextValue}>
      <div
        id={baseId}
        data-slot="stepper"
        data-orientation={orientation}
        className={cn('w-full', className)}
        {...props}
      />
    </StepperContext.Provider>
  )
}

export const StepperList = ({
  className,
  'aria-label': ariaLabel = 'Progress',
  ...props
}: React.ComponentProps<'ol'>) => {
  const { orientation } = useStepper()

  return (
    <ol
      data-slot="stepper-list"
      data-orientation={orientation}
      aria-label={ariaLabel}
      className={cn(
        orientation === 'horizontal'
          ? 'flex w-full items-start'
          : 'flex w-full flex-col',
        className
      )}
      {...props}
    />
  )
}

export type StepperItemProps = React.ComponentProps<'li'> & {
  readonly step: number
  readonly status?: StepperStatus
  readonly disabled?: boolean
}

export const StepperItem = ({
  step,
  status: statusProp,
  disabled = false,
  className,
  ...props
}: StepperItemProps) => {
  const { value, orientation } = useStepper()
  const status =
    statusProp ??
    (step < value ? 'complete' : step === value ? 'active' : 'pending')
  const contextValue = React.useMemo(
    () => ({ step, status, disabled }),
    [disabled, status, step]
  )

  return (
    <StepperItemContext.Provider value={contextValue}>
      <li
        data-slot="stepper-item"
        data-state={status}
        data-disabled={disabled ? 'true' : undefined}
        data-orientation={orientation}
        className={cn(
          'relative min-w-0 last:[&_[data-slot=stepper-separator]]:hidden',
          orientation === 'horizontal' ? 'flex-1' : 'w-full pb-6 last:pb-0',
          className
        )}
        {...props}
      />
    </StepperItemContext.Provider>
  )
}

export const StepperTrigger = ({
  className,
  onClick,
  disabled: disabledProp,
  ...props
}: React.ComponentProps<'button'>) => {
  const { value, orientation, baseId, setValue } = useStepper()
  const { step, status, disabled } = useStepperItem()
  const isDisabled = disabled || Boolean(disabledProp)

  return (
    <button
      id={`${baseId}-trigger-${step}`}
      type="button"
      data-slot="stepper-trigger"
      data-state={status}
      data-orientation={orientation}
      aria-current={value === step ? 'step' : undefined}
      disabled={isDisabled}
      className={cn(
        'relative z-10 min-w-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50',
        orientation === 'horizontal'
          ? 'flex w-full flex-col items-center gap-1.5 rounded-md px-1 text-center'
          : 'grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-x-3 gap-y-0.5 rounded-md text-left [&_[data-slot=stepper-indicator]]:row-span-2',
        className
      )}
      {...props}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented && !isDisabled) setValue(step)
      }}
    />
  )
}

const stepperIndicatorVariants = cva(
  'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-semibold transition-colors',
  {
    variants: {
      status: {
        pending: 'border-border text-muted-foreground',
        active: 'border-primary bg-primary text-primary-foreground',
        complete: 'border-primary bg-primary text-primary-foreground',
        error:
          'border-destructive bg-destructive/10 text-destructive ring-4 ring-destructive/10',
      },
    },
  }
)

export const StepperIndicator = ({
  className,
  children,
  ...props
}: React.ComponentProps<'span'>) => {
  const { step, status } = useStepperItem()

  return (
    <span
      data-slot="stepper-indicator"
      data-state={status}
      aria-hidden="true"
      className={cn(stepperIndicatorVariants({ status }), className)}
      {...props}
    >
      {children ??
        (status === 'complete' ? (
          <Check className="size-4" />
        ) : status === 'error' ? (
          <AlertCircle className="size-4" />
        ) : (
          step
        ))}
    </span>
  )
}

export const StepperSeparator = ({
  className,
  ...props
}: React.ComponentProps<'span'>) => {
  const { orientation } = useStepper()
  const { status } = useStepperItem()

  return (
    <span
      data-slot="stepper-separator"
      data-state={status}
      aria-hidden="true"
      className={cn(
        'absolute bg-border',
        status === 'complete' && 'bg-primary',
        orientation === 'horizontal'
          ? 'top-4 right-[calc(-50%+1rem)] left-[calc(50%+1rem)] h-px'
          : 'top-8 bottom-0 left-4 w-px',
        className
      )}
      {...props}
    />
  )
}

export const StepperTitle = ({
  className,
  ...props
}: React.ComponentProps<'span'>) => {
  const { status } = useStepperItem()

  return (
    <span
      data-slot="stepper-title"
      data-state={status}
      className={cn(
        'text-sm font-medium text-foreground',
        status === 'pending' && 'text-muted-foreground',
        className
      )}
      {...props}
    />
  )
}

export const StepperDescription = ({
  className,
  ...props
}: React.ComponentProps<'span'>) => {
  const { status } = useStepperItem()

  return (
    <span
      data-slot="stepper-description"
      data-state={status}
      className={cn('text-xs/5 text-muted-foreground', className)}
      {...props}
    />
  )
}

export type StepperContentProps = Omit<
  React.ComponentProps<'div'>,
  'hidden'
> & {
  readonly step: number
}

export const StepperContent = ({
  step,
  className,
  ...props
}: StepperContentProps) => {
  const { value, baseId } = useStepper()

  return (
    <div
      {...props}
      id={`${baseId}-content-${step}`}
      data-slot="stepper-content"
      data-state={value === step ? 'active' : 'inactive'}
      role="tabpanel"
      aria-labelledby={`${baseId}-trigger-${step}`}
      hidden={value !== step}
      className={cn('mt-6 outline-none', className)}
    />
  )
}
