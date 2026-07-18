import {
  FormField,
  FormInput,
  FormItem,
  FormLabel,
  FormMessage,
  FormSelect,
  FormTextarea,
} from '@cv/internal-forms'

import { useApplicationRowEditor } from '../row-editor'
import {
  priorityOptions,
  statusOptions,
  targetOptions,
  useRowForm,
} from './form'

export const CompanyEditor = () => {
  const { control } = useRowForm()
  const { formId, pending } = useApplicationRowEditor()

  return (
    <div className="grid min-w-56 gap-2">
      <FormField
        control={control}
        name="company"
        render={({ field }) => (
          <FormItem>
            <FormLabel required className="sr-only">
              Company
            </FormLabel>
            <FormInput
              {...field}
              autoFocus
              disabled={pending}
              form={formId}
              placeholder="Company"
            />
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="location"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="sr-only">Location</FormLabel>
            <FormInput
              {...field}
              disabled={pending}
              form={formId}
              placeholder="Location"
            />
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}

export const RoleEditor = () => {
  const { control } = useRowForm()
  const { formId, pending } = useApplicationRowEditor()

  return (
    <FormField
      control={control}
      name="role"
      render={({ field }) => (
        <FormItem className="min-w-64">
          <FormLabel required className="sr-only">
            Role
          </FormLabel>
          <FormTextarea
            {...field}
            disabled={pending}
            form={formId}
            className="min-h-20"
          />
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

const EnumEditor = ({
  name,
}: {
  readonly name: 'applicationStatus' | 'targetStage'
}) => {
  const { control } = useRowForm()
  const { formId, pending } = useApplicationRowEditor()
  const isStatus = name === 'applicationStatus'

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="sr-only">
            {isStatus ? 'Application status' : 'Target stage'}
          </FormLabel>
          <FormSelect
            value={field.value}
            options={isStatus ? statusOptions : targetOptions}
            disabled={pending}
            form={formId}
            ariaLabel={isStatus ? 'Application status' : 'Target stage'}
            name={field.name}
            onBlur={field.onBlur}
            triggerRef={field.ref}
            onValueChange={(value) => {
              if (value !== null) field.onChange(value)
            }}
          />
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export const StatusEditor = () => <EnumEditor name="applicationStatus" />
export const TargetEditor = () => <EnumEditor name="targetStage" />

export const PriorityEditor = () => {
  const { control } = useRowForm()
  const { formId, pending } = useApplicationRowEditor()

  return (
    <FormField
      control={control}
      name="personalPriority"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="sr-only">Personal priority</FormLabel>
          <FormSelect
            value={field.value ?? ''}
            options={priorityOptions}
            disabled={pending}
            form={formId}
            ariaLabel="Personal priority"
            name={field.name}
            onBlur={field.onBlur}
            triggerRef={field.ref}
            onValueChange={(value) =>
              field.onChange(value === '' ? null : value)
            }
          />
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
