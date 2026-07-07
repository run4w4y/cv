import Handlebars from 'handlebars/runtime'

import type { CssTemplateContext, CssTemplateRenderer } from '../types'
import { cssString } from './css-string'

export type CssTemplateSpec = Parameters<typeof Handlebars.template>[0]

export const renderCssTemplate = <
  TContext extends CssTemplateContext = CssTemplateContext,
>(
  templateSpec: CssTemplateSpec,
  context: TContext
): string => {
  const template = Handlebars.template<TContext>(templateSpec)

  return template(context, {
    helpers: {
      cssString,
    },
  })
}

export type { CssTemplateContext, CssTemplateRenderer }
