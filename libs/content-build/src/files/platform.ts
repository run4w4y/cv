import { dirname, join } from 'node:path'
import { Effect } from 'effect'
import {
  FileSystem,
  type FileSystem as FileSystemService,
} from 'effect/FileSystem'
import type { PlatformError } from 'effect/PlatformError'
import { ContentBuildFileSystemError } from '../errors'

const fileSystemOperation = <Value>(
  operation: string,
  path: string,
  run: (fileSystem: FileSystemService) => Effect.Effect<Value, PlatformError>
): Effect.Effect<Value, ContentBuildFileSystemError, FileSystem> =>
  FileSystem.pipe(
    Effect.flatMap((fileSystem) => run(fileSystem)),
    Effect.mapError(
      (cause) => new ContentBuildFileSystemError({ cause, operation, path })
    )
  )

const pathExists = (path: string) =>
  fileSystemOperation('check', path, (fileSystem) => fileSystem.exists(path))

const readDirectory = (path: string, recursive = false) =>
  fileSystemOperation('read directory', path, (fileSystem) =>
    fileSystem.readDirectory(path, recursive ? { recursive: true } : undefined)
  )

const statPath = (path: string) =>
  fileSystemOperation('stat', path, (fileSystem) => fileSystem.stat(path))

export const readBytes = (path: string) =>
  fileSystemOperation('read', path, (fileSystem) => fileSystem.readFile(path))

const makeParentDirectory = (path: string) =>
  fileSystemOperation('create directory for', path, (fileSystem) =>
    fileSystem.makeDirectory(dirname(path), { recursive: true })
  )

export const writeBytes = (path: string, bytes: Uint8Array) =>
  makeParentDirectory(path).pipe(
    Effect.andThen(
      fileSystemOperation('write', path, (fileSystem) =>
        fileSystem.writeFile(path, bytes)
      )
    )
  )

export const writeText = (path: string, text: string) =>
  makeParentDirectory(path).pipe(
    Effect.andThen(
      fileSystemOperation('write', path, (fileSystem) =>
        fileSystem.writeFileString(path, text)
      )
    )
  )

export const copyPath = (sourcePath: string, outputPath: string) =>
  makeParentDirectory(outputPath).pipe(
    Effect.andThen(
      fileSystemOperation('copy', sourcePath, (fileSystem) =>
        fileSystem.copyFile(sourcePath, outputPath)
      )
    )
  )

export const removePath = (path: string) =>
  fileSystemOperation('remove', path, (fileSystem) =>
    fileSystem.remove(path, { force: true, recursive: true })
  )

const entriesWithType = (
  directory: string,
  type: 'Directory' | 'File',
  recursive = false
) =>
  readDirectory(directory, recursive).pipe(
    Effect.flatMap((entries) =>
      Effect.filter(entries, (entry) =>
        statPath(join(directory, entry)).pipe(
          Effect.map((info) => info.type === type)
        )
      )
    )
  )

export const collectFiles = (
  directory: string
): Effect.Effect<string[], ContentBuildFileSystemError, FileSystem> =>
  pathExists(directory).pipe(
    Effect.flatMap((exists) =>
      exists
        ? entriesWithType(directory, 'File', true).pipe(
            Effect.map((entries) =>
              entries.map((entry) => join(directory, entry))
            )
          )
        : Effect.succeed([])
    )
  )

export const directoryNames = (
  directory: string
): Effect.Effect<string[], ContentBuildFileSystemError, FileSystem> =>
  entriesWithType(directory, 'Directory').pipe(
    Effect.map((entries) =>
      entries.sort((left, right) => left.localeCompare(right))
    )
  )

export const optionalDirectoryNames = (
  directory: string
): Effect.Effect<string[], ContentBuildFileSystemError, FileSystem> =>
  pathExists(directory).pipe(
    Effect.flatMap((exists) =>
      exists ? directoryNames(directory) : Effect.succeed([])
    )
  )
