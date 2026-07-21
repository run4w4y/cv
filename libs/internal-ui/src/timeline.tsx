import { cva } from 'class-variance-authority'
import { Check, Circle, Minus, X } from 'lucide-react'
import * as React from 'react'

import { cn } from './utils'

export type TimelineStatus =
  | 'pending'
  | 'active'
  | 'complete'
  | 'error'
  | 'skipped'
type TimelineOrientation = 'horizontal' | 'vertical'

const TimelineContext = React.createContext<TimelineOrientation | undefined>(
  undefined
)

const useTimeline = () => {
  const orientation = React.useContext(TimelineContext)
  if (orientation === undefined) {
    throw new Error('Timeline parts must be used within Timeline.')
  }
  return orientation
}

const TimelineItemContext = React.createContext<TimelineStatus | undefined>(
  undefined
)

const useTimelineItem = () => {
  const status = React.useContext(TimelineItemContext)
  if (status === undefined) {
    throw new Error('Timeline item parts must be used within TimelineItem.')
  }
  return status
}

export type TimelineProps = React.ComponentProps<'ol'> & {
  readonly orientation?: TimelineOrientation
}

export const Timeline = ({
  orientation = 'vertical',
  className,
  ...props
}: TimelineProps) => (
  <TimelineContext.Provider value={orientation}>
    <ol
      data-slot="timeline"
      data-orientation={orientation}
      className={cn(
        orientation === 'horizontal'
          ? 'flex w-full items-start'
          : 'flex w-full flex-col',
        className
      )}
      {...props}
    />
  </TimelineContext.Provider>
)

export type TimelineItemProps = React.ComponentProps<'li'> & {
  readonly status?: TimelineStatus
}

export const TimelineItem = ({
  status = 'pending',
  className,
  ...props
}: TimelineItemProps) => {
  const orientation = useTimeline()

  return (
    <TimelineItemContext.Provider value={status}>
      <li
        data-slot="timeline-item"
        data-state={status}
        data-orientation={orientation}
        className={cn(
          'relative min-w-0 last:[&_[data-slot=timeline-connector]]:hidden',
          orientation === 'horizontal'
            ? 'flex flex-1 flex-col items-center text-center'
            : 'grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-x-3 pb-6 last:pb-0',
          className
        )}
        {...props}
      />
    </TimelineItemContext.Provider>
  )
}

const timelineIndicatorVariants = cva(
  'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border bg-background',
  {
    variants: {
      status: {
        pending: 'border-border text-muted-foreground',
        active: 'border-primary bg-accent text-primary ring-4 ring-primary/10',
        complete: 'border-primary bg-primary text-primary-foreground',
        error:
          'border-destructive bg-destructive/10 text-destructive ring-4 ring-destructive/10',
        skipped: 'border-border bg-muted text-muted-foreground',
      },
    },
  }
)

export const TimelineIndicator = ({
  className,
  children,
  ...props
}: React.ComponentProps<'span'>) => {
  const status = useTimelineItem()

  return (
    <span
      data-slot="timeline-indicator"
      data-state={status}
      aria-hidden="true"
      className={cn(timelineIndicatorVariants({ status }), className)}
      {...props}
    >
      {children ??
        (status === 'complete' ? (
          <Check className="size-4" />
        ) : status === 'error' ? (
          <X className="size-4" />
        ) : status === 'skipped' ? (
          <Minus className="size-4" />
        ) : (
          <Circle
            className={cn('size-2', status === 'active' && 'fill-current')}
          />
        ))}
    </span>
  )
}

export const TimelineConnector = ({
  className,
  ...props
}: React.ComponentProps<'span'>) => {
  const orientation = useTimeline()
  const status = useTimelineItem()

  return (
    <span
      data-slot="timeline-connector"
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

export const TimelineContent = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => {
  const orientation = useTimeline()

  return (
    <div
      data-slot="timeline-content"
      className={cn(
        'min-w-0',
        orientation === 'horizontal' ? 'mt-3 px-2' : 'pt-1',
        className
      )}
      {...props}
    />
  )
}

export const TimelineTitle = ({
  className,
  ...props
}: React.ComponentProps<'h3'>) => (
  <h3
    data-slot="timeline-title"
    className={cn('text-sm font-medium text-foreground', className)}
    {...props}
  />
)

export const TimelineDescription = ({
  className,
  ...props
}: React.ComponentProps<'p'>) => (
  <p
    data-slot="timeline-description"
    className={cn('mt-1 text-sm/6 text-muted-foreground', className)}
    {...props}
  />
)

export const TimelineTime = ({
  className,
  ...props
}: React.ComponentProps<'time'>) => (
  <time
    data-slot="timeline-time"
    className={cn('mt-1 block text-xs text-muted-foreground', className)}
    {...props}
  />
)
