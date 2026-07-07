import type { MdxBlocks } from '@cv/content-authoring-utils'
import type { ActionLink, ProfileBlock } from '../model'

export type CvMdxBlocks = MdxBlocks & {
  highlights?: string[]
  links?: ActionLink[]
  profileBlocks?: ProfileBlock[]
  summary?: {
    text: string
  }
  thesis?: {
    links: ActionLink[]
    summary: string
    title: string
  }
  workstreams?: Array<{
    summary: string
    title: string
  }>
}
