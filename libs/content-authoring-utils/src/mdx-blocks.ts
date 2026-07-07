import type { MdxComponentMap, MdxContentComponent } from '@cv/content-composer'
import { isValidElement, type ReactElement, type ReactNode } from 'react'
import {
  getContentElementDefinition,
  getContentElementProps,
} from './definition'
import { elementChildren } from './mdx-text'
import type { MdxBlocks } from './types'

type ExecutableMdxComponent = (props: object) => ReactNode

const collectBlocks = <Blocks extends MdxBlocks>(
  node: ReactNode,
  path: string,
  blocks: Blocks
): Blocks => {
  const children = Array.isArray(node) ? node : [node]

  for (const child of children) {
    if (!isValidElement(child)) {
      continue
    }

    const element = child as ReactElement
    const extractor = getContentElementDefinition<unknown, never, Blocks>(
      element
    )?.extract
    const childNodes = elementChildren(element)

    if (extractor) {
      extractor.apply(blocks, {
        children: childNodes,
        element,
        path,
        props: getContentElementProps(element),
      })
    }

    if (extractor?.descend === false) {
      continue
    }

    collectBlocks(childNodes, path, blocks)
  }

  return blocks
}

export const collectMdxBlocksFromNode = <Blocks extends MdxBlocks = MdxBlocks>(
  node: ReactNode,
  path: string,
  initialBlocks?: Blocks
): Blocks => collectBlocks(node, path, initialBlocks ?? ({} as Blocks))

export const collectMdxBlocks = <Blocks extends MdxBlocks = MdxBlocks>(
  Component: MdxContentComponent,
  path: string,
  components?: MdxComponentMap,
  initialBlocks?: Blocks
): Blocks =>
  collectMdxBlocksFromNode(
    (Component as ExecutableMdxComponent)({ components }),
    path,
    initialBlocks ?? ({} as Blocks)
  )
