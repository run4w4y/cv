import { describe, expect, test } from 'bun:test'
import { contentFileLinkPresentation } from './file-link-resolution'

describe('CV file link presentation', () => {
  test('keeps public and external files linkable on screen and in print', () => {
    expect(
      contentFileLinkPresentation(
        {
          href: '/files/resume.pdf',
          kind: 'public',
          relativePath: 'resume.pdf',
        },
        'public'
      )
    ).toEqual({
      fileState: 'public',
      href: '/files/resume.pdf',
      mode: 'link',
      printHref: '/files/resume.pdf',
    })
  })

  test('renders missing and unknown files as unavailable text', () => {
    expect(
      contentFileLinkPresentation(
        {
          href: '/files/missing.pdf',
          kind: 'missing',
          relativePath: 'missing.pdf',
        },
        'public'
      )
    ).toEqual({ fileState: 'missing', mode: 'unavailable' })
  })

  test('keeps private files out of print at every session state', () => {
    const privateFile = {
      encryptedHref: '/_content/files/profile/private.pdf',
      href: '/files/private.pdf',
      kind: 'private',
      profile: 'profile',
      relativePath: 'private.pdf',
      scope: 'profile',
    } as const

    expect(contentFileLinkPresentation(privateFile, 'public')).toEqual({
      fileState: 'private-locked',
      mode: 'private-locked',
    })
    expect(contentFileLinkPresentation(privateFile, 'unlocked')).toEqual({
      fileState: 'private-ready',
      mode: 'private-action',
    })
  })
})
