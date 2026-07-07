import { Data } from 'effect'

export class BrowserStreamSaveError extends Data.TaggedError(
  'BrowserStreamSaveError'
)<{
  readonly cause?: unknown
  readonly message: string
  readonly operation: string
}> {}
