import {
  applicationStatusValues,
  personalPriorityValues,
  targetStageValues,
} from '@cv/application-registry-entity'
import {
  FormCombobox,
  FormDateTimeInput,
  FormField,
  FormInput,
  FormItem,
  FormLabel,
  FormMessage,
  FormTextarea,
} from '@cv/internal-forms'
import { useFormContext } from 'react-hook-form'

import { formatLabel } from '../../../lib/format'
import type {
  ApplicationDetailEditFormInput,
  ApplicationDetailEditFormOutput,
} from './schema'

const optionsFrom = (values: readonly string[]) =>
  values.map((value) => ({ value, label: formatLabel(value) }))

export const ApplicationEditFields = ({
  pending,
}: {
  readonly pending: boolean
}) => {
  const form = useFormContext<
    ApplicationDetailEditFormInput,
    undefined,
    ApplicationDetailEditFormOutput
  >()
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
            <FormTextarea {...field} disabled={pending} className="min-h-20" />
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
      <FormField
        control={form.control}
        name="personalPriority"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Personal priority</FormLabel>
            <FormCombobox
              value={field.value}
              onValueChange={field.onChange}
              options={optionsFrom(personalPriorityValues)}
              ariaLabel="Personal priority"
              placeholder="No priority"
              clearable
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
        name="followUpAt"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Follow up</FormLabel>
            <FormDateTimeInput
              value={field.value ?? undefined}
              onChange={(value) => field.onChange(value ?? null)}
              inputAriaLabel="Follow-up date and time"
              disabled={pending}
              name={field.name}
              onBlur={field.onBlur}
              ref={field.ref}
            />
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
