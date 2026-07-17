import {
  Controller,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form'

import { FormFieldContext } from './form-context'

export const FormField = <
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
  TTransformedValues = TFieldValues,
>(
  props: ControllerProps<TFieldValues, TName, TTransformedValues>
) => (
  <FormFieldContext.Provider value={{ name: props.name }}>
    <Controller<TFieldValues, TName, TTransformedValues> {...props} />
  </FormFieldContext.Provider>
)
