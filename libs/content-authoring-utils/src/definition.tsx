import { isPlainObject } from 'es-toolkit/predicate'
import { isValidElement, type ReactElement, type ReactNode } from 'react'
import type { ContentComponentKind, MdxBlocks } from './types'

export type MdxBlockExtractionContext = {
  path: string
}

export type AuthoringExtractorContext<Props> = MdxBlockExtractionContext & {
  children: ReactNode
  element: ReactElement<Props>
  props: Props
}

export type AuthoringExtractor<Props, Blocks extends MdxBlocks = MdxBlocks> = {
  apply: (blocks: Blocks, context: AuthoringExtractorContext<Props>) => void
  descend?: boolean
}

export type AuthoringComponentDefinition<
  Props,
  _Scope = never,
  Blocks extends MdxBlocks = MdxBlocks,
> = {
  extract?: AuthoringExtractor<Props, Blocks>
  kind: ContentComponentKind
  render: (props: Props) => ReactNode
}

type MarkedAuthoringComponent<Props, Scope, Blocks extends MdxBlocks> = ((
  props: Props
) => ReactNode) & {
  readonly __contentDefinition: AuthoringComponentDefinition<
    Props,
    Scope,
    Blocks
  >
}

const getElementType = (value: unknown) => {
  if (isValidElement(value)) {
    return value.type
  }

  if (isPlainObject(value)) {
    return value.type
  }

  return undefined
}

export const defineAuthoringComponent = <
  Props,
  Scope = never,
  Blocks extends MdxBlocks = MdxBlocks,
>(
  definition: AuthoringComponentDefinition<Props, Scope, Blocks>
) => {
  const Component = (props: Props) => definition.render(props)

  Object.defineProperty(Component, '__contentDefinition', {
    enumerable: false,
    value: definition,
  })

  return Component as MarkedAuthoringComponent<Props, Scope, Blocks>
}

const isMarkedAuthoringComponent = (
  value: unknown
): value is MarkedAuthoringComponent<unknown, unknown, MdxBlocks> =>
  typeof value === 'function' &&
  typeof (value as { __contentDefinition?: { kind?: unknown } })
    .__contentDefinition?.kind === 'string'

export const getContentElementDefinition = <
  Props,
  Scope = never,
  Blocks extends MdxBlocks = MdxBlocks,
>(
  value: unknown
): AuthoringComponentDefinition<Props, Scope, Blocks> | undefined => {
  const type = getElementType(value)

  return isMarkedAuthoringComponent(type)
    ? (type.__contentDefinition as AuthoringComponentDefinition<
        Props,
        Scope,
        Blocks
      >)
    : undefined
}

export const getContentElementKind = (
  value: unknown
): ContentComponentKind | undefined => getContentElementDefinition(value)?.kind

export const getContentElementProps = <Props,>(value: unknown): Props =>
  (value as { props?: unknown }).props as Props

export const isContentElement = (value: unknown) =>
  getContentElementDefinition(value) !== undefined
