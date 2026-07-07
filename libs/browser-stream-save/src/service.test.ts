import { describe, expect, mock, test } from 'bun:test'
import { Effect } from 'effect'

import { BrowserStreamSaveError } from './errors'
import { BrowserStreamSave, BrowserStreamSaveLayer } from './service'
import { bytes, text } from './test-support'
import type { BrowserStreamSaveOptions } from './types'

const fileSaverCalls: Array<{ blob: Blob; filename: string }> = []

mock.module('file-saver', () => ({
  saveAs: (blob: Blob, filename: string) => {
    fileSaverCalls.push({ blob, filename })
  },
}))

const saveText = (
  saved: Array<{ filename: string; text: string }>,
  bytesValue: Uint8Array,
  { filename }: BrowserStreamSaveOptions
) =>
  Effect.sync(() => {
    saved.push({
      filename,
      text: text(bytesValue),
    })
  })

const saveWithBrowserStreamSave = (
  bytesValue: Uint8Array,
  options: { readonly filename: string }
) =>
  BrowserStreamSave.pipe(
    Effect.flatMap((service) => service.saveBytes(bytesValue, options))
  )

describe('BrowserStreamSave service', () => {
  test('uses the service accessor with an injected service', async () => {
    const saved: Array<{ filename: string; text: string }> = []
    const service = {
      saveBytes: (bytesValue: Uint8Array, options: BrowserStreamSaveOptions) =>
        saveText(saved, bytesValue, options),
    }

    await Effect.runPromise(
      saveWithBrowserStreamSave(bytes('service'), {
        filename: 'service.pdf',
      }).pipe(Effect.provideService(BrowserStreamSave, service))
    )

    expect(saved).toEqual([
      {
        filename: 'service.pdf',
        text: 'service',
      },
    ])
  })

  test('live layer saves bytes through FileSaver', async () => {
    fileSaverCalls.length = 0

    await Effect.runPromise(
      saveWithBrowserStreamSave(bytes('live bytes'), {
        filename: 'live.pdf',
      }).pipe(Effect.provide(BrowserStreamSaveLayer))
    )

    expect(fileSaverCalls).toHaveLength(1)
    expect(fileSaverCalls[0]?.filename).toBe('live.pdf')
    expect(await fileSaverCalls[0]?.blob.text()).toBe('live bytes')
  })

  test('surfaces injected service errors as BrowserStreamSaveError', async () => {
    const service = {
      saveBytes: () =>
        Effect.fail(
          new BrowserStreamSaveError({
            cause: undefined,
            message: 'save failed',
            operation: 'test',
          })
        ),
    }

    const error = await Effect.runPromise(
      Effect.flip(
        saveWithBrowserStreamSave(bytes('ignored'), {
          filename: 'x',
        }).pipe(Effect.provideService(BrowserStreamSave, service))
      )
    )

    expect(error).toMatchObject({
      _tag: 'BrowserStreamSaveError',
      message: 'save failed',
    })
  })
})
