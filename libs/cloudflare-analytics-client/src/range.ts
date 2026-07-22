import * as Effect from 'effect/Effect'

import { RangeValidationError } from './errors'
import type { DatasetLimits, Range } from './types'

export const makeRange = (
  input: {
    readonly days?: number
    readonly from?: string | null
    readonly host?: string | null
    readonly to?: string | null
  } = {},
  now = new Date()
): Range => {
  const to = input.to?.trim() || now.toISOString()
  const days = Number.isFinite(input.days) && input.days ? input.days : 30
  const from =
    input.from?.trim() ||
    new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
  const host = input.host?.trim()

  return {
    from,
    ...(host ? { host } : {}),
    to,
  }
}

const epochTimestampPattern = /^-?\d+$/u

const parseEpochTimestamp = (value: string) => {
  const timestamp = Number(value)

  if (!Number.isSafeInteger(timestamp)) {
    return undefined
  }

  const timestampMs =
    Math.abs(timestamp) < 1_000_000_000_000 ? timestamp * 1000 : timestamp

  return Number.isFinite(new Date(timestampMs).getTime())
    ? timestampMs
    : undefined
}

const parseTimestamp = (value: string) => {
  const trimmed = value.trim()
  const timestamp = epochTimestampPattern.test(trimmed)
    ? parseEpochTimestamp(trimmed)
    : Date.parse(trimmed)

  return Number.isFinite(timestamp) ? timestamp : undefined
}

interface ResolvedRange {
  readonly chunks: readonly Range[]
  readonly effectiveRange: Range
}

export const resolveRange = (
  range: Range,
  limits: DatasetLimits,
  options: {
    readonly now?: Date
  } = {}
) =>
  Effect.suspend((): Effect.Effect<ResolvedRange, RangeValidationError> => {
    const nowTimestamp = options.now?.getTime() ?? Date.now()
    const fromTimestamp = parseTimestamp(range.from)
    const toTimestamp = parseTimestamp(range.to)

    if (fromTimestamp === undefined || toTimestamp === undefined) {
      return Effect.fail(
        new RangeValidationError({
          from: range.from,
          message: 'Cloudflare analytics range must use valid date values.',
          to: range.to,
        })
      )
    }

    if (toTimestamp <= fromTimestamp) {
      return Effect.fail(
        new RangeValidationError({
          from: range.from,
          message: 'Cloudflare analytics range end must be after its start.',
          to: range.to,
        })
      )
    }

    const oldestAvailableTimestamp = nowTimestamp - limits.retentionMs
    if (fromTimestamp < oldestAvailableTimestamp) {
      return Effect.fail(
        new RangeValidationError({
          from: range.from,
          message: `Cloudflare analytics are available from ${new Date(oldestAvailableTimestamp).toISOString()}.`,
          to: range.to,
        })
      )
    }

    if (toTimestamp > nowTimestamp) {
      return Effect.fail(
        new RangeValidationError({
          from: range.from,
          message: 'Cloudflare analytics ranges cannot include future time.',
          to: range.to,
        })
      )
    }

    const chunks: Range[] = []
    let cursor = fromTimestamp

    while (cursor < toTimestamp) {
      const next = Math.min(cursor + limits.maxDurationMs, toTimestamp)

      chunks.push({
        from: new Date(cursor).toISOString(),
        ...(range.host ? { host: range.host } : {}),
        to: new Date(next).toISOString(),
      })

      cursor = next
    }

    return Effect.succeed({
      chunks,
      effectiveRange: {
        from: new Date(fromTimestamp).toISOString(),
        ...(range.host ? { host: range.host } : {}),
        to: new Date(toTimestamp).toISOString(),
      },
    })
  })

export const chunkRange = (
  range: Range,
  limits: DatasetLimits,
  options: Parameters<typeof resolveRange>[2] = {}
) =>
  resolveRange(range, limits, options).pipe(Effect.map(({ chunks }) => chunks))
