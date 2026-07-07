import type { HandlebarsCssTemplatePluginOptions } from '../types'
import {
  loadCssTemplateModule,
  resolveCssTemplateLoaderOptions,
} from './load-template'

export type HandlebarsCssTemplateVitePlugin = {
  enforce: 'pre'
  load: (id: string) => Promise<{ code: string; moduleType: 'js' } | null>
  name: 'handlebars-css-template'
}

export const handlebarsCssTemplatePlugin = (
  options: HandlebarsCssTemplatePluginOptions = {}
): HandlebarsCssTemplateVitePlugin => {
  const loaderOptions = resolveCssTemplateLoaderOptions(options)

  return {
    name: 'handlebars-css-template',
    enforce: 'pre',
    load: async (id) => {
      const code = await loadCssTemplateModule(id, loaderOptions)

      return code ? { code, moduleType: 'js' } : null
    },
  }
}
