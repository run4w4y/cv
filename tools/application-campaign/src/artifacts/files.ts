import { Effect, Exit } from 'effect'
import { FileSystem } from 'effect/FileSystem'
import { Path } from 'effect/Path'
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

export type ManagedArtifactFile = {
  readonly content: string
  readonly path: string
}

const isSafeRelativePath = (value: string) =>
  value.length > 0 &&
  !value.includes('\0') &&
  value
    .split(/[\\/]/u)
    .every(
      (segment) => segment.length > 0 && segment !== '.' && segment !== '..'
    )

const managedFilesFromManifest = (
  fileSystem: FileSystem,
  manifestPath: string
) =>
  Effect.gen(function* () {
    const manifestExists = yield* fileSystem
      .exists(manifestPath)
      .pipe(
        mapFileSystemError(
          'inspect artifact manifest',
          manifestPath,
          messageWithPath('Could not inspect artifact manifest', manifestPath)
        )
      )

    if (!manifestExists) {
      return []
    }

    const raw = yield* fileSystem
      .readFileString(manifestPath)
      .pipe(
        mapFileSystemError(
          'read artifact manifest',
          manifestPath,
          messageWithPath('Could not read artifact manifest', manifestPath)
        )
      )

    return yield* Effect.try({
      try: () => {
        const value: unknown = JSON.parse(raw)

        if (
          value === null ||
          typeof value !== 'object' ||
          !('files' in value) ||
          !Array.isArray(value.files)
        ) {
          throw new TypeError('Artifact manifest must contain a files array')
        }

        const files: string[] = []
        for (const file of value.files) {
          if (typeof file !== 'string' || !isSafeRelativePath(file)) {
            throw new TypeError(
              'Artifact manifest files must be safe relative paths'
            )
          }
          files.push(file)
        }

        return files
      },
      catch: (cause) =>
        new ApplicationCampaignFileSystemError({
          cause,
          message: messageWithPath(
            'Could not parse artifact manifest',
            manifestPath
          ),
          operation: 'parse artifact manifest',
          path: manifestPath,
        }),
    })
  })

/**
 * Replaces only campaign-owned files while carrying unknown user files forward.
 * The fully prepared sibling directory is promoted with a rename, with the
 * previous directory retained until promotion succeeds.
 */
export const replaceManagedFilesAtomically = ({
  files,
  knownManagedFiles,
  manifestFileName,
  outDir,
}: {
  readonly files: readonly ManagedArtifactFile[]
  readonly knownManagedFiles: readonly string[]
  readonly manifestFileName: string
  readonly outDir: string
}) =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem
    const path = yield* Path
    const parent = path.dirname(outDir)
    const outputName = path.basename(outDir)

    yield* ensureDirectory(
      parent,
      'Could not create campaign output parent directory'
    )

    const stagingDir = yield* fileSystem
      .makeTempDirectory({
        directory: parent,
        prefix: `.${outputName}.staging-`,
      })
      .pipe(
        mapFileSystemError(
          'create staging directory',
          outDir,
          messageWithPath('Could not stage campaign artifacts for', outDir)
        )
      )
    const backupDir = `${stagingDir}.previous`

    yield* Effect.gen(function* () {
      const outputExists = yield* fileSystem.exists(outDir)

      if (outputExists) {
        yield* fileSystem.copy(outDir, stagingDir, { overwrite: true })
      }

      const previousManagedFiles = yield* managedFilesFromManifest(
        fileSystem,
        path.join(stagingDir, manifestFileName)
      )
      const managedFiles = new Set([
        ...knownManagedFiles,
        ...previousManagedFiles,
        manifestFileName,
      ])

      yield* Effect.forEach(
        managedFiles,
        (file) =>
          isSafeRelativePath(file)
            ? fileSystem.remove(path.join(stagingDir, file), {
                force: true,
                recursive: true,
              })
            : Effect.void,
        { discard: true }
      )

      yield* Effect.forEach(
        files,
        (file) =>
          Effect.gen(function* () {
            if (!isSafeRelativePath(file.path)) {
              return yield* Effect.fail(
                new ApplicationCampaignFileSystemError({
                  message: `Campaign artifact path must stay inside the output directory: ${file.path}`,
                  operation: 'stage artifact',
                  path: file.path,
                })
              )
            }

            const destination = path.join(stagingDir, file.path)
            yield* ensureDirectory(
              path.dirname(destination),
              'Could not create staged artifact directory'
            )
            yield* writeText(destination, file.content)
          }),
        { concurrency: 'unbounded', discard: true }
      )

      yield* Effect.acquireUseRelease(
        outputExists
          ? fileSystem.rename(outDir, backupDir).pipe(Effect.as(true))
          : Effect.succeed(false),
        () => fileSystem.rename(stagingDir, outDir),
        (hadPreviousOutput, exit) => {
          if (Exit.isSuccess(exit)) {
            return hadPreviousOutput
              ? fileSystem.remove(backupDir, {
                  force: true,
                  recursive: true,
                })
              : Effect.void
          }

          return Effect.gen(function* () {
            const stagingExists = yield* fileSystem.exists(stagingDir)
            const currentOutputExists = yield* fileSystem.exists(outDir)

            // A completed promotion moves staging away. Move it back so the
            // outer cleanup can discard it before restoring the prior output.
            if (!stagingExists && currentOutputExists) {
              yield* fileSystem.rename(outDir, stagingDir)
            }

            if (hadPreviousOutput) {
              yield* fileSystem.rename(backupDir, outDir)
            }
          })
        }
      )
    }).pipe(
      Effect.mapError((cause) =>
        cause instanceof ApplicationCampaignFileSystemError
          ? cause
          : new ApplicationCampaignFileSystemError({
              cause,
              message: messageWithPath(
                'Could not commit campaign artifact directory',
                outDir
              ),
              operation: 'commit artifacts',
              path: outDir,
            })
      ),
      Effect.ensuring(
        fileSystem
          .remove(stagingDir, { force: true, recursive: true })
          .pipe(Effect.ignore)
      )
    )
  })
