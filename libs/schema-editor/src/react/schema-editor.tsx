import type { Schema } from 'effect'
import * as React from 'react'

import {
  inspectSchema,
  issuesByPointer,
  type ValidationResult,
  validateSchemaValue,
} from '../core'
import { NodeEditor } from './node-editor'

export interface SchemaEditorProps<
  S extends Schema.Top & Schema.ConstraintDecoder<unknown>,
> {
  readonly schema: S
  readonly value: unknown
  readonly onChange: (value: unknown) => void
  readonly disabled?: boolean
  readonly validate?: boolean
  readonly onValidationChange?: (result: ValidationResult) => void
  readonly className?: string
}

export const SchemaEditor = <
  S extends Schema.Top & Schema.ConstraintDecoder<unknown>,
>({
  schema,
  value,
  onChange,
  disabled,
  validate = true,
  onValidationChange,
  className,
}: SchemaEditorProps<S>) => {
  const inspection = React.useMemo(() => inspectSchema(schema), [schema])
  const validation = React.useMemo<ValidationResult>(
    () =>
      validate
        ? validateSchemaValue(schema, value)
        : { valid: true, value, issues: [] },
    [schema, validate, value]
  )
  const issueMap = React.useMemo(
    () => issuesByPointer(validation.issues),
    [validation.issues]
  )

  React.useEffect(() => {
    onValidationChange?.(validation)
  }, [onValidationChange, validation])

  return (
    <NodeEditor
      descriptor={inspection.descriptor}
      value={value}
      onChange={onChange}
      pointer=""
      issues={issueMap}
      disabled={disabled}
      className={className}
    />
  )
}
