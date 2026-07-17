import { Combobox } from '@cv/internal-ui'
import type * as React from 'react'

import {
  type CompensationDisplayCurrency,
  isCurrencyCode,
  normalizedCurrencyCode,
} from '../../model/currency'

const commonCurrencyCodes = [
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'RUB',
  'CHF',
  'CAD',
  'AUD',
  'CNY',
  'KRW',
  'SGD',
  'INR',
] as const

const supportedCurrencyCodes = (): readonly string[] => {
  try {
    return Intl.supportedValuesOf('currency')
  } catch {
    return commonCurrencyCodes
  }
}

const currencyName = (currencyCode: string) => {
  try {
    return (
      new Intl.DisplayNames(undefined, { type: 'currency' }).of(currencyCode) ??
      currencyCode
    )
  } catch {
    return currencyCode
  }
}

const commonCurrencyCodeSet = new Set<string>(commonCurrencyCodes)
const orderedCurrencyCodes = [
  ...commonCurrencyCodes,
  ...supportedCurrencyCodes()
    .filter((code) => !commonCurrencyCodeSet.has(code))
    .sort((left, right) => left.localeCompare(right)),
]

const currencyOptions = orderedCurrencyCodes.map((currencyCode) => ({
  value: currencyCode,
  label: `${currencyCode} — ${currencyName(currencyCode)}`,
  keywords: [currencyName(currencyCode)],
}))

export type CurrencyComboboxProps = {
  readonly id?: string
  readonly value: CompensationDisplayCurrency
  readonly onValueChange: (value: CompensationDisplayCurrency) => void
  readonly includeOriginal?: boolean
  readonly disabled?: boolean
  readonly ariaLabel?: string
  readonly ariaDescribedBy?: string
  readonly invalid?: boolean
  readonly name?: string
  readonly form?: string
  readonly onBlur?: React.FocusEventHandler<HTMLButtonElement>
  readonly triggerRef?: React.Ref<HTMLButtonElement>
  readonly className?: string
}

export const CurrencyCombobox = ({
  id,
  value,
  onValueChange,
  includeOriginal = false,
  disabled,
  ariaLabel = 'Currency',
  ariaDescribedBy,
  invalid,
  name,
  form,
  onBlur,
  triggerRef,
  className,
}: CurrencyComboboxProps) => {
  const normalizedValue =
    value === 'original' ? value : normalizedCurrencyCode(value)
  const withCurrent =
    normalizedValue === 'original' ||
    currencyOptions.some((option) => option.value === normalizedValue) ||
    !isCurrencyCode(normalizedValue)
      ? currencyOptions
      : [
          {
            value: normalizedValue,
            label: `${normalizedValue} — ${currencyName(normalizedValue)}`,
            keywords: [currencyName(normalizedValue)],
          },
          ...currencyOptions,
        ]
  const options = includeOriginal
    ? [
        {
          value: 'original',
          label: 'Original currencies',
          description: 'Show every compensation in its stored currency.',
        },
        ...withCurrent,
      ]
    : withCurrent

  return (
    <Combobox
      id={id}
      value={normalizedValue}
      options={options}
      disabled={disabled}
      ariaLabel={ariaLabel}
      ariaDescribedBy={ariaDescribedBy}
      invalid={invalid}
      name={name}
      form={form}
      onBlur={onBlur}
      triggerRef={triggerRef}
      className={className}
      placeholder="Select currency…"
      searchPlaceholder="Search currencies…"
      emptyLabel="No currency found."
      onValueChange={(nextValue) => {
        if (nextValue !== null) onValueChange(nextValue)
      }}
    />
  )
}
