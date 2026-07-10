import { Effect } from 'effect'

type TelemetryAnnotations = Record<string, unknown>

export const urlHost = (url: string | URL) => {
  try {
    return url instanceof URL ? url.host : new URL(url).host
  } catch {
    return 'invalid-url'
  }
}

const annotateTelemetry =
  (annotations?: TelemetryAnnotations) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    annotations
      ? effect.pipe(
          Effect.annotateLogs(annotations),
          Effect.annotateSpans(annotations)
        )
      : effect

export const withTelemetrySpan =
  (name: string, annotations?: TelemetryAnnotations) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) => {
    const spanOptions = annotations ? { attributes: annotations } : undefined

    return effect.pipe(
      annotateTelemetry(annotations),
      Effect.withLogSpan(name),
      Effect.withSpan(name, spanOptions)
    )
  }

export const logDebug = (message: string, annotations?: TelemetryAnnotations) =>
  Effect.logDebug(message).pipe(Effect.annotateLogs(annotations ?? {}))

export const logInfo = (message: string, annotations?: TelemetryAnnotations) =>
  Effect.logInfo(message).pipe(Effect.annotateLogs(annotations ?? {}))

export const logWarning = (
  message: string,
  annotations?: TelemetryAnnotations
) => Effect.logWarning(message).pipe(Effect.annotateLogs(annotations ?? {}))
