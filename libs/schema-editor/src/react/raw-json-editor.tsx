import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Textarea,
} from '@cv/internal-ui'
import * as React from 'react'

import { formatRawJson, type JsonValue, parseRawJson } from '../core'

export interface RawJsonEditorProps {
  readonly value: unknown
  readonly onChange: (value: JsonValue) => void
  readonly label?: string
  readonly description?: string
  readonly disabled?: boolean
  readonly issues?: ReadonlyArray<string>
  readonly className?: string
}

export const RawJsonEditor = ({
  value,
  onChange,
  label = 'Raw JSON',
  description,
  disabled,
  issues = [],
  className,
}: RawJsonEditorProps) => {
  const id = React.useId()
  const [draft, setDraft] = React.useState(() => {
    const formatted = formatRawJson(value)
    return formatted.valid
      ? { source: formatted.source, formatError: null }
      : { source: '', formatError: formatted.message }
  })
  const [parseError, setParseError] = React.useState<string | null>(null)
  const lastEmitted = React.useRef<unknown>(undefined)

  React.useEffect(() => {
    if (Object.is(lastEmitted.current, value)) {
      lastEmitted.current = undefined
      return
    }
    const formatted = formatRawJson(value)
    setDraft(
      formatted.valid
        ? { source: formatted.source, formatError: null }
        : { source: '', formatError: formatted.message }
    )
    setParseError(null)
  }, [value])

  const invalid =
    draft.formatError !== null || parseError !== null || issues.length > 0

  return (
    <Field className={className} invalid={invalid}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <Textarea
        id={id}
        value={draft.source}
        disabled={disabled}
        spellCheck={false}
        aria-invalid={invalid}
        className="min-h-48 font-mono text-xs"
        onChange={(event) => {
          const nextSource = event.currentTarget.value
          setDraft({ source: nextSource, formatError: null })
          const parsed = parseRawJson(nextSource)
          if (!parsed.valid) {
            setParseError(parsed.message)
            return
          }
          setParseError(null)
          lastEmitted.current = parsed.value
          onChange(parsed.value)
        }}
      />
      {draft.formatError ? (
        <FieldError match>{draft.formatError}</FieldError>
      ) : null}
      {parseError ? <FieldError match>{parseError}</FieldError> : null}
      {issues.map((issue) => (
        <FieldError match key={issue}>
          {issue}
        </FieldError>
      ))}
    </Field>
  )
}
