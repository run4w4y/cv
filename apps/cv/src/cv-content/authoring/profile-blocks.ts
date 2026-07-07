import { collectMdxBlocks } from '@cv/content-authoring-utils'
import type { MdxContentComponent } from '@cv/content-composer'
import type { ProfileBlock } from '../model'
import type { CvMdxBlocks } from './blocks'
import { profileSectionAuthoringComponents } from './components'

export const profileBlocksFromMdx = (
  Component: MdxContentComponent,
  path: string
): readonly ProfileBlock[] =>
  collectMdxBlocks<CvMdxBlocks>(
    Component,
    path,
    profileSectionAuthoringComponents
  ).profileBlocks ?? []
