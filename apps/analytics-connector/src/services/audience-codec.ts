import type {
  AnalyticsAudienceRecord,
  AnalyticsDashboardData,
  AnalyticsPathRecord,
} from '@cv/analytics-core'
import { WebCryptoApiLayer } from '@cv/private-content-crypto'
import {
  decodePrivateAudienceId,
  looksLikePrivateAudienceId,
  type PrivateAudienceCodecKey,
  parsePrivateAudienceCodecKey,
} from '@cv/private-content-tokens'
import { Context, Effect, Layer } from 'effect'

import { InternalServerError } from '../http/errors'
import {
  privateAudienceKeyEnv,
  readPrivateAudienceKey,
  withWorkerEnvConfig,
} from '../worker/config'

export class AudienceCodec extends Context.Service<
  AudienceCodec,
  {
    readonly decodeDashboardData: (
      data: AnalyticsDashboardData
    ) => Effect.Effect<AnalyticsDashboardData, InternalServerError>
  }
>()('AudienceCodec') {}

const hasEncodedAudienceId = (data: AnalyticsDashboardData) =>
  data.audiences.some((audience) =>
    looksLikePrivateAudienceId(audience.audienceId)
  ) ||
  data.paths.some((path) =>
    path.audienceId ? looksLikePrivateAudienceId(path.audienceId) : false
  )

const missingKeyError = () =>
  InternalServerError.make({
    message: `${privateAudienceKeyEnv} is required to decode private audience ids`,
  })

const internalCodecError = (cause: unknown) =>
  cause instanceof InternalServerError
    ? cause
    : InternalServerError.fromCause({
        cause,
        message: 'Private audience ids could not be decoded',
      })

const decodeAudienceId = (
  key: PrivateAudienceCodecKey | undefined,
  audienceId: string
) => {
  if (!looksLikePrivateAudienceId(audienceId)) {
    return Effect.succeed(audienceId)
  }

  return key
    ? decodePrivateAudienceId({ audienceId, key }).pipe(
        Effect.mapError((cause) =>
          InternalServerError.fromCause({
            cause,
            message: 'Private audience id could not be decoded',
          })
        )
      )
    : Effect.fail(missingKeyError())
}

const decodePath = (
  key: PrivateAudienceCodecKey | undefined,
  path: AnalyticsPathRecord
) =>
  path.audienceId
    ? decodeAudienceId(key, path.audienceId).pipe(
        Effect.map((audienceId) => ({
          ...path,
          audienceId,
        }))
      )
    : Effect.succeed(path)

const decodeAudience = (
  key: PrivateAudienceCodecKey | undefined,
  audience: AnalyticsAudienceRecord
) =>
  decodeAudienceId(key, audience.audienceId).pipe(
    Effect.map((audienceId) => ({
      ...audience,
      audienceId,
    }))
  )

const decodeDashboardData = (
  data: AnalyticsDashboardData,
  key: PrivateAudienceCodecKey | undefined
) =>
  hasEncodedAudienceId(data) || key
    ? Effect.all({
        audiences: Effect.forEach(data.audiences, (audience) =>
          decodeAudience(key, audience)
        ),
        paths: Effect.forEach(data.paths, (path) => decodePath(key, path)),
      }).pipe(
        Effect.map(({ audiences, paths }) => ({
          ...data,
          audiences,
          paths,
        }))
      )
    : Effect.succeed(data)

const readAudienceCodecKey = readPrivateAudienceKey.pipe(
  withWorkerEnvConfig,
  Effect.flatMap((secret) =>
    secret
      ? parsePrivateAudienceCodecKey(secret).pipe(
          Effect.map((key) => key),
          Effect.mapError((cause) =>
            InternalServerError.fromCause({
              cause,
              message: `${privateAudienceKeyEnv} is invalid`,
            })
          )
        )
      : Effect.succeed(undefined)
  )
)

export const AudienceCodecLayer = Layer.succeed(AudienceCodec, {
  decodeDashboardData: (data) =>
    readAudienceCodecKey.pipe(
      Effect.flatMap((key) => decodeDashboardData(data, key)),
      Effect.provide(WebCryptoApiLayer),
      Effect.mapError(internalCodecError)
    ),
})
