import {
  type ContentFileIndex,
  decodeContentFileIndexDefensively,
  emptyContentFileIndex,
} from '@cv/content-core'
import { decryptPrivateFilePayload } from '@cv/private-content-crypto'
import { runtimeProfileFileAad } from '@cv/private-content-protocol'
import { Effect } from 'effect'
import { PrivateContentFileIO } from './private-file-io'
import type { ContentPageContext, ContentSession } from './types'
import type { PrivateContentFileKeys } from './unlock'

export const PRIVATE_CONTENT_FILE_BASE_PATH = '/_content/files'
export const PUBLIC_CONTENT_FILE_BASE_PATH = '/files'

export type ContentFileResolution =
  | {
      readonly href: string
      readonly kind: 'external'
    }
  | {
      readonly href: string
      readonly kind: 'missing' | 'public' | 'unknown'
      readonly relativePath: string
    }
  | {
      readonly encryptedHref: string
      readonly href: string
      readonly kind: 'private'
      readonly profile: string
      readonly relativePath: string
      readonly scope: 'profile'
    }

export { emptyContentFileIndex }

export const decodeContentFileIndex = decodeContentFileIndexDefensively

const encodePath = (relativePath: string) =>
  relativePath.split('/').map(encodeURIComponent).join('/')

export const publicContentFileHref = (relativePath: string) =>
  `${PUBLIC_CONTENT_FILE_BASE_PATH}/${encodePath(relativePath)}`

const encryptedContentFileHref = ({
  profile,
  relativePath,
}: {
  readonly profile: string
  readonly relativePath: string
}) =>
  `${PRIVATE_CONTENT_FILE_BASE_PATH}/${encodePath(profile)}/${encodePath(
    relativePath
  )}`

export const normalizeContentFileHref = (href: string) => {
  const trimmed = href.trim()

  if (
    !trimmed ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('?') ||
    /^[a-z][a-z0-9+.-]*:/iu.test(trimmed)
  ) {
    return null
  }

  const normalized = trimmed.replaceAll('\\', '/').replace(/^\.\/+/u, '')
  const segments = normalized.split('/').filter((segment) => segment !== '.')

  if (
    segments.length === 0 ||
    segments.some((segment) => segment.length === 0 || segment === '..')
  ) {
    return null
  }

  return segments.join('/')
}

const pathSet = (paths: readonly string[]) => new Set(paths)

export const resolveContentFileHref = ({
  href,
  index,
  privateMode = false,
  profile,
}: {
  readonly href: string
  readonly index: ContentFileIndex | null
  readonly privateMode?: boolean
  readonly profile?: string
}): ContentFileResolution => {
  const relativePath = normalizeContentFileHref(href)

  if (!relativePath) {
    return { href, kind: 'external' }
  }

  const publicHref = publicContentFileHref(relativePath)
  const publicMatch = () =>
    pathSet(index?.public ?? []).has(relativePath)
      ? ({ href: publicHref, kind: 'public', relativePath } as const)
      : null

  if (!index) {
    return { href: publicHref, kind: 'unknown', relativePath }
  }

  if (!privateMode) {
    const publicResolution = publicMatch()

    if (publicResolution) {
      return publicResolution
    }
  }

  const profilePaths =
    profile && index.profiles[profile] ? pathSet(index.profiles[profile]) : null

  if (profile && profilePaths?.has(relativePath)) {
    return {
      encryptedHref: encryptedContentFileHref({
        profile,
        relativePath,
      }),
      href: publicHref,
      kind: 'private',
      profile,
      relativePath,
      scope: 'profile',
    }
  }

  const publicResolution = publicMatch()

  if (publicResolution) {
    return publicResolution
  }

  return { href: publicHref, kind: 'missing', relativePath }
}

export const contentFileMimeType = (relativePath: string) =>
  relativePath.toLowerCase().endsWith('.pdf')
    ? 'application/pdf'
    : 'application/octet-stream'

export const decryptContentFileBytes = (
  payload: Uint8Array,
  resolution: Extract<ContentFileResolution, { kind: 'private' }>,
  keys: PrivateContentFileKeys
) => {
  const aad = runtimeProfileFileAad(resolution.profile, resolution.relativePath)

  return decryptPrivateFilePayload(keys.profileContentKey, payload, aad)
}

const fileNameFromPath = (path: string) => path.split('/').at(-1) ?? path

export const resolveContentFile = <
  Content,
  Page extends ContentPageContext = ContentPageContext,
>(
  session: ContentSession<Content, Page>,
  href: string
): ContentFileResolution =>
  resolveContentFileHref({
    href,
    index: session.files,
    privateMode: session.route !== null,
    profile:
      session.route?.profileId ??
      session.page.profileId ??
      session.page.profile,
  })

export const openContentFile = <
  Content,
  Page extends ContentPageContext = ContentPageContext,
>(
  session: ContentSession<Content, Page>,
  href: string
) =>
  Effect.gen(function* () {
    const resolution = resolveContentFile(session, href)
    const fileKeys = session.private.fileKeys

    if (
      session.status !== 'unlocked' ||
      !fileKeys ||
      resolution.kind !== 'private'
    ) {
      return
    }

    const fileIO = yield* PrivateContentFileIO
    const encrypted = yield* fileIO.fetchBytes(resolution.encryptedHref)
    const plaintext = yield* decryptContentFileBytes(
      encrypted,
      resolution,
      fileKeys
    )

    yield* fileIO.saveBytes(
      plaintext,
      fileNameFromPath(resolution.relativePath)
    )
  })
