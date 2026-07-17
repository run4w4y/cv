import type { FilterValueDescriptor } from '@cv/drizzle-query'
import { Checkbox, Combobox, cn, DateTimeInput, Input } from '@cv/internal-ui'
import * as React from 'react'

import { dateFromFilterValue, filterValueFromDate } from '../date-value'
import {
  embeddedDateInputClassName,
  optionLabel,
  type ValueEditorProps,
} from './editor-types'

const textValue = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : ''

const inputTypeFor = (descriptor: FilterValueDescriptor): 'number' | 'text' =>
  descriptor.type === 'number' || descriptor.type === 'bigint'
    ? 'number'
    : 'text'

const DeferredScalarInput = ({
  descriptor,
  value,
  onChange,
  ariaLabel,
  embedded,
}: Pick<
  ValueEditorProps,
  'descriptor' | 'value' | 'onChange' | 'ariaLabel' | 'embedded'
>) => {
  const [draft, setDraft] = React.useState(() => textValue(value))

  React.useEffect(() => setDraft(textValue(value)), [value])

  const commit = () => {
    if (descriptor.type === 'number') {
      onChange(draft.trim().length === 0 ? undefined : Number(draft))
      return
    }
    onChange(draft)
  }

  return (
    <Input
      aria-label={ariaLabel}
      type={inputTypeFor(descriptor)}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          commit()
        }
      }}
      className={cn(
        'w-full',
        embedded &&
          'h-10 rounded-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0'
      )}
    />
  )
}

export const ScalarEditor = ({
  descriptor,
  value,
  onChange,
  options,
  ariaLabel,
  embedded = false,
}: ValueEditorProps) => {
  if (descriptor.type === 'boolean') {
    return (
      <div
        className={cn(
          'flex h-9 items-center gap-2 text-sm',
          embedded
            ? 'w-full bg-transparent'
            : 'rounded-md border border-input bg-card px-3'
        )}
      >
        <Checkbox
          aria-label={ariaLabel}
          checked={value === true}
          onCheckedChange={(checked) => onChange(checked === true)}
        />
        <span>{value === true ? 'True' : 'False'}</span>
      </div>
    )
  }

  if (descriptor.type === 'date') {
    return (
      <DateTimeInput
        value={dateFromFilterValue(value)}
        onChange={(next) => onChange(filterValueFromDate(next))}
        inputAriaLabel={ariaLabel}
        ariaLabel={`${ariaLabel} calendar`}
        className={cn(
          'w-full',
          embedded && embeddedDateInputClassName,
          embedded && 'w-58'
        )}
      />
    )
  }

  const descriptorOptions =
    options.length > 0
      ? options
      : descriptor.type === 'enum'
        ? descriptor.values.map((item) => ({
            label: optionLabel(item),
            value: item,
          }))
        : []
  if (descriptorOptions.length > 0) {
    return (
      <Combobox
        ariaLabel={ariaLabel}
        value={typeof value === 'string' ? value : null}
        onValueChange={(next) => {
          if (next !== null) onChange(next)
        }}
        options={descriptorOptions}
        placeholder="Select…"
        className={cn(
          'w-full',
          embedded &&
            '[&_[data-slot=button]]:h-10 [&_[data-slot=button]]:rounded-none [&_[data-slot=button]]:border-0 [&_[data-slot=button]]:bg-transparent [&_[data-slot=button]]:px-0 [&_[data-slot=button]:focus-visible]:ring-0'
        )}
      />
    )
  }

  return (
    <DeferredScalarInput
      descriptor={descriptor}
      value={value}
      onChange={onChange}
      ariaLabel={ariaLabel}
      embedded={embedded}
    />
  )
}
