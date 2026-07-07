import { join, relative, sep } from 'node:path'
import { Effect } from 'effect'
import type { FileSystem } from 'effect/FileSystem'
import type { ContentBuildFileSystemError } from '../errors'
import {
  type ContentFile,
  contentFilesDirectoryName,
  type DiscoverContentFilesOptions,
  privateFilesDirectoryName,
  profileFilesDirectoryName,
  profileRootDirectoryName,
  publicFilesDirectoryName,
} from './model'
import { collectFiles } from './platform'

const normalizeRelativeFilePath = (path: string) => path.split(sep).join('/')

const sortedUnique = (values: readonly string[]) =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right))

const contentFileSort = (left: ContentFile, right: ContentFile) => {
  const scopeOrder =
    left.scope.localeCompare(right.scope) ||
    (left.profile ?? '').localeCompare(right.profile ?? '')

  return scopeOrder || left.relativePath.localeCompare(right.relativePath)
}

const publicContentFiles = (publicDir: string) =>
  collectFiles(publicDir).pipe(
    Effect.map((files) =>
      files.map(
        (sourcePath) =>
          ({
            relativePath: normalizeRelativeFilePath(
              relative(publicDir, sourcePath)
            ),
            scope: 'public',
            sourcePath,
          }) satisfies ContentFile
      )
    )
  )

const sharedPrivateContentFiles = (
  privateDir: string,
  profiles: readonly string[]
) =>
  collectFiles(privateDir).pipe(
    Effect.map((files) =>
      sortedUnique(profiles).flatMap((profile) =>
        files.map(
          (sourcePath) =>
            ({
              profile,
              relativePath: normalizeRelativeFilePath(
                relative(privateDir, sourcePath)
              ),
              scope: 'private',
              sourcePath,
            }) satisfies ContentFile
        )
      )
    )
  )

const profilePrivateContentFiles = (
  contentRoot: string,
  profiles: readonly string[]
) =>
  Effect.forEach(sortedUnique(profiles), (profile) => {
    const profileFilesDir = join(
      contentRoot,
      profileRootDirectoryName,
      profile,
      profileFilesDirectoryName
    )

    return collectFiles(profileFilesDir).pipe(
      Effect.map((files) =>
        files.map(
          (sourcePath) =>
            ({
              profile,
              relativePath: normalizeRelativeFilePath(
                relative(profileFilesDir, sourcePath)
              ),
              scope: 'private',
              sourcePath,
            }) satisfies ContentFile
        )
      )
    )
  }).pipe(Effect.map((groups) => groups.flat()))

const privateFileKey = (file: ContentFile) =>
  `${file.profile ?? ''}\u0000${file.relativePath}`

const mergePrivateContentFiles = (
  sharedFiles: readonly ContentFile[],
  profileFiles: readonly ContentFile[]
) => {
  const byProfilePath = new Map<string, ContentFile>()

  for (const file of sharedFiles) {
    byProfilePath.set(privateFileKey(file), file)
  }

  for (const file of profileFiles) {
    byProfilePath.set(privateFileKey(file), file)
  }

  return [...byProfilePath.values()]
}

export const discoverContentFiles = (
  contentRoot: string,
  { profiles }: DiscoverContentFilesOptions
): Effect.Effect<ContentFile[], ContentBuildFileSystemError, FileSystem> =>
  Effect.gen(function* () {
    const filesRoot = join(contentRoot, contentFilesDirectoryName)
    const publicDir = join(filesRoot, publicFilesDirectoryName)
    const privateDir = join(filesRoot, privateFilesDirectoryName)
    const publicFiles = yield* publicContentFiles(publicDir)
    const sharedPrivateFiles = yield* sharedPrivateContentFiles(
      privateDir,
      profiles
    )
    const profilePrivateFiles = yield* profilePrivateContentFiles(
      contentRoot,
      profiles
    )
    const privateFiles = mergePrivateContentFiles(
      sharedPrivateFiles,
      profilePrivateFiles
    )

    return [...publicFiles, ...privateFiles].sort(contentFileSort)
  })

export const discoverContentFileProfiles = (
  contentRoot: string,
  profiles: readonly string[]
) =>
  Effect.gen(function* () {
    const targetProfiles = sortedUnique(profiles)
    const sharedFiles = yield* collectFiles(
      join(contentRoot, contentFilesDirectoryName, privateFilesDirectoryName)
    )
    const profileFileProfiles = yield* Effect.filter(
      targetProfiles,
      (profile) =>
        collectFiles(
          join(
            contentRoot,
            profileRootDirectoryName,
            profile,
            profileFilesDirectoryName
          )
        ).pipe(Effect.map((files) => files.length > 0))
    )

    return sharedFiles.length > 0
      ? sortedUnique([...targetProfiles, ...profileFileProfiles])
      : profileFileProfiles
  })
