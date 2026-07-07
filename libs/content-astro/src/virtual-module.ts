import type { ContentArtifacts } from '@cv/content-build'
import {
  renderGeneratedModuleTemplate,
  renderRuntimeModuleTemplate,
} from './templates'

const virtualModuleId = 'virtual:content/generated'
const runtimeVirtualModuleSegment = 'runtime'
const privateRuntimeProfileVirtualModuleSegment = 'private-runtime'

export const contentVirtualModuleId = virtualModuleId
export const resolvedContentVirtualModuleId = `\0${virtualModuleId}`
export const contentRuntimeVirtualModuleId = `${virtualModuleId}/${runtimeVirtualModuleSegment}`
export const resolvedContentRuntimeVirtualModuleId = `\0${contentRuntimeVirtualModuleId}`
export const contentPrivateRuntimeProfileVirtualModulePrefix = `${virtualModuleId}/${privateRuntimeProfileVirtualModuleSegment}/`
export const resolvedContentPrivateRuntimeProfileVirtualModulePrefix = `\0${contentPrivateRuntimeProfileVirtualModulePrefix}`

const js = (value: unknown) => JSON.stringify(value)

const privateRuntimeProfileVirtualModuleId = ({
  locale,
  selector,
}: {
  locale: string
  selector: string
}) =>
  `${contentPrivateRuntimeProfileVirtualModulePrefix}${encodeURIComponent(
    locale
  )}/${selector}`

export const parseContentPrivateRuntimeProfileVirtualModuleId = (
  id: string
) => {
  if (!id.startsWith(resolvedContentPrivateRuntimeProfileVirtualModulePrefix)) {
    return null
  }

  const relative = id.slice(
    resolvedContentPrivateRuntimeProfileVirtualModulePrefix.length
  )
  const [encodedLocale, selector, ...rest] = relative.split('/')

  if (!encodedLocale || !selector || rest.length > 0) {
    return null
  }

  return {
    locale: decodeURIComponent(encodedLocale),
    selector,
  }
}

export const createContentVirtualModuleSource = (artifacts: ContentArtifacts) =>
  renderGeneratedModuleTemplate(createContentVirtualModuleContext(artifacts))

export const createContentRuntimeVirtualModuleSource = (
  artifacts: ContentArtifacts
) =>
  renderRuntimeModuleTemplate(
    createContentRuntimeVirtualModuleContext(artifacts)
  )

const privateRuntimeProfileLoaders = (artifacts: ContentArtifacts) => {
  const entriesByLocale = new Map<string, string[]>()

  for (const profile of artifacts.privateManifest.profiles) {
    const entries = entriesByLocale.get(profile.locale) ?? []

    entries.push(
      `${js(profile.selector)}: () => import(${js(
        privateRuntimeProfileVirtualModuleId({
          locale: profile.locale,
          selector: profile.selector,
        })
      )}).then((module) => module.privateRuntimeProfile)`
    )
    entriesByLocale.set(profile.locale, entries)
  }

  return `{
${[...entriesByLocale.entries()]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(
    ([locale, entries]) =>
      `  ${js(locale)}: {\n    ${entries.join(',\n    ')}\n  }`
  )
  .join(',\n')}
}`
}

export const createContentPrivateRuntimeProfileVirtualModuleSource = (
  artifacts: ContentArtifacts,
  {
    locale,
    selector,
  }: {
    locale: string
    selector: string
  }
) => {
  const profile = artifacts.privateManifest.profiles.find(
    (profile) => profile.locale === locale && profile.selector === selector
  )

  if (!profile) {
    throw new Error(
      `Missing private runtime profile payload for ${locale}/${selector}`
    )
  }

  return `export const privateRuntimeProfile = ${js(profile)}
export default privateRuntimeProfile
`
}

const createContentRuntimeVirtualModuleContext = (
  artifacts: ContentArtifacts
) => {
  const { fileIndex, snapshot } = artifacts

  return {
    defaultLocale: js(snapshot.defaultLocale),
    defaultProfileSlug: js(snapshot.defaultProfileSlug),
    fileIndex: js(fileIndex),
    manifest: js(snapshot.manifest),
    privateRuntimeProfileLoaders: privateRuntimeProfileLoaders(artifacts),
  }
}

const createContentVirtualModuleContext = (artifacts: ContentArtifacts) => {
  const { snapshot } = artifacts

  return {
    locales: js(snapshot.manifest.locales),
    privateRoutes: js(snapshot.privateRoutes),
  }
}
