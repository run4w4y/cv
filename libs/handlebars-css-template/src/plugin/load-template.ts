import { readFile } from 'node:fs/promises'

import Handlebars from 'handlebars'

import type { HandlebarsCssTemplatePluginOptions } from '../types'
import { createCssTemplateModuleSource } from './generated-module'

export const defaultTemplateExtension = '.css.hbs'
export const defaultRuntimeImport = '@cv/handlebars-css-template/runtime'

export type CssTemplateLoaderOptions = Required<
  Pick<HandlebarsCssTemplatePluginOptions, 'extension' | 'runtimeImport'>
>

export const stripQuery = (id: string): string => id.replace(/\?.*$/u, '')

export const resolveCssTemplateLoaderOptions = (
  options: HandlebarsCssTemplatePluginOptions = {}
): CssTemplateLoaderOptions => ({
  extension: options.extension ?? defaultTemplateExtension,
  runtimeImport: options.runtimeImport ?? defaultRuntimeImport,
})

export const loadCssTemplateModule = async (
  id: string,
  options: CssTemplateLoaderOptions
): Promise<string | null> => {
  const filePath = stripQuery(id)

  if (!filePath.endsWith(options.extension)) {
    return null
  }

  const source = await readFile(filePath, 'utf8')
  const templateSpec = String(
    Handlebars.precompile(source, {
      strict: true,
    })
  )

  return createCssTemplateModuleSource({
    runtimeImport: options.runtimeImport,
    templateSpec,
  })
}
