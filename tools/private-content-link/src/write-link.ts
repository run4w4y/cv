import { resolve } from 'node:path'
import type { MintedPrivateAudienceLink } from '@cv/content-build'
import { Data, Effect } from 'effect'
import { FileSystem } from 'effect/FileSystem'
import { Path } from 'effect/Path'

export type WritePrivateContentLinkRequest = {
  readonly link: MintedPrivateAudienceLink
  readonly path: string
  readonly rootDir?: string
}

export class PrivateContentLinkFileSystemError extends Data.TaggedError(
  'PrivateContentLinkFileSystemError'
)<{
  readonly cause: unknown
  readonly message: string
  readonly path: string
}> {}

const defaultRootDir = resolve(import.meta.dir, '../../..')

export const writePrivateContentLink = ({
  link,
  path: rawPath,
  rootDir = defaultRootDir,
}: WritePrivateContentLinkRequest) =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem
    const path = yield* Path
    const outputPath = path.isAbsolute(rawPath)
      ? path.normalize(rawPath)
      : path.resolve(rootDir, rawPath)

    yield* fileSystem.makeDirectory(path.dirname(outputPath), {
      recursive: true,
    })
    yield* fileSystem.writeFileString(outputPath, `${link.url}\n`)

    return outputPath
  }).pipe(
    Effect.mapError(
      (cause) =>
        new PrivateContentLinkFileSystemError({
          cause,
          message: `Could not write private content link to ${rawPath}`,
          path: rawPath,
        })
    )
  )
