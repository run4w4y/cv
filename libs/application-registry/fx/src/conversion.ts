import { Data, Effect } from 'effect'

export class CurrencyConversionError extends Data.TaggedError(
  'CurrencyConversionError'
)<{
  readonly message: string
}> {}

const fractionDigits = (currencyCode: string) =>
  Effect.try({
    try: () => {
      const digits = new Intl.NumberFormat('en', {
        currency: currencyCode,
        style: 'currency',
      }).resolvedOptions().maximumFractionDigits

      if (digits === undefined) {
        throw new Error(`Currency metadata is unavailable for ${currencyCode}.`)
      }

      return digits
    },
    catch: () =>
      new CurrencyConversionError({
        message: `Unsupported currency code ${currencyCode}.`,
      }),
  })

export const convertMinorAmount = (
  amount: number | null,
  sourceCurrency: string,
  targetCurrency: string,
  rate: number
) =>
  Effect.gen(function* () {
    if (amount === null) return null

    if (!Number.isSafeInteger(amount) || amount < 0) {
      return yield* new CurrencyConversionError({
        message: 'Compensation amounts must be non-negative safe integers.',
      })
    }
    if (!Number.isFinite(rate) || rate <= 0) {
      return yield* new CurrencyConversionError({
        message: 'Currency conversion rates must be positive finite numbers.',
      })
    }

    const sourceDigits = yield* fractionDigits(sourceCurrency)
    const targetDigits = yield* fractionDigits(targetCurrency)
    const converted = Math.round(
      (amount * rate * 10 ** targetDigits) / 10 ** sourceDigits
    )

    if (!Number.isSafeInteger(converted)) {
      return yield* new CurrencyConversionError({
        message: 'The converted compensation amount exceeds numeric limits.',
      })
    }

    return converted
  })
