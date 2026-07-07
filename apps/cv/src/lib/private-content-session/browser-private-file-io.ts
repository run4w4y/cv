import { BrowserStreamSave } from '@cv/browser-stream-save'
import {
  PrivateContentFileError,
  PrivateContentFileIO,
} from '@cv/private-content-session'
import { Effect, Layer } from 'effect'
import * as HttpClient from 'effect/unstable/http/HttpClient'
import * as HttpClientResponse from 'effect/unstable/http/HttpClientResponse'

const responseBytes = (response: HttpClientResponse.HttpClientResponse) =>
  response.arrayBuffer.pipe(Effect.map((buffer) => new Uint8Array(buffer)))

export const CvBrowserPrivateFileIOLayer = Layer.effect(
  PrivateContentFileIO,
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient
    const browserStreamSave = yield* BrowserStreamSave

    return {
      fetchBytes: (href) =>
        client
          .get(href)
          .pipe(Effect.flatMap(HttpClientResponse.filterStatusOk))
          .pipe(Effect.flatMap(responseBytes))
          .pipe(
            Effect.mapError(
              (cause) =>
                new PrivateContentFileError({
                  cause,
                  message: 'Could not fetch encrypted private file',
                  operation: 'fetch',
                })
            )
          ),
      saveBytes: (bytes: Uint8Array, filename: string) =>
        browserStreamSave.saveBytes(bytes, { filename }).pipe(
          Effect.catchTag('BrowserStreamSaveError', (cause) =>
            Effect.fail(
              new PrivateContentFileError({
                cause,
                message: 'Could not save private file',
                operation: 'save',
              })
            )
          )
        ),
    }
  })
)
