import { describe, expect, mock, test } from 'bun:test'
import { Effect } from 'effect'

import { saveWithFileSaver } from './blob'
import { bytes } from './test-support'

const fileSaverCalls: Array<{ blob: Blob; filename: string }> = []

mock.module('file-saver', () => ({
  saveAs: (blob: Blob, filename: string) => {
    fileSaverCalls.push({ blob, filename })
  },
}))

describe('saveWithFileSaver', () => {
  test('saves bytes as a Blob through FileSaver', async () => {
    fileSaverCalls.length = 0

    await Effect.runPromise(
      saveWithFileSaver(bytes('file bytes'), {
        filename: 'blob.pdf',
      })
    )

    expect(fileSaverCalls).toHaveLength(1)
    expect(fileSaverCalls[0]?.filename).toBe('blob.pdf')
    expect(await fileSaverCalls[0]?.blob.text()).toBe('file bytes')
  })
})
