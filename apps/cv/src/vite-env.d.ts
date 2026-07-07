declare module '*.css.hbs' {
  import type { CssTemplateRenderer } from '@cv/handlebars-css-template/runtime'

  const template: CssTemplateRenderer<Record<string, string>>

  export default template
}

interface ImportMetaEnv {
  readonly PUBLIC_CV_FULL_ACCESS_EMAIL?: string
}
