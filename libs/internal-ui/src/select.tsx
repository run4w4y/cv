import { Select as SelectPrimitive } from '@base-ui/react/select'
import { Check, ChevronDown } from 'lucide-react'
import type { FocusEventHandler, ReactNode, Ref } from 'react'

import { portalLayerVariants } from './overlay-layer'
import { cn } from './utils'

export type SelectOption = {
  readonly label: string
  readonly value: string
  readonly disabled?: boolean
}

export type SelectProps = {
  readonly id?: string
  readonly value: string | null
  readonly onValueChange: (value: string | null) => void
  readonly options: readonly SelectOption[]
  readonly placeholder?: string
  readonly ariaLabel?: string
  readonly ariaLabelledBy?: string
  readonly ariaDescribedBy?: string
  readonly invalid?: boolean
  readonly name?: string
  readonly form?: string
  readonly onBlur?: FocusEventHandler<HTMLButtonElement>
  readonly triggerRef?: Ref<HTMLButtonElement>
  readonly className?: string
  readonly disabled?: boolean
  readonly renderValue?: (option: SelectOption | undefined) => ReactNode
  readonly variant?: 'default' | 'ghost'
}

export const Select = ({
  id,
  value,
  onValueChange,
  options,
  placeholder = 'Select…',
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  invalid,
  name,
  form,
  onBlur,
  triggerRef,
  className,
  disabled,
  renderValue,
  variant = 'default',
}: SelectProps) => {
  const selected = options.find((option) => option.value === value)

  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      items={options}
      name={name}
      form={form}
    >
      <SelectPrimitive.Trigger
        id={id}
        ref={triggerRef}
        data-slot="select-trigger"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-invalid={invalid}
        onBlur={onBlur}
        className={cn(
          'flex h-9 min-w-0 items-center justify-between gap-2 rounded-md border px-3 text-left text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 aria-invalid:focus-visible:border-destructive aria-invalid:focus-visible:ring-destructive/20 disabled:cursor-not-allowed disabled:opacity-50',
          variant === 'default'
            ? 'border-border bg-card'
            : 'border-transparent bg-transparent hover:border-border hover:bg-muted/60',
          className
        )}
      >
        <SelectPrimitive.Value className="min-w-0 flex-1 truncate">
          {renderValue?.(selected) ?? selected?.label ?? (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </SelectPrimitive.Value>
        <SelectPrimitive.Icon>
          <ChevronDown className="size-4 text-muted-foreground" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal
        data-slot="select-portal"
        className={portalLayerVariants({ layer: 'floating' })}
      >
        <SelectPrimitive.Positioner sideOffset={6} alignItemWithTrigger={false}>
          <SelectPrimitive.Popup
            data-slot="select-content"
            className="max-h-80 w-(--anchor-width) min-w-44 max-w-[calc(100vw-2rem)] origin-(--transform-origin) overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none transition-[transform,scale,opacity] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0"
          >
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="relative flex min-h-8 cursor-default items-start rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none select-none data-highlighted:bg-muted data-highlighted:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50"
              >
                <SelectPrimitive.ItemText className="min-w-0 whitespace-normal break-words">
                  {option.label}
                </SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute top-2 right-2 flex size-4 items-center justify-center">
                  <Check className="size-4" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
