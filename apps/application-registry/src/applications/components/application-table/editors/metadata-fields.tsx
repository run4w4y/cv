import {
  FormCombobox,
  FormDateTimeInput,
  FormField,
  FormInput,
  FormItem,
  FormLabel,
  FormMessage,
} from '@cv/internal-forms'
import { Button, Input } from '@cv/internal-ui'
import { Plus } from 'lucide-react'
import * as React from 'react'

import { currencyInputStep } from '../../../model/currency'
import { useApplicationRowEditor } from '../row-editor'
import { FormCurrencyCombobox, useRowForm } from './form'

export const LabelsEditor = ({
  availableLabels,
}: {
  readonly availableLabels: readonly string[]
}) => {
  const { control } = useRowForm()
  const { formId, pending } = useApplicationRowEditor()
  const [newLabel, setNewLabel] = React.useState('')

  return (
    <FormField
      control={control}
      name="labels"
      render={({ field }) => {
        const options = [...new Set([...availableLabels, ...field.value])]
          .sort((left, right) => left.localeCompare(right))
          .map((label) => ({ label, value: label }))
        const addLabel = () => {
          const label = newLabel.trim()
          if (label.length === 0) return
          field.onChange([...new Set([...field.value, label])])
          setNewLabel('')
        }

        return (
          <FormItem className="grid min-w-56 gap-1.5">
            <FormLabel className="sr-only">Application labels</FormLabel>
            <FormCombobox
              mode="multiple"
              value={field.value}
              onValueChange={field.onChange}
              options={options}
              disabled={pending}
              form={formId}
              ariaLabel="Application labels"
              name={field.name}
              onBlur={field.onBlur}
              triggerRef={field.ref}
              placeholder="No labels"
            />
            <div className="flex gap-1">
              <Input
                value={newLabel}
                disabled={pending}
                form={formId}
                aria-label="New application label"
                placeholder="Add label"
                className="h-8 min-w-0"
                onChange={(event) => setNewLabel(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addLabel()
                  }
                }}
              />
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                disabled={pending || newLabel.trim().length === 0}
                aria-label="Add label"
                onClick={addLabel}
              >
                <Plus />
              </Button>
            </div>
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}

export const CompensationEditor = () => {
  const { control, watch } = useRowForm()
  const { formId, pending } = useApplicationRowEditor()
  const currencyCode = watch('annualCompensation.currencyCode')

  return (
    <div className="grid min-w-72 grid-cols-[5.5rem_1fr_1fr] gap-1.5">
      <FormField
        control={control}
        name="annualCompensation.currencyCode"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="sr-only">
              Annual compensation currency
            </FormLabel>
            <FormCurrencyCombobox
              value={field.value}
              disabled={pending}
              form={formId}
              ariaLabel="Annual compensation currency"
              name={field.name}
              onBlur={field.onBlur}
              triggerRef={field.ref}
              onValueChange={field.onChange}
            />
            <FormMessage />
          </FormItem>
        )}
      />
      {(['from', 'to'] as const).map((bound) => (
        <FormField
          key={bound}
          control={control}
          name={`annualCompensation.${bound}`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="sr-only">
                Annual compensation {bound}
              </FormLabel>
              <FormInput
                {...field}
                type="number"
                min={0}
                step={currencyInputStep(currencyCode)}
                disabled={pending}
                form={formId}
                placeholder={bound === 'from' ? 'From' : 'To'}
              />
              <FormMessage />
            </FormItem>
          )}
        />
      ))}
    </div>
  )
}

export const FollowUpEditor = () => {
  const { control } = useRowForm()
  const { formId, pending } = useApplicationRowEditor()

  return (
    <FormField
      control={control}
      name="followUpAt"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="sr-only">Follow up</FormLabel>
          <FormDateTimeInput
            value={field.value ?? undefined}
            disabled={pending}
            form={formId}
            inputAriaLabel="Follow up date and time"
            name={field.name}
            onBlur={field.onBlur}
            ref={field.ref}
            onChange={(value) => field.onChange(value ?? null)}
          />
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
