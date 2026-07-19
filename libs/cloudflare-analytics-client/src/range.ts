import * as Effect from 'effect/Effect'

import { RangeValidationError } from './errors'
import type { Range } from './types'

export const chunkMs = 24 * 60 * 60 * 1000
export const maxChunks = 7
export const maxLookbackMs = maxChunks * chunkMs

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
  options: {
    readonly chunkMs?: number
    readonly maxLookbackMs?: number
    readonly maxChunks?: number
    readonly now?: Date
  } = {}
) =>
  Effect.suspend((): Effect.Effect<ResolvedRange, RangeValidationError> => {
    const effectiveChunkMs = options.chunkMs ?? chunkMs
    const effectiveMaxLookbackMs = options.maxLookbackMs ?? maxLookbackMs
    const effectiveMaxChunks = options.maxChunks ?? maxChunks
    const nowTimestamp = options.now?.getTime() ?? Date.now()
    const fromTimestamp = parseTimestamp(range.from)
    const toTimestamp = parseTimestamp(range.to)

    if (fromTimestamp === undefined || toTimestamp === undefined) {
      return Effect.fail(
        new RangeValidationError({
          from: range.from,
          maxDays: effectiveMaxChunks,
          message: 'Cloudflare analytics range must use valid date values.',
          to: range.to,
        })
      )
    }

    if (toTimestamp <= fromTimestamp) {
      return Effect.fail(
        new RangeValidationError({
          from: range.from,
          maxDays: effectiveMaxChunks,
          message: 'Cloudflare analytics range end must be after its start.',
          to: range.to,
        })
      )
    }

    const oldestAvailableTimestamp = nowTimestamp - effectiveMaxLookbackMs
    const effectiveFromTimestamp = Math.max(
      fromTimestamp,
      oldestAvailableTimestamp
    )
    const effectiveToTimestamp = Math.min(toTimestamp, nowTimestamp)

    if (effectiveToTimestamp <= effectiveFromTimestamp) {
      return Effect.succeed({
        chunks: [],
        effectiveRange: range,
      })
    }

    const chunkCount = Math.ceil(
      (effectiveToTimestamp - effectiveFromTimestamp) / effectiveChunkMs
    )

    if (chunkCount > effectiveMaxChunks) {
      return Effect.fail(
        new RangeValidationError({
          from: range.from,
          maxDays: effectiveMaxChunks,
          message: `Cloudflare analytics range is too wide; maximum supported range is ${effectiveMaxChunks} days.`,
          to: range.to,
        })
      )
    }

    const chunks: Range[] = []
    let cursor = effectiveFromTimestamp

    while (cursor < effectiveToTimestamp) {
      const next = Math.min(cursor + effectiveChunkMs, effectiveToTimestamp)

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
        from: chunks[0]?.from ?? range.from,
        ...(range.host ? { host: range.host } : {}),
        to: chunks.at(-1)?.to ?? range.to,
      },
    })
  })

export const chunkRange = (
  range: Range,
  options: Parameters<typeof resolveRange>[1] = {}
) => resolveRange(range, options).pipe(Effect.map(({ chunks }) => chunks))
