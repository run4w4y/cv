import type { ComponentType, ElementType } from 'react'

export type MdxComponentMap = Record<string, ElementType>

export type MdxContentProps = {
  components?: MdxComponentMap
}

export type MdxContentComponent = ComponentType<MdxContentProps>
