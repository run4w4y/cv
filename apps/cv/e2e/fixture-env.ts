import { fileURLToPath } from 'node:url'

export const e2eFixtureRoot = fileURLToPath(
  new URL('../../../fixtures/cv-content-e2e', import.meta.url)
)

export const e2eDistDir = fileURLToPath(
  new URL('../../../.cv-work/cv-e2e-dist', import.meta.url)
)

export const e2eFixtureAccessEmail = 'full-access.fixture@example.invalid'
export const e2eFixtureBaseUrl = 'https://cv.example.invalid'
export const e2eFixtureContentIdSalt = 'cv-e2e-fixture-salt'
export const e2eFixturePrivateCanaries = [
  'E2E_PRIVATE_DETAIL_CANARY_EN',
  'E2E_PRIVATE_DETAIL_CANARY_RU',
  'E2E_PRIVATE_SECTION_CANARY_EN',
  'E2E_PRIVATE_SECTION_CANARY_RU',
] as const

const e2eFixtureRootKey =
  'base64url:AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA'

export const e2eFixtureEnv = {
  CONTENT_ID_SALT: e2eFixtureContentIdSalt,
  CONTENT_ROOT: e2eFixtureRoot,
  CV_ASTRO_OUT_DIR: e2eDistDir,
  PRIVATE_CONTENT_AUDIENCE_KEY: 'cv-e2e-fixture-audience-key',
  PRIVATE_CONTENT_ROOT_KEY: e2eFixtureRootKey,
  PUBLIC_CV_FULL_ACCESS_EMAIL: e2eFixtureAccessEmail,
  PUBLIC_CV_WEB_BASE_URL: e2eFixtureBaseUrl,
} as const satisfies Record<string, string>
