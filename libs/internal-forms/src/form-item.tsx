import {
  Combobox,
  type ComboboxProps,
  cn,
  DateTimeInput,
  type DateTimeInputProps,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  Select,
  type SelectProps,
  Textarea,
} from '@cv/internal-ui'
import * as React from 'react'

import { FormItemContext, useFormField } from './form-context'

export const FormItem = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => {
  const id = React.useId()
  return (
    <FormItemContext.Provider value={{ id }}>
      <Field className={className} {...props} />
    </FormItemContext.Provider>
  )
}

export const FormLabel = ({
  className,
  required,
  children,
  htmlFor,
  onClick,
  ...props
}: React.ComponentProps<typeof FieldLabel> & {
  readonly required?: boolean
}) => {
  const { error, formItemId, formLabelId } = useFormField()
  return (
    <FieldLabel
      id={formLabelId}
      htmlFor={htmlFor}
      data-error={error === undefined ? undefined : 'true'}
      className={cn('data-[error=true]:text-destructive', className)}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented || htmlFor !== undefined) return

        const control = document.getElementById(formItemId)
        if (control instanceof HTMLElement) control.focus()
      }}
      {...props}
    >
      {children}
      {required ? (
        <span aria-hidden="true" className="ml-1 text-destructive">
          *
        </span>
      ) : null}
    </FieldLabel>
  )
}

export const FormDescription = (
  props: React.ComponentProps<typeof FieldDescription>
) => {
  const { formDescriptionId } = useFormField()
  return <FieldDescription id={formDescriptionId} {...props} />
}

export const FormMessage = ({
  className,
  children,
  ...props
}: React.ComponentProps<'p'>) => {
  const { error, formMessageId } = useFormField()
  const body = children ?? error?.message
  if (body === undefined) return null
  return (
    <p
      id={formMessageId}
      data-slot="form-message"
      className={cn('text-xs font-medium text-destructive', className)}
      {...props}
    >
      {typeof body === 'string' ? body : String(body)}
    </p>
  )
}

export const useFormControlProps = () => {
  const { error, formDescriptionId, formItemId, formLabelId, formMessageId } =
    useFormField()
  return {
    id: formItemId,
    'aria-invalid': error !== undefined,
    'aria-labelledby': formLabelId,
    'aria-describedby':
      error === undefined
        ? formDescriptionId
        : `${formDescriptionId} ${formMessageId}`,
  } as const
}

export const FormInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<'input'>
>((props, ref) => <Input {...useFormControlProps()} {...props} ref={ref} />)
FormInput.displayName = 'FormInput'

export const FormTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<'textarea'>
>((props, ref) => <Textarea {...useFormControlProps()} {...props} ref={ref} />)
FormTextarea.displayName = 'FormTextarea'

export const FormSelect = (props: SelectProps) => {
  const control = useFormControlProps()
  return (
    <Select
      {...props}
      id={control.id}
      ariaLabelledBy={control['aria-labelledby']}
      ariaDescribedBy={control['aria-describedby']}
      invalid={control['aria-invalid']}
    />
  )
}

export const FormCombobox = (props: ComboboxProps) => {
  const control = useFormControlProps()
  return (
    <Combobox
      {...props}
      id={control.id}
      ariaLabelledBy={control['aria-labelledby']}
      ariaDescribedBy={control['aria-describedby']}
      invalid={control['aria-invalid']}
    />
  )
}

export const FormDateTimeInput = React.forwardRef<
  HTMLDivElement,
  DateTimeInputProps
>((props, ref) => (
  <DateTimeInput {...useFormControlProps()} {...props} ref={ref} />
))
FormDateTimeInput.displayName = 'FormDateTimeInput'
