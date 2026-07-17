import { cn, Input } from '@cv/internal-ui'
import * as React from 'react'

import type { ValueEditorProps } from './editor-types'

const jsonValue = (value: unknown): string => JSON.stringify(value ?? {})

export const JsonEditor = ({
  value,
  onChange,
  ariaLabel,
  embedded = false,
}: Pick<ValueEditorProps, 'value' | 'onChange' | 'ariaLabel' | 'embedded'>) => {
  const [draft, setDraft] = React.useState(() => jsonValue(value))

  React.useEffect(() => setDraft(jsonValue(value)), [value])

  return (
    <Input
      aria-label={ariaLabel}
      value={draft}
      onChange={(event) => {
        const next = event.target.value
        setDraft(next)
        try {
          onChange(JSON.parse(next))
        } catch {
          // Preserve the draft until it becomes valid JSON.
        }
      }}
      className={cn(
        'min-w-64',
        embedded &&
          'h-10 rounded-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0'
      )}
    />
  )
}
