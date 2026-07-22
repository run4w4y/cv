import { LoaderCircle } from 'lucide-react'
import type * as React from 'react'

import { cn } from './utils'

export type SpinnerProps = React.ComponentProps<typeof LoaderCircle>

export const Spinner = ({
  className,
  role,
  'aria-label': ariaLabel,
  'aria-hidden': ariaHidden,
  ...props
}: SpinnerProps) => {
  const isHidden = ariaHidden === true || ariaHidden === 'true'

  return (
    <LoaderCircle
      data-slot="spinner"
      role={isHidden ? role : (role ?? 'status')}
      aria-label={isHidden ? undefined : (ariaLabel ?? 'Loading')}
      aria-hidden={ariaHidden}
      className={cn(
        'size-4 animate-spin motion-reduce:animate-none',
        className
      )}
      {...props}
    />
  )
}
