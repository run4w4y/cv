export type NormalizeContentKeyOptions = {
  readonly contentRoot?: string
}

const normalizePath = (path: string) =>
  path.replace(/\\/gu, '/').replace(/\/+$/u, '')

const stripRelativeContentRoot = (path: string, contentRoot: string) => {
  const relativePath = path
    .replace(/^\/+(?=\.\.?\/)/u, '')
    .replace(/^(?:\.\.?\/)+/u, '')

  if (relativePath === path) {
    return undefined
  }

  const rootSegments = contentRoot.split('/').filter(Boolean)
  const pathSegments = relativePath.split('/')

  for (let length = rootSegments.length; length > 0; length -= 1) {
    const rootSuffix = rootSegments.slice(-length)

    if (
      rootSuffix.length <= pathSegments.length &&
      rootSuffix.every((segment, index) => pathSegments[index] === segment)
    ) {
      return pathSegments.slice(rootSuffix.length).join('/')
    }
  }

  return undefined
}

export const normalizeContentKey = (
  path: string,
  options: NormalizeContentKeyOptions = {}
) => {
  const normalized = path.replace(/\\/gu, '/').replace(/^\/@fs/u, '')
  const contentRoot = options.contentRoot
    ? normalizePath(options.contentRoot)
    : undefined

  if (contentRoot && normalized.startsWith(`${contentRoot}/`)) {
    return normalized.slice(contentRoot.length + 1)
  }

  if (contentRoot) {
    const relative = stripRelativeContentRoot(normalized, contentRoot)

    if (relative) {
      return relative
    }
  }

  return normalized.replace(/^#content-source\//u, '').replace(/^\/+/u, '')
}
