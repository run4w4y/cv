import { isAbsolute, relative, resolve } from 'node:path'
import { Effect } from 'effect'
import { ContentBuildUsageError } from '../errors'
import { discoverContentFiles } from './discovery'
import { toFileIndex } from './indexing'
import type {
  ContentFileOutputPaths,
  PlanContentFilesOptions,
  WriteContentFilesOptions,
} from './model'
import { removePath } from './platform'
import { writePrivateFile, writePublicFile } from './write'

const isInsideDirectory = (directory: string, file: string) => {
  const rel = relative(directory, file)

  return rel.length > 0 && !rel.startsWith('..') && !isAbsolute(rel)
}

const pathsOverlap = (left: string, right: string) =>
  left === right ||
  isInsideDirectory(left, right) ||
  isInsideDirectory(right, left)

const assertGeneratedOutputPath = ({
  label,
  outputRootDir,
  path,
}: {
  label: string
  outputRootDir: string
  path: string
}) => {
  const resolvedRoot = resolve(outputRootDir)
  const resolvedPath = resolve(path)

  return isInsideDirectory(resolvedRoot, resolvedPath)
    ? Effect.succeed(resolvedPath)
    : ContentBuildUsageError.fail(
        `${label} must be inside outputRootDir before content-build can remove it`
      )
}

const assertGeneratedOutputPaths = ({
  outputRootDir,
  privateFilesDir,
  publicFilesDir,
}: ContentFileOutputPaths) =>
  Effect.all({
    privateFilesDir: assertGeneratedOutputPath({
      label: 'privateFilesDir',
      outputRootDir,
      path: privateFilesDir,
    }),
    publicFilesDir: assertGeneratedOutputPath({
      label: 'publicFilesDir',
      outputRootDir,
      path: publicFilesDir,
    }),
  }).pipe(
    Effect.flatMap((paths) =>
      pathsOverlap(paths.privateFilesDir, paths.publicFilesDir)
        ? ContentBuildUsageError.fail(
            'privateFilesDir and publicFilesDir must not overlap'
          )
        : Effect.succeed(paths)
    )
  )

export const planContentFiles = ({
  contentIdSalt,
  contentRoot,
  profiles,
  privateRuntimeInput,
}: PlanContentFilesOptions) =>
  discoverContentFiles(contentRoot, { profiles }).pipe(
    Effect.map((files) => ({
      contentIdSalt,
      files,
      privateRuntimeInput,
    }))
  )

export const indexContentFiles = toFileIndex

export const writeContentFiles = ({
  contentIdSalt,
  files,
  outputRootDir,
  privateFilesDir,
  privateRuntimeInput,
  publicFilesDir,
}: WriteContentFilesOptions) =>
  assertGeneratedOutputPaths({
    outputRootDir,
    privateFilesDir,
    publicFilesDir,
  }).pipe(
    Effect.flatMap((outputPaths) =>
      removePath(outputPaths.publicFilesDir).pipe(
        Effect.andThen(removePath(outputPaths.privateFilesDir)),
        Effect.andThen(
          Effect.forEach(
            files.filter((file) => file.scope === 'public'),
            (file) => writePublicFile(file, outputPaths.publicFilesDir)
          )
        ),
        Effect.andThen(
          privateRuntimeInput
            ? Effect.forEach(
                files.filter((file) => file.scope !== 'public'),
                (file) =>
                  writePrivateFile(
                    file,
                    privateRuntimeInput,
                    outputPaths.privateFilesDir,
                    contentIdSalt
                  )
              )
            : Effect.succeed(undefined)
        )
      )
    )
  )
