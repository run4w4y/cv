export type CssTemplateModuleSourceInput = {
  runtimeImport: string
  templateSpec: string
}

export const createCssTemplateModuleSource = ({
  runtimeImport,
  templateSpec,
}: CssTemplateModuleSourceInput): string =>
  [
    `import { renderCssTemplate } from ${JSON.stringify(runtimeImport)}`,
    `const templateSpec = ${templateSpec}`,
    'const renderTemplate = (context) =>',
    '  renderCssTemplate(templateSpec, context)',
    'export default renderTemplate',
    '',
  ].join('\n')
