import {
  collectListItemTexts,
  collectMdxBlocksFromNode,
  defineAuthoringComponent,
  elementChildren,
  forEachReactNode,
  getContentElementKind,
  getContentElementProps,
  groupChildrenByHeading,
  splitChildrenAtFirstHeading,
  textFromChildren,
} from '@cv/content-authoring-utils'
import type { VariableLookupDescriptor } from '@cv/content-core'
import { isValidElement, type ReactElement, type ReactNode } from 'react'
import type { ActionLink, ProfileBlock, ProfileDetailBlock } from '../model'
import type { CvMdxBlocks } from './blocks'
import {
  actionLinkFromElement,
  actionLinkFromProps,
  isActionLinkElement,
  redactedSection,
  variableLookup,
} from './descriptors'

export { redactedSection, variableLookup } from './descriptors'

const addProfileBlocks = (
  blocks: CvMdxBlocks,
  profileBlocks: readonly ProfileBlock[]
) => {
  if (profileBlocks.length === 0) {
    return
  }

  blocks.profileBlocks ??= []
  blocks.profileBlocks.push(...profileBlocks)
}

type ChildrenProps = {
  children?: ReactNode
}

export type DetailRowAuthoringProps = {
  children?: ReactNode
  href?: string
  label: string
  note?: string
}

export const DetailRow = defineAuthoringComponent<
  DetailRowAuthoringProps,
  never,
  CvMdxBlocks
>({
  extract: {
    apply: (blocks, { props }) => {
      addProfileBlocks(blocks, [profileDetailBlock(props)])
    },
    descend: false,
  },
  kind: 'DetailRow',
  render: ({ children }) => children,
})

export type RowTitleAuthoringProps = {
  children?: ReactNode
}

export const RowTitle = defineAuthoringComponent<
  RowTitleAuthoringProps,
  never,
  CvMdxBlocks
>({
  extract: {
    apply: (blocks, { children }) => {
      addProfileBlocks(blocks, textProfileBlock('title', children))
    },
    descend: false,
  },
  kind: 'RowTitle',
  render: ({ children }) => children,
})

export type VariableLookupAuthoringProps = {
  fallback: string
  label?: string
  variable: string
}

export type RedactedSectionAuthoringProps = {
  children?: ReactNode
  fallback: string
  title?: string
  variable: string
}

export const VariableLookup = defineAuthoringComponent<
  VariableLookupAuthoringProps,
  never,
  CvMdxBlocks
>({
  kind: 'VariableLookup',
  render: ({ fallback }) => fallback,
})

export const RedactedSection = defineAuthoringComponent<
  RedactedSectionAuthoringProps,
  never,
  CvMdxBlocks
>({
  extract: {
    apply: (blocks, { children, path, props }) => {
      addProfileBlocks(blocks, [
        {
          descriptor: redactedSection(props),
          items: profileDetailBlocksFromChildren(children, path),
          type: 'redacted',
        },
      ])
    },
    descend: false,
  },
  kind: 'RedactedSection',
  render: ({ children }) => children,
})

export const Summary = defineAuthoringComponent<
  ChildrenProps,
  never,
  CvMdxBlocks
>({
  extract: {
    apply: (blocks, { children }) => {
      const summary = textFromChildren(children)

      if (summary.length > 0) {
        blocks.summary = {
          text: summary,
        }
      }
    },
    descend: false,
  },
  kind: 'Summary',
  render: ({ children }) => children,
})

export const Highlights = defineAuthoringComponent<
  ChildrenProps,
  never,
  CvMdxBlocks
>({
  extract: {
    apply: (blocks, { children }) => {
      const highlights = collectListItemTexts(children)

      if (highlights.length > 0) {
        blocks.highlights = highlights
      }
    },
  },
  kind: 'Highlights',
  render: ({ children }) => children,
})

export type LinkAuthoringProps = {
  children?: ReactNode
  href: string
  icon?: string
  label?: string
}

export const Link = defineAuthoringComponent<
  LinkAuthoringProps,
  never,
  CvMdxBlocks
>({
  extract: {
    apply: (blocks, { props }) => {
      blocks.links ??= []
      blocks.links.push(actionLinkFromProps(props))
    },
    descend: false,
  },
  kind: 'Link',
  render: ({ children }) => children,
})

