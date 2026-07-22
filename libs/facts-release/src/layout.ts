const releaseIdPattern = /^fr_[a-f0-9]{64}$/u
const localePattern = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u
const sha256Pattern = /^[a-f0-9]{64}$/u

const checked = (value: string, pattern: RegExp, label: string) => {
  if (!pattern.test(value)) {
    throw new Error(`Invalid ${label}: ${value}`)
  }
  return value
}

export const factsCurrentObjectKey = 'current.json' as const

export const factsReleaseManifestObjectKey = (releaseId: string): string =>
  `releases/${checked(releaseId, releaseIdPattern, 'facts release ID')}/manifest.json`

export const factsReleaseCatalogueObjectKey = (
  releaseId: string,
  locale: string
): string =>
  `releases/${checked(releaseId, releaseIdPattern, 'facts release ID')}/locales/${checked(locale, localePattern, 'facts locale')}.json`

export const factsReleaseGenerationGuidanceObjectKey = (
  releaseId: string
): string =>
  `releases/${checked(releaseId, releaseIdPattern, 'facts release ID')}/generation/cv.json`

export const factsAssetObjectKey = (sha256: string): string =>
  `assets/sha256/${checked(sha256, sha256Pattern, 'facts asset digest')}`
