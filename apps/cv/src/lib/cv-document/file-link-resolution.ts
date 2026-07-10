import type {
  ContentFileResolution,
  ContentSessionStatus,
} from '@cv/private-content-session'

export type CvFileLinkMode =
  | 'link'
  | 'private-action'
  | 'private-locked'
  | 'unavailable'

export type CvFileLinkPresentation = {
  readonly fileState: string
  readonly href?: string
  readonly mode: CvFileLinkMode
  readonly printHref?: string
}

export const contentFileLinkPresentation = (
  resolution: ContentFileResolution,
  status: ContentSessionStatus,
  opening = false
): CvFileLinkPresentation => {
  switch (resolution.kind) {
    case 'external':
    case 'public':
      return {
        fileState: resolution.kind,
        href: resolution.href,
        mode: 'link',
        printHref: resolution.href,
      }
    case 'private':
      return status === 'unlocked'
        ? {
            fileState: opening ? 'opening' : 'private-ready',
            mode: 'private-action',
          }
        : {
            fileState: 'private-locked',
            mode: 'private-locked',
          }
    case 'missing':
    case 'unknown':
      return {
        fileState: resolution.kind,
        mode: 'unavailable',
      }
  }
}
