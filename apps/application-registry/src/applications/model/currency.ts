import type { AnnualCompensation } from '@cv/application-registry-entity/query'

export const normalizedCurrencyCode = (currencyCode: string) =>
  currencyCode.trim().toUpperCase()

export const isCurrencyCode = (currencyCode: string) =>
  /^[A-Z]{3}$/u.test(normalizedCurrencyCode(currencyCode))

export type CompensationDisplayCurrency = 'original' | string

export const parseCompensationDisplayCurrency = (
  value: unknown
): CompensationDisplayCurrency | null => {
  if (value === 'original') return value
  if (typeof value !== 'string' || !isCurrencyCode(value)) return null
  return normalizedCurrencyCode(value)
}

const fractionDigitsByCurrency = new Map<string, number>()

export const currencyFractionDigits = (currencyCode: string): number => {
  const normalized = normalizedCurrencyCode(currencyCode)
  if (!isCurrencyCode(normalized)) {
    throw new Error('Enter a three-letter currency code.')
  }

  const cached = fractionDigitsByCurrency.get(normalized)
  if (cached !== undefined) return cached

  const fractionDigits = new Intl.NumberFormat('en', {
    style: 'currency',
    currency: normalized,
  }).resolvedOptions().maximumFractionDigits

  if (fractionDigits === undefined) {
    throw new Error(`Currency metadata is unavailable for ${normalized}.`)
  }
  fractionDigitsByCurrency.set(normalized, fractionDigits)
  return fractionDigits
}

export type CompensationFxRate = {
  readonly observedAt: string
  readonly provider: 'frankfurter'
  readonly rate: number
  readonly sourceCurrency: string
  readonly targetCurrency: string
}

export type CompensationFxRateTable = {
  readonly rates: ReadonlyMap<string, CompensationFxRate>
  readonly targetCurrency: string
}

export type DisplayedAnnualCompensation = {
  readonly observedAt?: string
  readonly status: 'converted' | 'original' | 'unavailable'
  readonly value: AnnualCompensation | null
}

export const convertMinorAmount = (
  amount: number | null,
  sourceCurrency: string,
  targetCurrency: string,
  rate: number
): number | null => {
  if (amount === null) return null
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error('Compensation amounts must be non-negative safe integers.')
  }
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(
      'Currency conversion rates must be positive finite numbers.'
    )
  }

  const sourceDigits = currencyFractionDigits(sourceCurrency)
  const targetDigits = currencyFractionDigits(targetCurrency)
  const converted = Math.round(
    (amount * rate * 10 ** targetDigits) / 10 ** sourceDigits
  )
  if (!Number.isSafeInteger(converted)) {
    throw new Error('The converted compensation amount exceeds numeric limits.')
  }
  return converted
}

export const displayAnnualCompensation = (
  value: AnnualCompensation | null,
  displayCurrency: CompensationDisplayCurrency,
  rateTable?: CompensationFxRateTable
): DisplayedAnnualCompensation => {
  if (value === null || displayCurrency === 'original') {
    return { status: 'original', value }
  }
  if (value.currencyCode === displayCurrency) {
    return { status: 'converted', value }
  }

  if (rateTable === undefined || rateTable.targetCurrency !== displayCurrency) {
    return { status: 'unavailable', value }
  }

  const rate = rateTable.rates.get(value.currencyCode)
  if (rate === undefined || rate.targetCurrency !== displayCurrency) {
    return { status: 'unavailable', value }
  }

  return {
    observedAt: rate.observedAt,
    status: 'converted',
    value: {
      currencyCode: displayCurrency,
      maximumMinor: convertMinorAmount(
        value.maximumMinor,
        value.currencyCode,
        displayCurrency,
        rate.rate
      ),
      minimumMinor: convertMinorAmount(
        value.minimumMinor,
        value.currencyCode,
        displayCurrency,
        rate.rate
      ),
    },
  }
}

export const majorAmountToMinor = (
  rawAmount: string,
  currencyCode: string
): number | null => {
  if (rawAmount.trim().length === 0) return null

  const amount = Number(rawAmount)
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('Compensation amounts must be non-negative numbers.')
  }

  const amountMinor = Math.round(
    amount * 10 ** currencyFractionDigits(currencyCode)
  )
  if (!Number.isSafeInteger(amountMinor)) {
    throw new Error('The compensation amount is too large.')
  }
  return amountMinor
}

export const minorAmountToMajor = (amountMinor: number, currencyCode: string) =>
  amountMinor / 10 ** currencyFractionDigits(currencyCode)

export const currencyInputStep = (currencyCode: string) => {
  try {
    const fractionDigits = currencyFractionDigits(currencyCode)
    return fractionDigits === 0 ? '1' : `0.${'0'.repeat(fractionDigits - 1)}1`
  } catch {
    return 'any'
  }
}
