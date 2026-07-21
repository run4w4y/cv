import {
  ActivateFactsReleaseRequestSchema,
  ActiveFactsReleaseResponseSchema,
  FactsActivationResponseSchema,
  FactsPublicationCapabilitiesSchema,
  FactsRegistrationResponseSchema,
  factsPublicationApiPrefix,
} from '@cv/application-registry-api-contract/facts-publication'
import {
  type FactsReleaseBundleV1,
  factsReleaseBundleMediaType,
} from '@cv/facts-release'
import { Effect, Redacted, Schema } from 'effect'

import { FactsToolchainError } from './errors'

const clientError = (message: string, cause: unknown) =>
  new FactsToolchainError({ cause, issue: 'http', message })

const endpoint = (registryUrl: URL, path: string) => {
  const url = new URL(registryUrl)
  url.pathname = path
  url.search = ''
  url.hash = ''
  return url
}

const responseMessage = async (response: Response) => {
  const text = await response.text()
  if (text.length === 0) return `HTTP ${response.status}`
  try {
    const decoded = JSON.parse(text) as unknown
    if (
      decoded !== null &&
      typeof decoded === 'object' &&
      'message' in decoded &&
      typeof decoded.message === 'string'
    ) {
      return decoded.message
    }
  } catch {
    // The response text below is still useful diagnostic evidence.
  }
  return text.slice(0, 500)
}

const request = Effect.fn('FactsToolchain.request')(function* (
  registryUrl: URL,
  token: Redacted.Redacted<string>,
  path: string,
  init: RequestInit = {}
) {
  const response = yield* Effect.tryPromise({
    try: (signal) =>
      fetch(endpoint(registryUrl, path), {
        ...init,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${Redacted.value(token)}`,
          ...init.headers,
        },
        signal,
      }),
    catch: (cause) =>
      clientError(`Facts publication request ${path} failed.`, cause),
  })
  return response
})

const json = <S extends Schema.Top>(schema: S, label: string) =>
  Effect.fn(`FactsToolchain.decode.${label}`)(function* (response: Response) {
    if (!response.ok) {
      return yield* Effect.fail(
        clientError(
          `${label} failed with HTTP ${response.status}: ${yield* Effect.promise(() => responseMessage(response))}`,
          response.status
        )
      )
    }
    const body = yield* Effect.tryPromise({
      try: () => response.json() as Promise<unknown>,
      catch: (cause) => clientError(`${label} returned invalid JSON.`, cause),
    })
    return yield* Schema.decodeUnknownEffect(schema)(body).pipe(
      Effect.mapError((cause) =>
        clientError(`${label} returned an incompatible response.`, cause)
      )
    )
  })

export const publishFactsBundle = Effect.fn('FactsToolchain.publish')(
  function* (options: {
    readonly bundle: FactsReleaseBundleV1
    readonly bytes: Uint8Array
    readonly registryUrl: URL
    readonly token: Redacted.Redacted<string>
  }) {
    const { bundle, bytes, registryUrl, token } = options
    const capabilities = yield* request(
      registryUrl,
      token,
      `${factsPublicationApiPrefix}/capabilities`
    ).pipe(
      Effect.flatMap(
        json(FactsPublicationCapabilitiesSchema, 'Capabilities check')
      )
    )

    const registered = yield* request(
      registryUrl,
      token,
      `${factsPublicationApiPrefix}/releases/${encodeURIComponent(bundle.releaseId)}`,
      {
        body: bytes.slice().buffer,
        headers: { 'Content-Type': factsReleaseBundleMediaType },
        method: 'PUT',
      }
    ).pipe(
      Effect.flatMap(
        json(FactsRegistrationResponseSchema, 'Release registration')
      )
    )

    const currentResponse = yield* request(
      registryUrl,
      token,
      `${factsPublicationApiPrefix}/current`
    )
    const current =
      currentResponse.status === 404
        ? null
        : yield* json(
            ActiveFactsReleaseResponseSchema,
            'Current release read'
          )(currentResponse)

    const activationRequest = ActivateFactsReleaseRequestSchema.make({
      expectedCurrentReleaseId: current?.releaseId ?? null,
      releaseId: bundle.releaseId,
    })
    const activated = yield* request(
      registryUrl,
      token,
      `${factsPublicationApiPrefix}/current`,
      {
        body: JSON.stringify(activationRequest),
        headers: { 'Content-Type': 'application/json' },
        method: 'PUT',
      }
    ).pipe(
      Effect.flatMap(json(FactsActivationResponseSchema, 'Release activation'))
    )

    const verified = yield* request(
      registryUrl,
      token,
      `${factsPublicationApiPrefix}/current`
    ).pipe(
      Effect.flatMap(
        json(ActiveFactsReleaseResponseSchema, 'Activation verification')
      )
    )
    if (verified.releaseId !== bundle.releaseId) {
      return yield* clientError(
        'Production facts release does not match the activated bundle.',
        verified.releaseId
      )
    }

    return { activated, capabilities, registered, verified }
  }
)
