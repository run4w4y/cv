import {
  applicationStatusValues,
  targetStageValues,
} from '@cv/application-registry-entity'
import {
  FormCombobox,
  FormDescription,
  FormField,
  FormInput,
  FormItem,
  FormLabel,
  FormMessage,
} from '@cv/internal-forms'
import { useFormContext } from 'react-hook-form'

import { formatLabel } from '../../../lib/format'
import { currencyInputStep } from '../../model/currency'
import { CurrencyCombobox } from '../currency-combobox'
import type {
  NewApplicationFormInput,
  NewApplicationFormOutput,
} from './schema'

const optionsFrom = (values: readonly string[]) =>
  values.map((value) => ({ value, label: formatLabel(value) }))

export const NewApplicationFields = ({
  pending,
}: {
  readonly pending: boolean
}) => {
  const form = useFormContext<
    NewApplicationFormInput,
    undefined,
    NewApplicationFormOutput
  >()
  const currencyCode = form.watch('currencyCode')
  return (
    <div className="grid max-h-[65vh] gap-4 overflow-y-auto px-0.5 py-1 sm:grid-cols-2">
      <FormField
        control={form.control}
        name="company"
        render={({ field }) => (
          <FormItem>
            <FormLabel required>Company</FormLabel>
            <FormInput {...field} disabled={pending} />
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="role"
        render={({ field }) => (
          <FormItem>
            <FormLabel required>Role</FormLabel>
            <FormInput {...field} disabled={pending} />
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="canonicalUrl"
        render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel required>Canonical URL</FormLabel>
            <FormInput {...field} type="url" disabled={pending} />
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="jobKey"
        render={({ field }) => (
          <FormItem>
            <FormLabel required>Job key</FormLabel>
            <FormInput {...field} disabled={pending} />
            <FormDescription>
              Stable unique identifier, for example greenhouse:12345.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="location"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Location</FormLabel>
            <FormInput {...field} disabled={pending} />
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="source"
        render={({ field }) => (
          <FormItem>
            <FormLabel required>Source</FormLabel>
            <FormInput {...field} disabled={pending} />
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="sourceJobId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Source job ID</FormLabel>
            <FormInput {...field} disabled={pending} />
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="applicationStatus"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Status</FormLabel>
            <FormCombobox
              value={field.value}
              onValueChange={(value) => {
                if (value !== null) field.onChange(value)
              }}
              options={optionsFrom(applicationStatusValues)}
              ariaLabel="Application status"
              disabled={pending}
              name={field.name}
              onBlur={field.onBlur}
              triggerRef={field.ref}
            />
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="targetStage"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Target stage</FormLabel>
            <FormCombobox
              value={field.value}
              onValueChange={(value) => {
                if (value !== null) field.onChange(value)
              }}
              options={optionsFrom(targetStageValues)}
              ariaLabel="Target stage"
              disabled={pending}
              name={field.name}
              onBlur={field.onBlur}
              triggerRef={field.ref}
            />
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="rounded-md border border-border bg-muted/35 p-4 sm:col-span-2">
        <div className="mb-3">
          <p className="text-sm font-semibold">Annual compensation</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Original values only; no currency conversion is applied.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[8rem_1fr_1fr]">
          <FormField
            control={form.control}
            name="currencyCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <CurrencyCombobox
                  value={field.value}
                  ariaLabel="Annual compensation currency"
                  disabled={pending}
                  onValueChange={field.onChange}
                />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="annualFrom"
            render={({ field }) => (
              <FormItem>
                <FormLabel>From</FormLabel>
                <FormInput
                  {...field}
                  type="number"
                  min={0}
                  step={currencyInputStep(currencyCode)}
                  disabled={pending}
                />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="annualTo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>To</FormLabel>
                <FormInput
                  {...field}
                  type="number"
                  min={0}
                  step={currencyInputStep(currencyCode)}
                  disabled={pending}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
    </div>
  )
}
