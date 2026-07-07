import { dirname, join } from 'node:path'
import { Effect } from 'effect'
import { FileSystem } from 'effect/FileSystem'
import { ContentBuildFileSystemError } from '../errors'

export const readBytes = (path: string) =>
  FileSystem.pipe(
    Effect.flatMap((fileSystem) =>
      fileSystem.readFile(path).pipe(
        Effect.mapError(
          (cause) =>
            new ContentBuildFileSystemError({
              cause,
              operation: 'read',
              path,
            })
        )
      )
    )
  )

const makeParentDirectory = (path: string) =>
  FileSystem.pipe(
    Effect.flatMap((fileSystem) =>
      fileSystem.makeDirectory(dirname(path), { recursive: true }).pipe(
        Effect.mapError(
          (cause) =>
            new ContentBuildFileSystemError({
              cause,
              operation: 'create directory for',
              path,
            })
        )
      )
    )
  )

export const writeBytes = (path: string, bytes: Uint8Array) =>
  makeParentDirectory(path).pipe(
    Effect.andThen(
      FileSystem.pipe(
        Effect.flatMap((fileSystem) =>
          fileSystem.writeFile(path, bytes).pipe(
            Effect.mapError(
              (cause) =>
                new ContentBuildFileSystemError({
                  cause,
                  operation: 'write',
                  path,
                })
            )
          )
        )
      )
    )
  )

export const writeText = (path: string, text: string) =>
  makeParentDirectory(path).pipe(
    Effect.andThen(
      FileSystem.pipe(
        Effect.flatMap((fileSystem) =>
          fileSystem.writeFileString(path, text).pipe(
            Effect.mapError(
              (cause) =>
                new ContentBuildFileSystemError({
                  cause,
                  operation: 'write',
                  path,
                })
            )
          )
        )
      )
    )
  )

export const copyPath = (sourcePath: string, outputPath: string) =>
  makeParentDirectory(outputPath).pipe(
    Effect.andThen(
      FileSystem.pipe(
        Effect.flatMap((fileSystem) =>
          fileSystem.copyFile(sourcePath, outputPath).pipe(
            Effect.mapError(
              (cause) =>
                new ContentBuildFileSystemError({
                  cause,
                  operation: 'copy',
                  path: sourcePath,
                })
            )
          )
        )
      )
    )
  )

export const removePath = (path: string) =>
  FileSystem.pipe(
    Effect.flatMap((fileSystem) =>
      fileSystem.remove(path, { force: true, recursive: true }).pipe(
        Effect.mapError(
          (cause) =>
            new ContentBuildFileSystemError({
              cause,
              operation: 'remove',
              path,
            })
        )
      )
    )
  )

export const collectFiles = (
  directory: string
): Effect.Effect<string[], ContentBuildFileSystemError, FileSystem> =>
  FileSystem.pipe(
    Effect.flatMap((fileSystem) =>
      fileSystem.exists(directory).pipe(
        Effect.mapError(
          (cause) =>
            new ContentBuildFileSystemError({
              cause,
              operation: 'check',
              path: directory,
            })
        ),
        Effect.flatMap((exists) =>
          exists
            ? fileSystem.readDirectory(directory, { recursive: true }).pipe(
                Effect.mapError(
                  (cause) =>
                    new ContentBuildFileSystemError({
                      cause,
                      operation: 'read directory',
                      path: directory,
                    })
                ),
                Effect.flatMap((entries) =>
                  Effect.forEach(entries, (entry) => {
                    const path = join(directory, entry)

                    return fileSystem.stat(path).pipe(
                      Effect.mapError(
                        (cause) =>
                          new ContentBuildFileSystemError({
                            cause,
                            operation: 'stat',
                            path,
                          })
                      ),
                      Effect.map((info) => (info.type === 'File' ? [path] : []))
                    )
                  })
                ),
                Effect.map((groups) => groups.flat())
              )
            : Effect.succeed([])
        )
      )
    )
  )

export const directoryNames = (
  directory: string
): Effect.Effect<string[], ContentBuildFileSystemError, FileSystem> =>
  FileSystem.pipe(
    Effect.flatMap((fileSystem) =>
      fileSystem.readDirectory(directory).pipe(
        Effect.mapError(
          (cause) =>
            new ContentBuildFileSystemError({
              cause,
              operation: 'read directory',
              path: directory,
            })
        ),
        Effect.flatMap((entries) =>
          Effect.forEach(entries, (entry) => {
            const path = join(directory, entry)

            return fileSystem.stat(path).pipe(
              Effect.mapError(
                (cause) =>
                  new ContentBuildFileSystemError({
                    cause,
                    operation: 'stat',
                    path,
                  })
              ),
              Effect.map((info) => (info.type === 'Directory' ? [entry] : []))
            )
          })
        ),
        Effect.map((groups) =>
          groups.flat().sort((left, right) => left.localeCompare(right))
        )
      )
    )
  )

export const optionalDirectoryNames = (
  directory: string
): Effect.Effect<string[], ContentBuildFileSystemError, FileSystem> =>
  FileSystem.pipe(
    Effect.flatMap((fileSystem) =>
      fileSystem.exists(directory).pipe(
        Effect.mapError(
          (cause) =>
            new ContentBuildFileSystemError({
              cause,
              operation: 'check',
              path: directory,
            })
        ),
        Effect.flatMap((exists) =>
          exists ? directoryNames(directory) : Effect.succeed([])
        )
      )
    )
  )
