import {
  Button,
  Checkbox,
  cn,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  Select,
  Textarea,
} from '@cv/internal-ui'
import type { Schema } from 'effect'
import * as React from 'react'

import {
  appendJsonPointer,
  createInitialValue,
  type EditorDescriptor,
  inspectSchema,
  issuesByPointer,
  type ValidationIssue,
  type ValidationResult,
  validateSchemaValue,
} from '../core'
import { RawJsonEditor } from './raw-json-editor'

type NodeEditorProps = {
  readonly descriptor: EditorDescriptor
  readonly value: unknown
  readonly onChange: (value: unknown) => void
  readonly pointer: string
  readonly issues: ReadonlyMap<string, ReadonlyArray<ValidationIssue>>
  readonly label?: string
  readonly disabled?: boolean
  readonly className?: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const issueMessages = (
  issues: ReadonlyMap<string, ReadonlyArray<ValidationIssue>>,
  pointer: string
): ReadonlyArray<string> =>
  (issues.get(pointer) ?? []).map((issue) => issue.message)

const matchesDescriptor = (
  descriptor: EditorDescriptor,
  value: unknown
): boolean => {
  switch (descriptor.kind) {
    case 'string':
      return typeof value === 'string'
    case 'number':
      return typeof value === 'number'
    case 'boolean':
      return typeof value === 'boolean'
    case 'literal':
      return Object.is(value, descriptor.value)
    case 'choice':
      return descriptor.values.some((candidate) => Object.is(candidate, value))
    case 'nullable':
      return value === null || matchesDescriptor(descriptor.value, value)
    case 'array':
      return Array.isArray(value)
    case 'object':
      return (
        isRecord(value) &&
        descriptor.fields
          .filter((field) => field.descriptor.kind === 'literal')
          .every((field) =>
            matchesDescriptor(field.descriptor, value[field.key])
          )
      )
    case 'union':
      return descriptor.options.some((option) =>
        matchesDescriptor(option.descriptor, value)
      )
    case 'raw':
      return true
  }
}

const FieldMessages = ({
  messages,
}: {
  readonly messages: ReadonlyArray<string>
}) => (
  <>
    {messages.map((message) => (
      <FieldError match key={message}>
        {message}
      </FieldError>
    ))}
  </>
)

const GroupMessages = ({
  messages,
}: {
  readonly messages: ReadonlyArray<string>
}) => (
  <>
    {messages.map((message) => (
      <p className="text-xs font-medium text-destructive" key={message}>
        {message}
      </p>
    ))}
  </>
)

const NodeEditor = ({
  descriptor,
  value,
  onChange,
  pointer,
  issues,
  label,
  disabled,
  className,
}: NodeEditorProps) => {
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
              onChange(source === '' ? '' : Number(source))
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
          <Input id={id} readOnly value={String(descriptor.value)} />
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
              label: String(candidate),
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
    case 'nullable': {
      const isNull = value === null
      return (
        <fieldset
          className={cn(
            'grid gap-3 rounded-md border border-border p-3',
            className
          )}
        >
          {title ? (
            <legend className="px-1 text-sm font-medium">{title}</legend>
          ) : null}
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
          <div className="flex items-center gap-2">
            <Checkbox
              id={id}
              checked={isNull}
              disabled={disabled}
              onCheckedChange={(checked) =>
                onChange(
                  checked === true ? null : createInitialValue(descriptor.value)
                )
              }
            />
            <label className="text-sm font-medium text-foreground" htmlFor={id}>
              Set to null
            </label>
          </div>
          {isNull ? (
            <GroupMessages messages={messages} />
          ) : (
            <NodeEditor
              descriptor={descriptor.value}
              value={value}
              onChange={onChange}
              pointer={pointer}
              issues={issues}
              label={title ? `${title} value` : 'Value'}
              disabled={disabled}
            />
          )}
        </fieldset>
      )
    }
    case 'array': {
      const items = Array.isArray(value) ? value : []
      return (
        <fieldset
          className={cn(
            'grid gap-3 rounded-md border border-border p-3',
            className
          )}
        >
          {title ? (
            <legend className="px-1 text-sm font-medium">{title}</legend>
          ) : null}
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
          {items.map((item, index) => (
            <div
              className="grid gap-2 rounded-md border border-border/70 p-3"
              // Schema-defined arrays do not guarantee an item identity or key field.
              // biome-ignore lint/suspicious/noArrayIndexKey: the editor supports positional arrays and resets controlled children when a position changes.
              key={`${pointer}-${index}`}
            >
              <NodeEditor
                descriptor={descriptor.item}
                value={item}
                onChange={(next) =>
                  onChange(
                    items.map((current, currentIndex) =>
                      currentIndex === index ? next : current
                    )
                  )
                }
                pointer={appendJsonPointer(pointer, index)}
                issues={issues}
                label={`Item ${index + 1}`}
                disabled={disabled}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled}
                onClick={() =>
                  onChange(
                    items.filter((_, currentIndex) => currentIndex !== index)
                  )
                }
              >
                Remove item {index + 1}
              </Button>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() =>
              onChange([...items, createInitialValue(descriptor.item)])
            }
          >
            Add item
          </Button>
          <GroupMessages messages={messages} />
        </fieldset>
      )
    }
    case 'object': {
      const current = isRecord(value) ? value : {}
      return (
        <fieldset
          className={cn(
            'grid gap-4 rounded-md border border-border p-4',
            className
          )}
        >
          {title ? (
            <legend className="px-1 text-sm font-semibold">{title}</legend>
          ) : null}
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
          {descriptor.fields.map((field) => {
            const present = Object.hasOwn(current, field.key)
            if (field.optional && !present) {
              return (
                <div
                  className="flex items-center justify-between gap-3 rounded-md border border-dashed border-border p-3"
                  key={field.pointer}
                >
                  <span className="text-sm font-medium">
                    {field.descriptor.title ?? field.key}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={disabled}
                    onClick={() =>
                      onChange({
                        ...current,
                        [field.key]: createInitialValue(field.descriptor),
                      })
                    }
                  >
                    Add {field.descriptor.title ?? field.key}
                  </Button>
                </div>
              )
            }

            return (
              <div className="grid gap-2" key={field.pointer}>
                <NodeEditor
                  descriptor={field.descriptor}
                  value={current[field.key]}
                  onChange={(next) =>
                    onChange({ ...current, [field.key]: next })
                  }
                  pointer={field.pointer}
                  issues={issues}
                  label={field.descriptor.title ?? field.key}
                  disabled={disabled}
                />
                {field.optional ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={disabled}
                    onClick={() =>
                      onChange(
                        Object.fromEntries(
                          Object.entries(current).filter(
                            ([key]) => key !== field.key
                          )
                        )
                      )
                    }
                  >
                    Remove {field.descriptor.title ?? field.key}
                  </Button>
                ) : null}
              </div>
            )
          })}
          <GroupMessages messages={messages} />
        </fieldset>
      )
    }
    case 'union': {
      const selectedIndex = Math.max(
        0,
        descriptor.options.findIndex((option) =>
          matchesDescriptor(option.descriptor, value)
        )
      )
      const selected = descriptor.options[selectedIndex]
      return (
        <fieldset
          className={cn(
            'grid gap-3 rounded-md border border-border p-3',
            className
          )}
        >
          {title ? (
            <legend className="px-1 text-sm font-medium">{title}</legend>
          ) : null}
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
          <Select
            value={selected ? String(selectedIndex) : null}
            disabled={disabled}
            ariaLabel={title ? `${title} variant` : 'Select a variant'}
            options={descriptor.options.map((option, index) => ({
              value: String(index),
              label: option.label,
            }))}
            onValueChange={(next) => {
              if (next === null) return
              const option = descriptor.options[Number(next)]
              if (option) onChange(createInitialValue(option.descriptor))
            }}
          />
          {selected ? (
            <NodeEditor
              descriptor={selected.descriptor}
              value={value}
              onChange={onChange}
              pointer={pointer}
              issues={issues}
              disabled={disabled}
            />
          ) : null}
          <GroupMessages messages={messages} />
        </fieldset>
      )
    }
    case 'raw':
      return (
        <RawJsonEditor
          className={className}
          value={value}
          onChange={onChange}
          label={title ?? 'Raw JSON'}
          description={description ?? descriptor.reason}
          disabled={disabled}
          issues={messages}
        />
      )
  }
}

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
