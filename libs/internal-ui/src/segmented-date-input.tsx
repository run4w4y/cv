import * as React from 'react'
import {
  DateInput as AriaDateInput,
  DateField,
  DateSegment,
  type DateValue,
} from 'react-aria-components'

import {
  toCalendarDate,
  toCalendarDateTimeValue,
  toDate,
} from './calendar-utils'
import { cn } from './utils'

export interface SegmentedDateInputProps
  extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    'children' | 'defaultValue' | 'onBlur' | 'onChange' | 'onFocus'
  > {
  readonly value?: Date | null
  readonly onChange?: (value: Date | undefined) => void
  readonly onBlur?: React.FocusEventHandler<Element>
  readonly ariaLabel: string
  readonly name?: string
  readonly form?: string
  readonly autoFocus?: boolean
  readonly required?: boolean
  readonly readOnly?: boolean
  readonly disabled?: boolean
  readonly invalid?: boolean
  readonly minValue?: Date
  readonly maxValue?: Date
  readonly isDateUnavailable?: (date: Date) => boolean
  readonly granularity?: 'day' | 'minute'
}

const toSegmentedValue = (
  value?: Date | null,
  granularity: 'day' | 'minute' = 'day'
): DateValue | undefined =>
  granularity === 'minute'
    ? toCalendarDateTimeValue(value)
    : toCalendarDate(value)

const EMPTY_VALUE_KEY = '__empty__'
const valueKey = (value?: DateValue | null) =>
  value?.toString() ?? EMPTY_VALUE_KEY

export const SegmentedDateInput = React.forwardRef<
  HTMLDivElement,
  SegmentedDateInputProps
>(
  (
    {
      value,
      onChange,
      ariaLabel,
      name,
      form,
      autoFocus,
      required,
      readOnly,
      disabled,
      invalid,
      minValue,
      maxValue,
      isDateUnavailable,
      granularity = 'day',
      className,
      onBlur,
      ...props
    },
    forwardedRef
  ) => {
    const inputRef = React.useRef<HTMLDivElement | null>(null)
    const clearIfIncompleteRef = React.useRef<() => void>(() => undefined)
    const calendarValue = React.useMemo(
      () => toSegmentedValue(value, granularity),
      [granularity, value]
    )
    const calendarValueKey = valueKey(calendarValue)
    const [resetKey, setResetKey] = React.useState(0)
    const [defaultValue, setDefaultValue] = React.useState<
      DateValue | undefined
    >(() => calendarValue)
    const syncedValueKey = React.useRef(calendarValueKey)
    const skipNextSyncKey = React.useRef<string | null>(null)

    React.useEffect(() => {
      if (calendarValueKey === syncedValueKey.current) return
      if (skipNextSyncKey.current === calendarValueKey) {
        skipNextSyncKey.current = null
        syncedValueKey.current = calendarValueKey
        return
      }

      skipNextSyncKey.current = null
      syncedValueKey.current = calendarValueKey
      setDefaultValue(calendarValue)
      setResetKey((key) => key + 1)
    }, [calendarValue, calendarValueKey])

    const hasIncompleteSegments = React.useCallback(() => {
      const segments = Array.from(
        inputRef.current?.querySelectorAll<HTMLElement>(
          '[data-type]:not([data-type="literal"])'
        ) ?? []
      )
      return (
        segments.length > 0 &&
        segments.some((segment) => segment.hasAttribute('data-placeholder'))
      )
    }, [])

    const clearIfIncomplete = React.useCallback(() => {
      if (!hasIncompleteSegments()) return
      skipNextSyncKey.current = EMPTY_VALUE_KEY
      onChange?.(undefined)
    }, [hasIncompleteSegments, onChange])
    clearIfIncompleteRef.current = clearIfIncomplete

    const handleKeyUp = React.useCallback((event: KeyboardEvent) => {
      if (event.key === 'Backspace' || event.key === 'Delete') {
        void Promise.resolve().then(() => clearIfIncompleteRef.current())
      }
    }, [])
    const handleFocus = React.useCallback((event: FocusEvent) => {
      if (event.target !== event.currentTarget) return
      const input = event.currentTarget as HTMLDivElement
      input.querySelector<HTMLElement>('[role="spinbutton"]')?.focus()
    }, [])
    const setInputRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        const previous = inputRef.current
        previous?.removeEventListener('keyup', handleKeyUp)
        previous?.removeEventListener('focus', handleFocus)

        inputRef.current = node
        if (node) {
          node.tabIndex = -1
          node.addEventListener('keyup', handleKeyUp)
          node.addEventListener('focus', handleFocus)
        }

        if (typeof forwardedRef === 'function') forwardedRef(node)
        else if (forwardedRef) forwardedRef.current = node
      },
      [forwardedRef, handleFocus, handleKeyUp]
    )

    return (
      <DateField<DateValue>
        key={resetKey}
        className="contents"
        aria-label={props['aria-labelledby'] ? undefined : ariaLabel}
        aria-labelledby={props['aria-labelledby']}
        defaultValue={defaultValue}
        onChange={(next) => {
          skipNextSyncKey.current = valueKey(next)
          onChange?.(next ? toDate(next) : undefined)
        }}
        name={undefined}
        autoFocus={autoFocus}
        isRequired={required}
        isReadOnly={readOnly}
        granularity={granularity}
        isDisabled={disabled}
        isInvalid={invalid}
        minValue={toSegmentedValue(minValue, granularity)}
        maxValue={toSegmentedValue(maxValue, granularity)}
        isDateUnavailable={
          isDateUnavailable
            ? (next) => {
                const date = toDate(next)
                return date ? isDateUnavailable(date) : false
              }
            : undefined
        }
        validationBehavior="aria"
        onBlur={(event) => {
          clearIfIncomplete()
          onBlur?.(event)
        }}
      >
        <AriaDateInput
          {...props}
          ref={setInputRef}
          data-slot="input-group-control"
          aria-label={props['aria-labelledby'] ? undefined : ariaLabel}
          className={cn(
            'flex min-h-9 min-w-0 flex-1 items-center overflow-hidden bg-transparent px-3 py-2 text-sm text-foreground outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
            className
          )}
        >
          {(segment) => (
            <DateSegment
              segment={segment}
              className="inline-flex min-w-[1ch] items-center justify-center rounded-sm px-px text-center tabular-nums outline-none data-[focused]:bg-accent data-[focused]:text-accent-foreground data-[invalid]:text-destructive data-[placeholder]:text-muted-foreground data-[type=literal]:min-w-0 data-[type=literal]:px-0 data-[type=literal]:text-muted-foreground"
            />
          )}
        </AriaDateInput>
        {name ? (
          <input
            type="hidden"
            name={name}
            form={form}
            disabled={disabled}
            value={calendarValue?.toString() ?? ''}
          />
        ) : null}
      </DateField>
    )
  }
)

SegmentedDateInput.displayName = 'SegmentedDateInput'
