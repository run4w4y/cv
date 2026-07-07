import type { ComponentType } from 'react'

export type MdxComponentMap = Record<string, ComponentType<any> | string>

export type MdxContentProps = {
  components?: MdxComponentMap
}

export type MdxContentComponent = ComponentType<MdxContentProps>
