import type {
  FactsReleaseObject,
  FactsReleaseRegistration,
} from '@cv/facts-release'
import {
  FactsReleasePublicationError,
  FactsReleasePublicationTarget,
} from '@cv/facts-release'
import { Effect, Layer, Redacted, Schema } from 'effect'

import type { FactsPublisherConfig } from './config'
import { FactsPublisherHttpError, FactsPublisherIntegrityError } from './errors'

export type FactsPublisherFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>

export type FactsPublisherHttpClient = {
  readonly activate: (
    releaseId: string,
    expectedVersion: number
  ) => Effect.Effect<
    PublishedChannel,
    FactsPublisherHttpError | FactsPublisherIntegrityError
  >
  readonly current: () => Effect.Effect<CurrentChannel, FactsPublisherHttpError>
  readonly targetLayer: Layer.Layer<FactsReleasePublicationTarget>
}

export type CurrentChannel = {
  readonly activeReleaseId: string | null
  readonly version: number
}

export type PublishedChannel = {
  readonly activeReleaseId: string
  readonly name: string
  readonly version: number
}

const OpaqueObjectResponseSchema = Schema.Struct({
  byteLength: Schema.Int,
  key: Schema.String,
  sha256: Schema.String,
})

const FactsChannelResponseSchema = Schema.Struct({
  activeReleaseId: Schema.String,
  name: Schema.String,
  updatedAt: Schema.String,
  version: Schema.Int,
})

const ActiveFactsResponseSchema = Schema.Struct({
  channel: FactsChannelResponseSchema,
})

const endpoint = (base: URL, path: string) => {
  const url = new URL(base)
  const root = url.pathname.replace(/\/+$/u, '')
  const separator = path.indexOf('?')
  const pathname = separator === -1 ? path : path.slice(0, separator)
  const search = separator === -1 ? '' : path.slice(separator + 1)
  url.pathname = `${root.endsWith('/v1') ? root : `${root}/v1`}${pathname}`
  url.search = search
  url.hash = ''
  return url
}

const stable = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stable)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stable(child)])
    )
  }
  return value
}

const equalJson = (left: unknown, right: unknown) =>
  JSON.stringify(stable(left)) === JSON.stringify(stable(right))

const deterministicRegistration = (registration: FactsReleaseRegistration) => ({
  ...registration,
  release: { ...registration.release, createdAt: undefined },
})

const withoutReleaseCreatedAt = (value: unknown): unknown => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return value
  }

  const release = Reflect.get(value, 'release')
  return {
    ...value,
    release:
      release !== null && typeof release === 'object' && !Array.isArray(release)
        ? { ...release, createdAt: undefined }
        : release,
  }
}

