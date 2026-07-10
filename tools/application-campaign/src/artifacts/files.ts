import { Effect } from 'effect'
import { FileSystem } from 'effect/FileSystem'
import { ApplicationCampaignFileSystemError } from '../errors'

export const line = (value: string) => [value, ''].join('\n')

const messageWithPath = (message: string, path: string) =>
  [message, path].join(' ')

const mapFileSystemError = (operation: string, path: string, message: string) =>
  Effect.mapError(
    (cause: unknown) =>
      new ApplicationCampaignFileSystemError({
        cause,
        message,
        operation,
        path,
      })
  )

export const ensureDirectory = (path: string, description: string) =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem

    return yield* fileSystem
      .makeDirectory(path, { recursive: true })
      .pipe(
        mapFileSystemError(
          'create directory',
          path,
          messageWithPath(description, path)
        )
      )
  })

export const writeJson = (path: string, value: unknown) =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem

    return yield* fileSystem
      .writeFileString(path, line(JSON.stringify(value, null, 2)))
      .pipe(
        mapFileSystemError(
          'write',
          path,
          messageWithPath('Could not write JSON file', path)
        )
      )
  })

export const writeText = (path: string, value: string) =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem

    return yield* fileSystem
      .writeFileString(path, value)
      .pipe(
        mapFileSystemError(
          'write',
          path,
          messageWithPath('Could not write text file', path)
        )
      )
  })
