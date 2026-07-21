import { ScrollArea as ScrollAreaPrimitive } from '@base-ui/react/scroll-area'
import type * as React from 'react'

import { cn } from './utils'

export type ScrollBarProps = ScrollAreaPrimitive.Scrollbar.Props

export const ScrollBar = ({
  className,
  orientation = 'vertical',
  ...props
}: ScrollBarProps) => (
  <ScrollAreaPrimitive.Scrollbar
    data-slot="scroll-area-scrollbar"
    orientation={orientation}
    className={cn(
      'flex touch-none p-px opacity-0 transition-opacity select-none data-hovering:opacity-100 data-scrolling:opacity-100',
      orientation === 'vertical'
        ? 'h-full w-2.5 border-l border-l-transparent'
        : 'h-2.5 w-full flex-col border-t border-t-transparent',
      className
    )}
    {...props}
  >
    <ScrollAreaPrimitive.Thumb
      data-slot="scroll-area-thumb"
      className="relative flex-1 rounded-full bg-border"
    />
  </ScrollAreaPrimitive.Scrollbar>
)

export type ScrollAreaProps = Omit<
  ScrollAreaPrimitive.Root.Props,
  'children'
> & {
  readonly children?: React.ReactNode
  readonly orientation?: 'vertical' | 'horizontal' | 'both'
  readonly viewportClassName?: string
  readonly contentClassName?: string
  readonly scrollbarClassName?: string
}

export const ScrollArea = ({
  className,
  children,
  orientation = 'vertical',
  viewportClassName,
  contentClassName,
  scrollbarClassName,
  ...props
}: ScrollAreaProps) => (
  <ScrollAreaPrimitive.Root
    data-slot="scroll-area"
    data-orientation={orientation}
    className={cn('relative overflow-hidden', className)}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport
      data-slot="scroll-area-viewport"
      className={cn(
        'size-full overscroll-contain rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-ring/25',
        viewportClassName
      )}
    >
      <ScrollAreaPrimitive.Content
        data-slot="scroll-area-content"
        className={cn('min-w-full', contentClassName)}
      >
        {children}
      </ScrollAreaPrimitive.Content>
    </ScrollAreaPrimitive.Viewport>
    {orientation === 'horizontal' ? null : (
      <ScrollBar orientation="vertical" className={scrollbarClassName} />
    )}
    {orientation === 'vertical' ? null : (
      <ScrollBar orientation="horizontal" className={scrollbarClassName} />
    )}
    <ScrollAreaPrimitive.Corner
      data-slot="scroll-area-corner"
      className="bg-border"
    />
  </ScrollAreaPrimitive.Root>
)
