import * as React from 'react'
import {
  type FieldPath,
  type FieldValues,
  useFormContext,
  useFormState,
} from 'react-hook-form'

type FormFieldContextValue = {
  readonly name: FieldPath<FieldValues>
}

type FormItemContextValue = {
  readonly id: string
}

export const FormFieldContext =
  React.createContext<FormFieldContextValue | null>(null)

export const FormItemContext = React.createContext<FormItemContextValue | null>(
  null
)

export const useFormField = () => {
  const field = React.useContext(FormFieldContext)
  const item = React.useContext(FormItemContext)
  const { control, getFieldState } = useFormContext()

  if (field === null) {
    throw new Error('useFormField must be used within FormField.')
  }
  if (item === null) {
    throw new Error('useFormField must be used within FormItem.')
  }

  const formState = useFormState({ control, name: field.name })
  const state = getFieldState(field.name, formState)
  return {
    ...state,
    name: field.name,
    formItemId: `${item.id}-control`,
    formLabelId: `${item.id}-label`,
    formDescriptionId: `${item.id}-description`,
    formMessageId: `${item.id}-message`,
  }
}
