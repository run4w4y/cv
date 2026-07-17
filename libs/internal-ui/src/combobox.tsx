import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox'
import { Check, ChevronsUpDown, Search, X } from 'lucide-react'
import * as React from 'react'

import { BadgeOverflow } from './badge-overflow'
import { Button } from './button'
import { portalLayerVariants } from './overlay-layer'
import { cn } from './utils'

export type ComboboxOption = {
  readonly value: string
  readonly label: string
  readonly description?: string
  readonly keywords?: readonly string[]
  readonly disabled?: boolean
}

type ComboboxSharedProps = {
  readonly id?: string
  readonly options: readonly ComboboxOption[]
  readonly placeholder?: string
  readonly searchPlaceholder?: string
  readonly emptyLabel?: string
  readonly ariaLabel?: string
  readonly ariaLabelledBy?: string
  readonly ariaDescribedBy?: string
  readonly invalid?: boolean
  readonly name?: string
  readonly form?: string
  readonly onBlur?: React.FocusEventHandler<HTMLButtonElement>
  readonly triggerRef?: React.Ref<HTMLButtonElement>
  readonly className?: string
  readonly disabled?: boolean
}

export type SingleComboboxProps = ComboboxSharedProps & {
  readonly mode?: 'single'
  readonly value: string | null
  readonly onValueChange: (value: string | null) => void
  readonly clearable?: boolean
}

export type MultiComboboxProps = ComboboxSharedProps & {
  readonly mode: 'multiple'
  readonly value: readonly string[]
  readonly onValueChange: (value: readonly string[]) => void
  readonly closeOnSelect?: boolean
}

export type ComboboxProps = SingleComboboxProps | MultiComboboxProps

export const filterComboboxOptions = (
  options: readonly ComboboxOption[],
  query: string
) => {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) return options

  return options.filter((option) =>
    [option.label, option.value, ...(option.keywords ?? [])]
      .join(' ')
      .toLocaleLowerCase()
      .includes(normalizedQuery)
  )
}

const optionMatchesQuery = (option: ComboboxOption, query: string) =>
  filterComboboxOptions([option], query).length > 0

const optionsAreEqual = (left: ComboboxOption, right: ComboboxOption) =>
  left.value === right.value

type ComboboxTriggerValueProps = {
  readonly selectedOptions: readonly ComboboxOption[]
  readonly placeholder: string
  readonly multiple: boolean
}

const ComboboxTriggerValue = ({
  selectedOptions,
  placeholder,
  multiple,
}: ComboboxTriggerValueProps) => {
  if (selectedOptions.length === 0) {
    return (
      <span className="min-w-0 flex-1 truncate text-left text-muted-foreground">
        {placeholder}
      </span>
    )
  }

  if (multiple) {
    return (
      <BadgeOverflow
        items={selectedOptions}
        getKey={(option) => option.value}
        getLabel={(option) => option.label}
        maxVisible={2}
        badgeVariant="secondary"
        className="min-w-0 flex-1 flex-nowrap overflow-hidden [&>[data-slot=badge]]:max-w-32 [&>[data-slot=badge]]:min-w-0"
        renderBadge={(_, label) => <span className="truncate">{label}</span>}
      />
    )
  }

  return (
    <span className="min-w-0 flex-1 truncate text-left">
      {selectedOptions[0]?.label}
    </span>
  )
}

type ComboboxControlProps = {
  readonly id?: string
  readonly selectedOptions: readonly ComboboxOption[]
  readonly placeholder: string
  readonly ariaLabel?: string
  readonly ariaLabelledBy?: string
  readonly ariaDescribedBy?: string
  readonly invalid?: boolean
  readonly onBlur?: React.FocusEventHandler<HTMLButtonElement>
  readonly triggerRef?: React.Ref<HTMLButtonElement>
  readonly className?: string
  readonly disabled?: boolean
  readonly multiple: boolean
  readonly clearable?: boolean
}

const ComboboxControl = ({
  id,
  selectedOptions,
  placeholder,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  invalid,
  onBlur,
  triggerRef,
  className,
  disabled,
  multiple,
  clearable = false,
}: ComboboxControlProps) => (
  <div className={cn('relative isolate min-w-0', className)}>
    <ComboboxPrimitive.Trigger
      aria-haspopup="listbox"
      render={
        <Button
          id={id}
          ref={triggerRef}
          type="button"
          variant="outline"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-describedby={ariaDescribedBy}
          aria-invalid={invalid}
          onBlur={onBlur}
          disabled={disabled}
          className={cn(
            'w-full min-w-0 justify-between overflow-hidden px-3 font-normal aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 aria-invalid:focus-visible:border-destructive aria-invalid:focus-visible:ring-destructive/20',
            clearable && selectedOptions.length > 0 && 'pr-16'
          )}
        >
          <ComboboxTriggerValue
            selectedOptions={selectedOptions}
            placeholder={placeholder}
            multiple={multiple}
          />
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      }
    />
    {clearable && selectedOptions.length > 0 ? (
      <ComboboxPrimitive.Clear
        aria-label="Clear selection"
        className="absolute top-1/2 right-8 z-10 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/25"
        onClick={(event) => event.stopPropagation()}
      >
        <X className="size-3.5" />
      </ComboboxPrimitive.Clear>
    ) : null}
  </div>
)

type ComboboxPopupProps = {
  readonly ariaLabel?: string
  readonly placeholder: string
  readonly searchPlaceholder: string
  readonly emptyLabel: string
}

