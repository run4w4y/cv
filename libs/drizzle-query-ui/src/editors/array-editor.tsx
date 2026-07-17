import type { FilterValueDescriptor } from '@cv/drizzle-query'
import { Combobox, cn, Input } from '@cv/internal-ui'
import * as React from 'react'

import type { ValueEditorProps } from './editor-types'
import { optionLabel } from './editor-types'
import { JsonEditor } from './json-editor'

type ArrayDescriptor = Extract<FilterValueDescriptor, { type: 'array' }>

const isFlatArrayItem = (
  descriptor: FilterValueDescriptor
): descriptor is Exclude<
  FilterValueDescriptor,
  { type: 'array' | 'struct' | 'tuple' }
> =>
  descriptor.type !== 'array' &&
  descriptor.type !== 'struct' &&
  descriptor.type !== 'tuple'

const parseItem = (
  descriptor: Exclude<
    FilterValueDescriptor,
    { type: 'array' | 'struct' | 'tuple' }
  >,
  value: string
): unknown => {
  if (descriptor.type === 'number') return Number(value)
  if (descriptor.type === 'boolean') {
    if (value.toLocaleLowerCase('en-US') === 'true') return true
    if (value.toLocaleLowerCase('en-US') === 'false') return false
  }
  return value
}

export const ArrayEditor = ({
  descriptor,
  value,
  onChange,
  options,
  ariaLabel,
  embedded = false,
}: ValueEditorProps & { readonly descriptor: ArrayDescriptor }) => {
  const values = Array.isArray(value) ? value : []
  const encodedValues = values.map(String).join(', ')
  const [draft, setDraft] = React.useState(encodedValues)
  const itemDescriptor = descriptor.item

  React.useEffect(() => setDraft(encodedValues), [encodedValues])

  if (!isFlatArrayItem(itemDescriptor)) {
    return (
      <JsonEditor
        value={values}
        onChange={onChange}
        ariaLabel={ariaLabel}
        embedded={embedded}
      />
    )
  }

  const descriptorOptions =
    options.length > 0
      ? options
      : itemDescriptor.type === 'enum'
        ? itemDescriptor.values.map((item) => ({
            label: optionLabel(item),
            value: item,
          }))
        : []
  if (descriptorOptions.length > 0) {
    return (
      <Combobox
        mode="multiple"
        ariaLabel={ariaLabel}
        value={values.filter(
          (item): item is string => typeof item === 'string'
        )}
        onValueChange={onChange}
        options={descriptorOptions}
        placeholder="Select values…"
        className={cn(
          'w-full min-w-48',
          embedded &&
            '[&_[data-slot=button]]:h-10 [&_[data-slot=button]]:rounded-none [&_[data-slot=button]]:border-0 [&_[data-slot=button]]:bg-transparent [&_[data-slot=button]]:px-0 [&_[data-slot=button]:focus-visible]:ring-0'
        )}
      />
    )
  }

  const commit = () =>
    onChange(
      draft
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => parseItem(itemDescriptor, item))
    )

  return (
    <Input
      aria-label={ariaLabel}
      value={draft}
      placeholder="Comma-separated values"
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
