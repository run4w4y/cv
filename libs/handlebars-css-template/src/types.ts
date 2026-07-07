export type CssTemplateContext = Readonly<Record<string, unknown>>

export type CssTemplateRenderer<
  TContext extends CssTemplateContext = CssTemplateContext,
> = (context: TContext) => string

export type HandlebarsCssTemplatePluginOptions = {
  extension?: string
  runtimeImport?: string
}
