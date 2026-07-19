import {
  Checkbox,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  Select,
  Textarea,
} from '@cv/internal-ui'
import * as React from 'react'

import type { EditorDescriptor, JsonPrimitive } from '../core'
import type { NodeEditorProps } from './editor-types'
import { FieldMessages, issueMessages } from './validation-messages'

type PrimitiveDescriptor = Extract<
  EditorDescriptor,
  {
    readonly kind: 'string' | 'number' | 'boolean' | 'literal' | 'choice'
  }
>

type PrimitiveEditorProps = Omit<NodeEditorProps, 'descriptor'> & {
  readonly descriptor: PrimitiveDescriptor
}

const choiceLabel = (value: JsonPrimitive): string =>
  typeof value === 'string' ? JSON.stringify(value) : String(value)

export const PrimitiveEditor = ({
  descriptor,
  value,
  onChange,
  pointer,
  issues,
  label,
  disabled,
  className,
}: PrimitiveEditorProps) => {
  const id = React.useId()
  const messages = issueMessages(issues, pointer)
  const invalid = messages.length > 0
  const title = label ?? descriptor.title
  const description = descriptor.description ?? descriptor.documentation

  switch (descriptor.kind) {
    case 'string':
      return (
        <Field className={className} invalid={invalid}>
          {title ? <FieldLabel htmlFor={id}>{title}</FieldLabel> : null}
          {description ? (
            <FieldDescription>{description}</FieldDescription>
          ) : null}
          <Textarea
            id={id}
            value={typeof value === 'string' ? value : ''}
            disabled={disabled}
            aria-invalid={invalid}
            onChange={(event) => onChange(event.currentTarget.value)}
          />
          <FieldMessages messages={messages} />
        </Field>
      )
    case 'number':
      return (
        <Field className={className} invalid={invalid}>
          {title ? <FieldLabel htmlFor={id}>{title}</FieldLabel> : null}
          {description ? (
            <FieldDescription>{description}</FieldDescription>
          ) : null}
          <Input
            id={id}
            type="number"
            value={
              typeof value === 'number' || typeof value === 'string'
                ? String(value)
                : ''
            }
            disabled={disabled}
            aria-invalid={invalid}
            onChange={(event) => {
              const source = event.currentTarget.value
              const parsed = Number(source)
              onChange(
                source === '' || !Number.isFinite(parsed) ? source : parsed
              )
            }}
          />
          <FieldMessages messages={messages} />
        </Field>
      )
    case 'boolean':
      return (
        <Field className={className} invalid={invalid}>
          <div className="flex items-center gap-2">
            <Checkbox
              id={id}
              checked={value === true}
              disabled={disabled}
              aria-invalid={invalid}
              onCheckedChange={(checked) => onChange(checked === true)}
            />
            {title ? <FieldLabel htmlFor={id}>{title}</FieldLabel> : null}
          </div>
          {description ? (
            <FieldDescription>{description}</FieldDescription>
          ) : null}
          <FieldMessages messages={messages} />
        </Field>
      )
    case 'literal':
      return (
        <Field className={className} invalid={invalid}>
          {title ? <FieldLabel htmlFor={id}>{title}</FieldLabel> : null}
          <Input
            id={id}
            disabled={disabled}
            readOnly
            value={String(descriptor.value)}
          />
          <FieldMessages messages={messages} />
        </Field>
      )
    case 'choice': {
      const selected = descriptor.values.findIndex((candidate) =>
        Object.is(candidate, value)
      )
      return (
        <Field className={className} invalid={invalid}>
          {title ? <FieldLabel id={`${id}-label`}>{title}</FieldLabel> : null}
          {description ? (
            <FieldDescription>{description}</FieldDescription>
          ) : null}
          <Select
            value={selected >= 0 ? String(selected) : null}
            disabled={disabled}
            invalid={invalid}
            ariaLabel={title ?? 'Select a value'}
            options={descriptor.values.map((candidate, index) => ({
              value: String(index),
              label: choiceLabel(candidate),
            }))}
            onValueChange={(next) => {
              if (next === null) return
              const candidate = descriptor.values[Number(next)]
              if (candidate !== undefined) onChange(candidate)
            }}
          />
          <FieldMessages messages={messages} />
        </Field>
      )
    }
  }
}