const collectActionLinks = (children: ReactNode) => {
  const links: ActionLink[] = []

  forEachReactNode(children, (child) => {
    if (isActionLinkElement(child)) {
      links.push(actionLinkFromElement(child))
      return false
    }
  })

  return links
}

const textFromChildrenWithoutActionLinks = (children: ReactNode) =>
  textFromChildren(children, { ignore: isActionLinkElement })

const parseThesis = (children: ReactNode) => {
  const { body, heading } = splitChildrenAtFirstHeading(children)

  return {
    links: collectActionLinks(children),
    summary: textFromChildrenWithoutActionLinks(body),
    title:
      heading && isValidElement(heading)
        ? textFromChildren(elementChildren(heading))
        : '',
  }
}

export const Thesis = defineAuthoringComponent<
  ChildrenProps,
  never,
  CvMdxBlocks
>({
  extract: {
    apply: (blocks, { children }) => {
      blocks.thesis = parseThesis(children)
    },
    descend: false,
  },
  kind: 'Thesis',
  render: ({ children }) => children,
})

const parseWorkstreamSections = groupChildrenByHeading

export const Workstreams = defineAuthoringComponent<
  ChildrenProps,
  never,
  CvMdxBlocks
>({
  extract: {
    apply: (blocks, { children, path }) => {
      const sections = parseWorkstreamSections(children)

      if (sections.length === 0) {
        throw new Error(`${path} Workstreams requires markdown heading items`)
      }

      blocks.workstreams = sections.map(({ body, title }) => ({
        summary: textFromChildren(body),
        title,
      }))
    },
    descend: false,
  },
  kind: 'Workstreams',
  render: ({ children }) => children,
})

const isVariableLookupElement = (
  value: ReactNode
): value is ReactElement<VariableLookupAuthoringProps> =>
  isValidElement(value) && getContentElementKind(value) === 'VariableLookup'

const variableLookupFromChildren = (children: ReactNode) => {
  let lookup: VariableLookupDescriptor | undefined

  forEachReactNode(children, (child) => {
    if (lookup) {
      return false
    }

    if (isVariableLookupElement(child)) {
      lookup = variableLookup(
        getContentElementProps<VariableLookupAuthoringProps>(child)
      )

      return false
    }
  })

  return lookup
}

function profileDetailBlock({
  children,
  href,
  label,
  note,
}: DetailRowAuthoringProps): ProfileDetailBlock {
  const variable = variableLookupFromChildren(children)

  return {
    ...(href === undefined ? {} : { href }),
    label,
    ...(note === undefined ? {} : { note }),
    type: 'detail',
    value: variable ?? textFromChildren(children),
  }
}

function profileDetailBlocksFromChildren(
  children: ReactNode,
  path: string
): ProfileDetailBlock[] {
  return (
    collectMdxBlocksFromNode<CvMdxBlocks>(children, path).profileBlocks ?? []
  ).filter((block): block is ProfileDetailBlock => block.type === 'detail')
}

function textProfileBlock(
  type: 'heading' | 'text' | 'title',
  children: ReactNode
): ProfileBlock[] {
  const text = textFromChildren(children)

  return text.length > 0 ? [{ text, type }] : []
}

const ProfileHeading = defineAuthoringComponent<
  ChildrenProps,
  never,
  CvMdxBlocks
>({
  extract: {
    apply: (blocks, { children }) => {
      addProfileBlocks(blocks, textProfileBlock('heading', children))
    },
    descend: false,
  },
  kind: 'ProfileHeading',
  render: ({ children }) => children,
})

const ProfileParagraph = defineAuthoringComponent<
  ChildrenProps,
  never,
  CvMdxBlocks
>({
  extract: {
    apply: (blocks, { children }) => {
      addProfileBlocks(blocks, textProfileBlock('text', children))
    },
    descend: false,
  },
  kind: 'ProfileParagraph',
  render: ({ children }) => children,
})

export const profileSectionAuthoringComponents = {
  DetailRow,
  RedactedSection,
  RowTitle,
  VariableLookup,
  h1: ProfileHeading,
  h2: ProfileHeading,
  h3: ProfileHeading,
  h4: ProfileHeading,
  h5: ProfileHeading,
  h6: ProfileHeading,
  p: ProfileParagraph,
}
