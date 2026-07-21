import { completeCvDocument } from '@/fixtures/complete'
import { overflowCvDocument } from '@/fixtures/overflow'
import type { CvPublicationLoadResult } from '@/lib/publication'

export const cvFixtureToken = 'fixture'
export const cvFixturePreviewToken = 'fixture-preview'
export const cvOverflowFixtureToken = 'fixture-overflow'
export const cvOverflowFixturePreviewToken = 'fixture-overflow-preview'

interface CvFixtureEnvironment {
  readonly CV_FIXTURE_MODE?: string
  readonly NODE_ENV?: string
}

const defaultFixturePublicUrl = `http://localhost:4381/c/${cvFixtureToken}`

const fixturePublicUrl = () =>
  process.env.CV_FIXTURE_PUBLIC_URL?.trim() || defaultFixturePublicUrl

const fixturePublication = (
  document = completeCvDocument,
  publicUrl = fixturePublicUrl()
): CvPublicationLoadResult => ({
  document,
  publicUrl,
  tag: 'success',
})

const overflowFixturePublication = (): CvPublicationLoadResult =>
  fixturePublication(
    overflowCvDocument,
    fixturePublicUrl().replace(/\/fixture$/u, `/${cvOverflowFixtureToken}`)
  )

export const isCvFixtureModeEnabled = (
  environment: CvFixtureEnvironment = process.env
) =>
  environment.NODE_ENV === 'development' && environment.CV_FIXTURE_MODE === '1'

export const loadCvFixturePublication = (
  token: string
): CvPublicationLoadResult =>
  token === cvFixtureToken
    ? fixturePublication()
    : token === cvOverflowFixtureToken
      ? overflowFixturePublication()
      : { tag: 'not-found' }

export const loadCvFixturePreview = (
  token: string,
  previewToken: string
): CvPublicationLoadResult =>
  token === cvFixtureToken && previewToken === cvFixturePreviewToken
    ? fixturePublication()
    : token === cvOverflowFixtureToken &&
        previewToken === cvOverflowFixturePreviewToken
      ? overflowFixturePublication()
      : { tag: 'not-found' }
