import type { MdxContentComponent } from './mdx'

export type ContentModule<Content = unknown> = Record<string, unknown> & {
  default?: Content
}

export type MdxModule<Meta = Record<string, unknown>> = Record<
  string,
  unknown
> & {
  default: MdxContentComponent
  meta?: Meta
}

export type ContentRegistry = {
  mdxModules: Record<string, MdxModule>
  modules: Record<string, ContentModule>
}
