import { join } from 'node:path'
import {
  type ContentEncryptionKey,
  encryptPrivateFilePayload,
} from '@cv/private-content-crypto'
import { runtimeProfileFileAad } from '@cv/private-content-protocol'
import type { PrivateRuntimeBuildInput } from '@cv/private-content-protocol/types'
import { Effect } from 'effect'
import { ContentBuildUsageError } from '../errors'
import { mangleProfileId } from '../ids'
import type { ContentFile } from './model'
import { copyPath, readBytes, writeBytes } from './platform'

const contentKeyByProfileId = (input: PrivateRuntimeBuildInput) =>
  new Map(input.profiles.map((profile) => [profile.id, profile.contentKey]))

export const writePublicFile = (file: ContentFile, publicFilesDir: string) =>
  copyPath(file.sourcePath, join(publicFilesDir, file.relativePath))

const writeProfileFile = (
  file: ContentFile,
  input: PrivateRuntimeBuildInput,
  privateFilesDir: string,
  salt: string
) =>
  Effect.gen(function* () {
    if (!file.profile) {
      return yield* ContentBuildUsageError.fail(
        `Profile-scoped content file has no profile: ${file.relativePath}`
      )
    }

    const profile = mangleProfileId(file.profile, salt)
    const key: ContentEncryptionKey | undefined =
      contentKeyByProfileId(input).get(profile)

    if (!key) {
      return yield* ContentBuildUsageError.fail(
        `Missing private content key for profile file ${file.profile}/${file.relativePath}`
      )
    }

    const plaintext = yield* readBytes(file.sourcePath)
    const ciphertext = yield* encryptPrivateFilePayload(
      key,
      plaintext,
      runtimeProfileFileAad(profile, file.relativePath)
    )

    return yield* writeBytes(
      join(privateFilesDir, profile, file.relativePath),
      ciphertext
    )
  })

export const writePrivateFile = (
  file: ContentFile,
  input: PrivateRuntimeBuildInput,
  privateFilesDir: string,
  salt: string
) => writeProfileFile(file, input, privateFilesDir, salt)
