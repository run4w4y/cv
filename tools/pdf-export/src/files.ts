import { Effect } from 'effect'
import { FileSystem } from 'effect/FileSystem'
import { PdfFileSystemError } from './errors'

export const ensureDirectory = (path: string) =>
  FileSystem.pipe(
    Effect.flatMap((fileSystem) =>
      fileSystem.makeDirectory(path, { recursive: true })
    ),
    Effect.mapError(
      (cause) =>
        new PdfFileSystemError({
          cause,
          message: `Could not create directory ${path}`,
          operation: 'mkdir',
          path,
        })
    )
  )
