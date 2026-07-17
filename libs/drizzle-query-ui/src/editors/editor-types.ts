import type { FilterValueDescriptor } from '@cv/drizzle-query'

import type { QueryFilterOption } from '../model'

export type ValueEditorProps = {
  readonly descriptor: FilterValueDescriptor
  readonly value: unknown
  readonly onChange: (value: unknown) => void
  readonly options: readonly QueryFilterOption[]
  readonly ariaLabel: string
  readonly embedded?: boolean
}

export const embeddedDateInputClassName =
  'max-w-full min-w-0 space-y-0 [&>[data-slot=input-group]]:min-h-10 [&>[data-slot=input-group]]:rounded-none [&>[data-slot=input-group]]:border-0 [&>[data-slot=input-group]]:bg-transparent [&>[data-slot=input-group]]:shadow-none [&>[data-slot=input-group]]:has-[[data-slot=input-group-control]:focus-visible]:ring-0 [&_[data-slot=input-group-button]]:border-0 [&_[data-slot=input-group-button]]:bg-transparent [&_[data-slot=input-group-button]:hover]:bg-transparent [&_[data-slot=input-group-button]:focus-visible]:ring-0 [&_[data-slot=input-group-text]]:bg-transparent'

export const optionLabel = (value: string): string =>
  value
    .replaceAll(/[_-]+/gu, ' ')
    .replace(/^./u, (character) => character.toLocaleUpperCase('en-US'))
