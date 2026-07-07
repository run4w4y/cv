import { Context, Layer } from 'effect'
import { saveWithFileSaver } from './blob'
import type { BrowserStreamSaveService } from './types'

export class BrowserStreamSave extends Context.Service<
  BrowserStreamSave,
  BrowserStreamSaveService
>()('@cv/browser-stream-save/BrowserStreamSave') {}

export const BrowserStreamSaveLayer = Layer.succeed(BrowserStreamSave, {
  saveBytes: saveWithFileSaver,
})
