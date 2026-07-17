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

export const currencyFractionDigits = (currencyCode: string): number => {
  const normalized = normalizedCurrencyCode(currencyCode)
  if (!isCurrencyCode(normalized)) {
    throw new Error('Enter a three-letter currency code.')
  }

  const fractionDigits = new Intl.NumberFormat('en', {
    style: 'currency',
    currency: normalized,
  }).resolvedOptions().maximumFractionDigits

  if (fractionDigits === undefined) {
    throw new Error(`Currency metadata is unavailable for ${normalized}.`)
  }
  return fractionDigits
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