const ComboboxPopup = ({
  ariaLabel,
  placeholder,
  searchPlaceholder,
  emptyLabel,
}: ComboboxPopupProps) => (
  <ComboboxPrimitive.Portal
    data-slot="combobox-portal"
    className={portalLayerVariants({ layer: 'floating' })}
  >
    <ComboboxPrimitive.Positioner
      align="start"
      sideOffset={6}
      className="max-w-[calc(100vw-2rem)]"
    >
      <ComboboxPrimitive.Popup
        data-slot="combobox-content"
        aria-label={ariaLabel ?? placeholder}
        className="w-(--anchor-width) min-w-64 origin-(--transform-origin) overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md outline-none transition-[transform,scale,opacity] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0"
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <ComboboxPrimitive.Input
            autoFocus
            aria-label={searchPlaceholder}
            placeholder={searchPlaceholder}
            className="h-10 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        <ComboboxPrimitive.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </ComboboxPrimitive.Empty>
        <ComboboxPrimitive.List className="max-h-72 overflow-y-auto p-1">
          {(option: ComboboxOption, index: number) => (
            <ComboboxPrimitive.Item
              key={option.value}
              value={option}
              index={index}
              disabled={option.disabled}
              className="relative flex min-h-9 cursor-pointer items-start gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none select-none data-highlighted:bg-muted data-highlighted:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50"
            >
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                <ComboboxPrimitive.ItemIndicator>
                  <Check className="size-4" />
                </ComboboxPrimitive.ItemIndicator>
              </span>
              <span className="min-w-0 flex-1 whitespace-normal break-words">
                <span className="block font-medium">{option.label}</span>
                {option.description ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {option.description}
                  </span>
                ) : null}
              </span>
            </ComboboxPrimitive.Item>
          )}
        </ComboboxPrimitive.List>
      </ComboboxPrimitive.Popup>
    </ComboboxPrimitive.Positioner>
  </ComboboxPrimitive.Portal>
)

const SingleCombobox = ({
  id,
  options,
  value,
  onValueChange,
  placeholder = 'Select a value…',
  searchPlaceholder = 'Search…',
  emptyLabel = 'No options found.',
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
  clearable,
}: SingleComboboxProps) => {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const selected =
    value === null
      ? null
      : (options.find((option) => option.value === value) ?? null)

  return (
    <ComboboxPrimitive.Root<ComboboxOption>
      items={options}
      name={name}
      form={form}
      value={selected}
      onValueChange={(option) => onValueChange(option?.value ?? null)}
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setQuery('')
      }}
      inputValue={query}
      onInputValueChange={(nextQuery, details) => {
        if (details.reason === 'input-change') setQuery(nextQuery)
      }}
      filter={optionMatchesQuery}
      itemToStringLabel={(option) => option.label}
      itemToStringValue={(option) => option.value}
      isItemEqualToValue={optionsAreEqual}
      disabled={disabled}
    >
      <ComboboxControl
        id={id}
        selectedOptions={selected === null ? [] : [selected]}
        placeholder={placeholder}
        ariaLabel={ariaLabel}
        ariaLabelledBy={ariaLabelledBy}
        ariaDescribedBy={ariaDescribedBy}
        invalid={invalid}
        onBlur={onBlur}
        triggerRef={triggerRef}
        className={className}
        disabled={disabled}
        multiple={false}
        clearable={clearable}
      />
      <ComboboxPopup
        ariaLabel={ariaLabel}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        emptyLabel={emptyLabel}
      />
    </ComboboxPrimitive.Root>
  )
}

const MultipleCombobox = ({
  id,
  options,
  value,
  onValueChange,
  placeholder = 'Select values…',
  searchPlaceholder = 'Search…',
  emptyLabel = 'No options found.',
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
  closeOnSelect,
}: MultiComboboxProps) => {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const selectedOptions = value.flatMap((selectedValue) => {
    const option = options.find(
      (candidate) => candidate.value === selectedValue
    )
    return option ? [option] : []
  })

  return (
    <ComboboxPrimitive.Root<ComboboxOption, true>
      multiple
      items={options}
      name={name}
      form={form}
      value={selectedOptions}
      onValueChange={(nextOptions) => {
        onValueChange(nextOptions.map((option) => option.value))
        setQuery('')
        if (closeOnSelect) setOpen(false)
      }}
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setQuery('')
      }}
      inputValue={query}
      onInputValueChange={(nextQuery, details) => {
        if (details.reason === 'input-change') setQuery(nextQuery)
      }}
      filter={optionMatchesQuery}
      itemToStringLabel={(option) => option.label}
      itemToStringValue={(option) => option.value}
      isItemEqualToValue={optionsAreEqual}
      disabled={disabled}
    >
      <ComboboxControl
        id={id}
        selectedOptions={selectedOptions}
        placeholder={placeholder}
        ariaLabel={ariaLabel}
        ariaLabelledBy={ariaLabelledBy}
        ariaDescribedBy={ariaDescribedBy}
        invalid={invalid}
        onBlur={onBlur}
        triggerRef={triggerRef}
        className={className}
        disabled={disabled}
        multiple
      />
      <ComboboxPopup
        ariaLabel={ariaLabel}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        emptyLabel={emptyLabel}
      />
    </ComboboxPrimitive.Root>
  )
}

export const Combobox = (props: ComboboxProps) =>
  props.mode === 'multiple' ? (
    <MultipleCombobox {...props} />
  ) : (
    <SingleCombobox {...props} />
  )
