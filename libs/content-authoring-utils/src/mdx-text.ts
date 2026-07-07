import {
  Children,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react'

export type ReactNodeVisitResult = false | void

export type ReactNodeVisitor = (node: ReactNode) => ReactNodeVisitResult

export type TextExtractionOptions = {
  ignore?: (node: ReactNode) => boolean
}

export type HeadingSection = {
  body: ReactNode[]
  level: number
  title: string
}

const normalizeWhitespace = (value: string) =>
  value.replace(/\s+/gu, ' ').trim()

export const elementChildren = (element: ReactElement) =>
  (element.props as { children?: ReactNode }).children

const isFragmentElement = (node: ReactNode): node is ReactElement =>
  isValidElement(node) && node.type === Fragment

const flattenFragmentChildren = (children: ReactNode): ReactNode[] =>
  Children.toArray(children).flatMap((node) =>
    isFragmentElement(node)
      ? flattenFragmentChildren(elementChildren(node))
      : node
  )

export const forEachReactNode = (
  children: ReactNode,
  visitor: ReactNodeVisitor
) => {
  for (const child of Children.toArray(children)) {
    const result = visitor(child)

    if (result === false) {
      continue
    }

    if (isValidElement(child)) {
      forEachReactNode(elementChildren(child), visitor)
    }
  }
}

const textFromNode = (
  node: ReactNode,
  options: TextExtractionOptions
): string => {
  if (options.ignore?.(node)) {
    return ''
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }

  if (!isValidElement(node)) {
    return ''
  }

  return textFromChildren(elementChildren(node), options)
}

export const textFromChildren = (
  children: ReactNode,
  options: TextExtractionOptions = {}
) =>
  normalizeWhitespace(
    Children.toArray(children)
      .map((node) => textFromNode(node, options))
      .join(' ')
  )

export const collectListItemTexts = (children: ReactNode) => {
  const items: string[] = []

  forEachReactNode(children, (child) => {
    if (!isValidElement(child) || child.type !== 'li') {
      return
    }

    const text = textFromChildren(elementChildren(child))

    if (text.length > 0) {
      items.push(text)
    }

    return false
  })

  return items
}

export const headingLevel = (node: ReactNode) => {
  if (!isValidElement(node) || typeof node.type !== 'string') {
    return undefined
  }

  const match = /^h([1-6])$/u.exec(node.type)

  return match ? Number(match[1]) : undefined
}

export const isBlankTextNode = (node: ReactNode) =>
  typeof node === 'string' && node.trim().length === 0

export const trimBlankTextNodes = (nodes: readonly ReactNode[]) => {
  const trimmed = [...nodes]

  while (trimmed.length > 0 && isBlankTextNode(trimmed[0])) {
    trimmed.shift()
  }

  while (trimmed.length > 0 && isBlankTextNode(trimmed[trimmed.length - 1])) {
    trimmed.pop()
  }

  return trimmed
}

export const splitChildrenAtFirstHeading = (children: ReactNode) => {
  const nodes = flattenFragmentChildren(children)
  const headingIndex = nodes.findIndex(
    (node) => headingLevel(node) !== undefined
  )
  const heading =
    headingIndex >= 0 && isValidElement(nodes[headingIndex])
      ? (nodes[headingIndex] as ReactElement)
      : undefined

  return {
    body: headingIndex >= 0 ? nodes.slice(headingIndex + 1) : nodes,
    heading,
  }
}

export const groupChildrenByHeading = (children: ReactNode) => {
  const sections: HeadingSection[] = []
  let delimiterLevel: number | undefined
  let current: HeadingSection | undefined

  const finishCurrent = () => {
    if (!current) {
      return
    }

    sections.push({
      ...current,
      body: trimBlankTextNodes(current.body),
    })
  }

  for (const child of flattenFragmentChildren(children)) {
    const level = headingLevel(child)

    if (
      level !== undefined &&
      (delimiterLevel === undefined || level === delimiterLevel)
    ) {
      finishCurrent()

      delimiterLevel = level
      current = {
        body: [],
        level,
        title: textFromChildren(elementChildren(child as ReactElement)),
      }

      continue
    }

    if (current) {
      current.body.push(child)
    }
  }

  finishCurrent()

  return sections
}
