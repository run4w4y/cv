import type {
  ApplicationCompensation,
  CurrencyCode,
  FxRate,
} from '@cv/application-registry-entity'
import { convertMinorAmount } from '@cv/application-registry-fx'
import { Effect } from 'effect'

import { RegistryBadRequestError } from '../errors'
import type { ApplicationCompensationResultItem } from '../types'

export const convertCompensation = (
  original: ApplicationCompensation,
  quoteCurrency: CurrencyCode,
  rate: FxRate
): Effect.Effect<ApplicationCompensationResultItem, RegistryBadRequestError> =>
  Effect.all({
    maximumMinor: convertMinorAmount(
      original.maximumMinor,
      original.currencyCode,
      quoteCurrency,
      rate.rate
    ),
    minimumMinor: convertMinorAmount(
      original.minimumMinor,
      original.currencyCode,
      quoteCurrency,
      rate.rate
    ),
  }).pipe(
    Effect.mapError(
      (cause) => new RegistryBadRequestError({ message: cause.message })
    ),
    Effect.map(({ maximumMinor, minimumMinor }) => ({
      conversion: {
        currencyCode: quoteCurrency,
        maximumMinor,
        minimumMinor,
        observedAt: rate.observedAt,
        provider: rate.provider,
        rate: rate.rate,
      },
      original,
    }))
  )

export const convertCompensationForDisplay = (
  original: ApplicationCompensation,
  quoteCurrency: CurrencyCode,
  rate: FxRate
): Effect.Effect<ApplicationCompensation, RegistryBadRequestError> =>
  convertCompensation(original, quoteCurrency, rate).pipe(
    Effect.map(({ conversion }) => ({
      ...original,
      currencyCode: quoteCurrency,
      maximumMinor: conversion?.maximumMinor ?? original.maximumMinor,
      minimumMinor: conversion?.minimumMinor ?? original.minimumMinor,
    }))
  )
