import type { Effect } from 'effect'
import type { BrowserStreamSaveError } from './errors'

export type BrowserStreamSaveOptions = {
  readonly filename: string
}

export type BrowserStreamSaveFailure = BrowserStreamSaveError

export type SaveBytes = (
  bytes: Uint8Array,
  options: BrowserStreamSaveOptions
) => Effect.Effect<void, BrowserStreamSaveFailure>

export type BrowserStreamSaveService = {
  readonly saveBytes: SaveBytes
}
