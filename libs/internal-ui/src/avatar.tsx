import { Avatar as AvatarPrimitive } from '@base-ui/react/avatar'

import { cn } from './utils'

export const Avatar = ({ className, ...props }: AvatarPrimitive.Root.Props) => (
  <AvatarPrimitive.Root
    data-slot="avatar"
    className={cn(
      'relative flex size-9 shrink-0 overflow-hidden rounded-full bg-muted',
      className
    )}
    {...props}
  />
)

export const AvatarImage = ({
  className,
  ...props
}: AvatarPrimitive.Image.Props) => (
  <AvatarPrimitive.Image
    data-slot="avatar-image"
    className={cn('size-full object-cover', className)}
    {...props}
  />
)

export const AvatarFallback = ({
  className,
  ...props
}: AvatarPrimitive.Fallback.Props) => (
  <AvatarPrimitive.Fallback
    data-slot="avatar-fallback"
    className={cn(
      'flex size-full items-center justify-center bg-muted text-xs font-medium text-muted-foreground',
      className
    )}
    {...props}
  />
)
