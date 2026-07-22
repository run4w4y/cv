import { Button, Checkbox, cn, Select } from '@cv/internal-ui'
import { omit } from 'es-toolkit/object'
import { isPlainObject } from 'es-toolkit/predicate'
import * as React from 'react'

import {
  appendJsonPointer,
  createInitialValue,
  type EditorDescriptor,
} from '../core'
import { findMatchingUnionOption } from '../core/inspection/descriptor-match'
import type { NodeEditorProps } from './editor-types'
import {
  GroupMessages,
  issueMessages,
  issueMessagesWithin,
} from './validation-messages'

type CompositeDescriptor = Extract<
  EditorDescriptor,
  { readonly kind: 'nullable' | 'array' | 'object' | 'union' }
>

type CompositeEditorProps = Omit<NodeEditorProps, 'descriptor'> & {
  readonly descriptor: CompositeDescriptor
  readonly NodeEditor: React.ComponentType<NodeEditorProps>
}

export const CompositeEditor = ({
  descriptor,
  value,
  onChange,
  pointer,
  issues,
  label,
  disabled,
  className,
  NodeEditor,
}: CompositeEditorProps) => {
  const id = React.useId()
  const title = label ?? descriptor.title
  const description = descriptor.description ?? descriptor.documentation
  const messages = issueMessages(issues, pointer)

  switch (descriptor.kind) {
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
              // biome-ignore lint/suspicious/noArrayIndexKey: positional items intentionally reset when their position changes.
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
            disabled={disabled || descriptor.item.kind === 'unrepresentable'}
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
      const current: Record<string, unknown> = isPlainObject(value) ? value : {}
      const knownKeys = new Set(descriptor.fields.map((field) => field.key))
      const unknownKeys = Object.keys(current).filter(
        (key) => !knownKeys.has(key)
      )
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
              const unavailable = field.descriptor.kind === 'unrepresentable'
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
                    disabled={disabled || unavailable}
                    onClick={() =>
                      onChange({
                        ...current,
                        [field.key]: createInitialValue(field.descriptor),
                      })
                    }
                  >
                    {unavailable ? 'Not JSON-editable' : 'Add'}{' '}
                    {field.descriptor.title ?? field.key}
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
                    onClick={() => onChange(omit(current, [field.key]))}
                  >
                    Remove {field.descriptor.title ?? field.key}
                  </Button>
                ) : null}
              </div>
            )
          })}
          {unknownKeys.map((key) => {
            const unknownPointer = appendJsonPointer(pointer, key)
            const unknownMessages = issueMessagesWithin(issues, unknownPointer)
            return (
              <div
                className="grid gap-2 rounded-md border border-destructive/50 p-3"
                key={unknownPointer}
              >
                <p className="text-sm font-medium text-destructive">
                  Unexpected field <code>{key}</code>
                </p>
                <GroupMessages messages={unknownMessages} />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={disabled}
                  onClick={() => onChange(omit(current, [key]))}
                >
                  Remove unexpected field {key}
                </Button>
              </div>
            )
          })}
          <GroupMessages messages={messages} />
        </fieldset>
      )
    }
    case 'union': {
      const selectedIndex = findMatchingUnionOption(descriptor.options, value)
      const selected =
        selectedIndex >= 0 ? descriptor.options[selectedIndex] : undefined
      const visibleMessages = selected
        ? messages
        : issueMessagesWithin(issues, pointer)
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
          <GroupMessages messages={visibleMessages} />
        </fieldset>
      )
    }
  }
}
