import { cn } from '@cv/ui/utils'
import { TechIcon } from './tech-icon'

type TechListProps = {
  className?: string
  iconClassName?: string
  itemClassName?: string
  items: readonly string[]
  separator?: string
}

export const TechList = ({
  className,
  iconClassName,
  itemClassName,
  items,
  separator = ',',
}: TechListProps) => (
  <ul
    className={cn(
      'flex flex-wrap content-start items-center gap-x-1.5 gap-y-1 font-mono',
      className
    )}
  >
    {items.map((item, index) => (
      <li
        className={cn('inline-flex items-center gap-1.5', itemClassName)}
        key={item}
      >
        <TechIcon className={iconClassName} name={item} />
        <span>
          {item}
          {index < items.length - 1 ? separator : null}
        </span>
      </li>
    ))}
  </ul>
)
