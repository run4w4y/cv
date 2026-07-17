import {
  applicationStatusValues,
  personalPriorityValues,
  targetStageValues,
} from '@cv/application-registry-entity'
import { useFormControlProps } from '@cv/internal-forms'
import { useFormContext } from 'react-hook-form'

import type {
  ApplicationRowEditFormInput,
  ApplicationRowEditFormOutput,
} from '../../application-editor/schema'
import {
  CurrencyCombobox,
  type CurrencyComboboxProps,
} from '../../currency-combobox'
import { formatLabel } from '../../../../lib/format'

const optionsFrom = (values: readonly string[]) =>
  values.map((value) => ({ label: formatLabel(value), value }))

export const statusOptions = optionsFrom(applicationStatusValues)
export const targetOptions = optionsFrom(targetStageValues)
export const priorityOptions = [
  { label: 'No priority', value: '' },
  ...optionsFrom(personalPriorityValues),
]

export const useRowForm = () =>
  useFormContext<
    ApplicationRowEditFormInput,
    undefined,
    ApplicationRowEditFormOutput
  >()

export const FormCurrencyCombobox = (props: CurrencyComboboxProps) => {
  const control = useFormControlProps()

  return (
    <CurrencyCombobox
      {...props}
      id={control.id}
      ariaDescribedBy={control['aria-describedby']}
      invalid={control['aria-invalid']}
    />
  )
}
