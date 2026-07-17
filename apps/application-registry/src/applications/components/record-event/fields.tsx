import {
  appendableApplicationEventKindValues,
  applicationStatusValues,
} from '@cv/application-registry-entity'
import {
  FormCombobox,
  FormDateTimeInput,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormTextarea,
} from '@cv/internal-forms'
import { useFormContext } from 'react-hook-form'

import { formatLabel } from '../../../lib/format'
import { isStatusChangingEventKind, type RecordEventValues } from './schema'

const optionsFrom = (values: readonly string[]) =>
  values.map((value) => ({ value, label: formatLabel(value) }))

export const RecordEventFields = ({
  blocked,
}: {
  readonly blocked: boolean
}) => {
  const form = useFormContext<RecordEventValues>()
  const kind = form.watch('kind')
  return (
    <div className="grid gap-4 py-1 sm:grid-cols-2">
      <FormField
        control={form.control}
        name="kind"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Event kind</FormLabel>
            <FormCombobox
              value={field.value}
              onValueChange={(value) => {
                if (value !== null) field.onChange(value)
              }}
              options={optionsFrom(appendableApplicationEventKindValues)}
              ariaLabel="Event kind"
              disabled={blocked}
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
        name="occurredAt"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Occurred at</FormLabel>
            <FormDateTimeInput
              value={field.value}
              onChange={(value) => {
                if (value !== undefined) field.onChange(value)
              }}
              inputAriaLabel="Event date and time"
              disabled={blocked}
              name={field.name}
              onBlur={field.onBlur}
              ref={field.ref}
            />
            <FormMessage />
          </FormItem>
        )}
      />
      {isStatusChangingEventKind(kind) ? (
        <FormField
          control={form.control}
          name="nextApplicationStatus"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>New application status</FormLabel>
              <FormCombobox
                value={field.value}
                onValueChange={(value) => {
                  if (value !== null) field.onChange(value)
                }}
                options={optionsFrom(applicationStatusValues)}
                ariaLabel="New application status"
                disabled={blocked}
                name={field.name}
                onBlur={field.onBlur}
                triggerRef={field.ref}
              />
              <FormMessage />
            </FormItem>
          )}
        />
      ) : null}
      <FormField
        control={form.control}
        name="payload"
        render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel>Payload (JSON)</FormLabel>
            <FormTextarea
              {...field}
              rows={5}
              placeholder={'{"channel":"email","summary":"Followed up"}'}
              disabled={blocked}
            />
            <FormDescription>
              Optional structured context. Leave empty to store an empty object.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
