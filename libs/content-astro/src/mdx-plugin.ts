import { type Features, mdxToJs } from 'satteri'
import type { Plugin } from 'vite'

const contentMdxFeatures = {
  directive: false,
  frontmatter: false,
  gfm: false,
  headingAttributes: false,
  math: false,
  smartPunctuation: false,
  subscript: false,
  superscript: false,
  wikilinks: false,
} satisfies Features

export const satteriMdxPlugin = (): Plugin => ({
  enforce: 'pre',
  name: 'content-satteri-mdx',
  transform(source, id) {
    if (!id.endsWith('.mdx')) {
      return null
    }

    const result = mdxToJs(source, {
      features: contentMdxFeatures,
      jsxImportSource: 'react',
      jsxRuntime: 'automatic',
    })

    return {
      code: result.code,
      map: null,
      moduleType: 'js',
    }
  },
})
