import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Textarea,
} from '@cv/internal-ui'
import * as React from 'react'

import { formatRawJson, parseRawJson } from '../core'

export interface RawJsonEditorProps {
  readonly value: unknown
  readonly onChange: (value: unknown) => void
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
  const [source, setSource] = React.useState(() => formatRawJson(value))
  const [parseError, setParseError] = React.useState<string | null>(null)
  const lastEmitted = React.useRef<unknown>(undefined)

  React.useEffect(() => {
    if (Object.is(lastEmitted.current, value)) {
      lastEmitted.current = undefined
      return
    }
    setSource(formatRawJson(value))
    setParseError(null)
  }, [value])

  const invalid = parseError !== null || issues.length > 0

  return (
    <Field className={className} invalid={invalid}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <Textarea
        id={id}
        value={source}
        disabled={disabled}
        spellCheck={false}
        aria-invalid={invalid}
        className="min-h-48 font-mono text-xs"
        onChange={(event) => {
          const nextSource = event.currentTarget.value
          setSource(nextSource)
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
      {parseError ? <FieldError match>{parseError}</FieldError> : null}
      {issues.map((issue) => (
        <FieldError match key={issue}>
          {issue}
        </FieldError>
      ))}
    </Field>
  )
}