const makeRequest = (
  config: FactsPublisherConfig,
  fetchImplementation: FactsPublisherFetch,
  path: string,
  operation: FactsPublisherHttpError['operation'],
  init: RequestInit
) =>
  Effect.tryPromise({
    try: () =>
      fetchImplementation(endpoint(config.registryUrl, path), {
        ...init,
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${Redacted.value(config.registryToken)}`,
          ...init.headers,
        },
      }),
    catch: (cause) =>
      new FactsPublisherHttpError({
        cause,
        message: `Registry request failed during ${operation}.`,
        operation,
        status: null,
      }),
  })

const json = (
  response: Response,
  operation: FactsPublisherHttpError['operation']
) =>
  Effect.tryPromise({
    try: () => response.json() as Promise<unknown>,
    catch: (cause) =>
      new FactsPublisherHttpError({
        cause,
        message: `Registry returned invalid JSON during ${operation}.`,
        operation,
        status: response.status,
      }),
  })

const statusFailure = (
  response: Response,
  operation: FactsPublisherHttpError['operation']
) =>
  new FactsPublisherHttpError({
    cause: new Error(`Unexpected registry status ${response.status}.`),
    message: `Registry rejected ${operation} with status ${response.status}.`,
    operation,
    status: response.status,
  })

const decode = <A, I, R>(
  schema: Schema.Codec<A, I, R>,
  value: unknown,
  response: Response,
  operation: FactsPublisherHttpError['operation']
) =>
  Schema.decodeUnknownEffect(schema)(value).pipe(
    Effect.mapError(
      (cause) =>
        new FactsPublisherHttpError({
          cause,
          message: `Registry returned an invalid response during ${operation}.`,
          operation,
          status: response.status,
        })
    )
  )

const jsonRequest = (method: 'POST' | 'PUT', body: unknown): RequestInit => ({
  body: JSON.stringify(body),
  headers: { 'content-type': 'application/json' },
  method,
})

const mismatch = (
  operation: FactsPublisherIntegrityError['operation'],
  field: string,
  expected: number | string,
  actual: number | string
) =>
  new FactsPublisherIntegrityError({
    actual,
    expected,
    field,
    message: `Registry response did not match the compiled facts release during ${operation}.`,
    operation,
  })

const verifyObjectResponse = (
  object: FactsReleaseObject,
  response: Schema.Schema.Type<typeof OpaqueObjectResponseSchema>
) => {
  if (response.sha256 !== object.sha256) {
    return Effect.fail(
      mismatch('upload-object', 'sha256', object.sha256, response.sha256)
    )
  }
  if (response.key !== object.key) {
    return Effect.fail(
      mismatch('upload-object', 'key', object.key, response.key)
    )
  }
  if (response.byteLength !== object.byteLength) {
    return Effect.fail(
      mismatch(
        'upload-object',
        'byteLength',
        object.byteLength,
        response.byteLength
      )
    )
  }
  return Effect.void
}

const uploadObject = (
  config: FactsPublisherConfig,
  fetchImplementation: FactsPublisherFetch,
  object: FactsReleaseObject
) =>
  Effect.gen(function* () {
    const response = yield* makeRequest(
      config,
      fetchImplementation,
      '/objects',
      'upload-object',
      jsonRequest('POST', {
        data: Buffer.from(object.bytes).toString('base64'),
      })
    )
    if (!response.ok) return yield* statusFailure(response, 'upload-object')
    const body = yield* json(response, 'upload-object')
    const metadata = yield* decode(
      OpaqueObjectResponseSchema,
      body,
      response,
      'upload-object'
    )
    yield* verifyObjectResponse(object, metadata)
  })

const readRegisteredRelease = (
  config: FactsPublisherConfig,
  fetchImplementation: FactsPublisherFetch,
  releaseId: string
) =>
  Effect.gen(function* () {
    const response = yield* makeRequest(
      config,
      fetchImplementation,
      `/facts-releases/${encodeURIComponent(releaseId)}`,
      'read-release',
      { method: 'GET' }
    )
    if (response.status === 404) return null
    if (!response.ok) return yield* statusFailure(response, 'read-release')
    return yield* json(response, 'read-release')
  })

const registerRelease = (
  config: FactsPublisherConfig,
  fetchImplementation: FactsPublisherFetch,
  registration: FactsReleaseRegistration
) =>
  Effect.gen(function* () {
    const existing = yield* readRegisteredRelease(
      config,
      fetchImplementation,
      registration.release.id
    )
    if (existing !== null) {
      if (
        !equalJson(
          withoutReleaseCreatedAt(existing),
          deterministicRegistration(registration)
        )
      ) {
        return yield* mismatch(
          'register-release',
          'existingRelease',
          registration.release.id,
          'different-metadata'
        )
      }
      return
    }

    const response = yield* makeRequest(
      config,
      fetchImplementation,
      '/facts-releases',
      'register-release',
      jsonRequest('POST', registration)
    )
    if (!response.ok) return yield* statusFailure(response, 'register-release')
    const body = yield* json(response, 'register-release')
    if (!equalJson(body, registration)) {
      return yield* mismatch(
        'register-release',
        'registration',
        registration.release.id,
        'different-response'
      )
    }
  })

const publicationFailure = (
  operation: 'register' | 'upload',
  error: FactsPublisherHttpError | FactsPublisherIntegrityError
) =>
  new FactsReleasePublicationError({
    cause: error,
    message: error.message,
    operation,
  })

export const makeFactsPublisherHttpClient = (
  config: FactsPublisherConfig,
  fetchImplementation: FactsPublisherFetch = globalThis.fetch
): FactsPublisherHttpClient => {
  const current = Effect.fn('FactsPublisherHttp.current')(() =>
    Effect.gen(function* () {
      const path = `/facts-releases/active?locale=en&channel=${encodeURIComponent(config.channel)}`
      const response = yield* makeRequest(
        config,
        fetchImplementation,
        path,
        'read-channel',
        { method: 'GET' }
      )
      if (response.status === 404) {
        return { activeReleaseId: null, version: 0 }
      }
      if (!response.ok) return yield* statusFailure(response, 'read-channel')
      const body = yield* json(response, 'read-channel')
      const active = yield* decode(
        ActiveFactsResponseSchema,
        body,
        response,
        'read-channel'
      )
      if (active.channel.name !== config.channel) {
        return yield* new FactsPublisherHttpError({
          cause: new Error('The active facts channel name did not match.'),
          message: 'Registry returned a different active facts channel.',
          operation: 'read-channel',
          status: response.status,
        })
      }
      return {
        activeReleaseId: active.channel.activeReleaseId,
        version: active.channel.version,
      }
    })
  )

  const activate = Effect.fn('FactsPublisherHttp.activate')(
    (releaseId: string, expectedVersion: number) =>
      Effect.gen(function* () {
        const response = yield* makeRequest(
          config,
          fetchImplementation,
          `/facts-releases/channels/${encodeURIComponent(config.channel)}`,
          'activate-channel',
          jsonRequest('PUT', { expectedVersion, releaseId })
        )
        if (!response.ok) {
          return yield* statusFailure(response, 'activate-channel')
        }
        const body = yield* json(response, 'activate-channel')
        const channel = yield* decode(
          FactsChannelResponseSchema,
          body,
          response,
          'activate-channel'
        )
        if (channel.name !== config.channel) {
          return yield* mismatch(
            'activate-channel',
            'name',
            config.channel,
            channel.name
          )
        }
        if (channel.activeReleaseId !== releaseId) {
          return yield* mismatch(
            'activate-channel',
            'activeReleaseId',
            releaseId,
            channel.activeReleaseId
          )
        }
        if (channel.version !== expectedVersion + 1) {
          return yield* mismatch(
            'activate-channel',
            'version',
            expectedVersion + 1,
            channel.version
          )
        }
        return channel
      })
  )

  return {
    activate,
    current,
    targetLayer: Layer.succeed(FactsReleasePublicationTarget, {
      putObject: (object) =>
        uploadObject(config, fetchImplementation, object).pipe(
          Effect.mapError((error) => publicationFailure('upload', error))
        ),
      register: (registration) =>
        registerRelease(config, fetchImplementation, registration).pipe(
          Effect.mapError((error) => publicationFailure('register', error))
        ),
    }),
  }
}
