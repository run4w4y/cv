import { Effect, Schema } from 'effect'

import { NormalizeError } from './errors'
import type { DatasetLimits } from './types'

const PositiveInteger = Schema.Int.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(1))
)

const LimitsPayloadSchema = Schema.Struct({
  data: Schema.Struct({
    viewer: Schema.Struct({
      zones: Schema.NonEmptyArray(
        Schema.Struct({
          settings: Schema.Struct({
            httpRequestsAdaptiveGroups: Schema.Struct({
              enabled: Schema.Literal(true),
              maxDuration: PositiveInteger,
              maxPageSize: PositiveInteger,
              notOlderThan: PositiveInteger,
            }),
          }),
        })
      ),
    }),
  }),
})

const secondMs = 1_000

export const decodeDatasetLimits = (payload: unknown) =>
  Schema.decodeUnknownEffect(LimitsPayloadSchema)(payload).pipe(
    Effect.map(({ data }) => {
      const settings = data.viewer.zones[0].settings.httpRequestsAdaptiveGroups

      return {
        maxDurationMs: settings.maxDuration * secondMs,
        maxPageSize: settings.maxPageSize,
        retentionMs: settings.notOlderThan * secondMs,
      } satisfies DatasetLimits
    }),
    Effect.mapError((cause) =>
      NormalizeError.fromCause({
        cause,
        message: 'Cloudflare analytics limits were unavailable or malformed',
      })
    )
  )
