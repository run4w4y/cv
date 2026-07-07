import type { MdxContentProps } from '@cv/content-composer'
import type * as React from 'react'

export type ContentComponentKind = string

export type MdxTextBlock = {
  text: string
}

export type MdxWorkstreamBlock = {
  summary: string
  title: string
}

export type MdxThesisBlock = {
  links: unknown[]
  summary: string
  title: string
}

export type MdxBlocks = Record<string, unknown> & {
  highlights?: string[]
  summary?: MdxTextBlock
  thesis?: MdxThesisBlock
  workstreams?: MdxWorkstreamBlock[]
}

export type MdxFunctionComponent = (props: MdxContentProps) => React.ReactNode
