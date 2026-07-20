import assert from 'node:assert/strict'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { CvPublicWorkerHarness } from '@cv/worker-test-kit/cv-public'

const applicationRoot = fileURLToPath(new URL('..', import.meta.url))
const serverRoot = join(applicationRoot, '.open-next', 'deploy-check')

const document = {
  $schema: 'cv.document.v1',
  locale: 'en',
  direction: 'ltr',
  person: {
    name: 'Ada Lovelace',
    headline: 'Software engineer',
    summary: 'Builds dependable systems with clear reasoning.',
    contacts: [
      {
        kind: 'email',
        label: 'Email',
        value: 'ada@example.test',
        href: 'mailto:ada@example.test',
      },
    ],
  },
  experience: [],
  projects: [],
  skills: [],
  education: [],
  additionalSections: [],
}

let harness: CvPublicWorkerHarness | undefined

const publicWorker = () => {
  if (harness === undefined) throw new Error('The public Worker is not ready.')
  return harness
}

before(async () => {
  harness = await CvPublicWorkerHarness.make({
    document,
    invalidDocument: { ...document, rendererOwnedField: true },
    serverRoot,
  })
})

after(async () => {
  await harness?.dispose()
})

test('renders a valid publication through the named service binding', async () => {
  const response = await publicWorker().fetch(
    'https://cv.example.test/c/valid-token'
  )
  const html = await response.text()

  assert.equal(response.status, 200)
  assert.match(html, /Ada Lovelace/u)
  assert.match(html, /cv2-document/u)
  assert.match(html, /href="\/c\/_next\/static\/[^"]+\.css/u)
  assert.doesNotMatch(html, /data-cv-renderer-styles/u)
  assert.match(html, /data-cv-public-url="https:\/\/cv\.example\.test/u)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.equal(response.headers.get('cdn-cache-control'), null)
  assert.equal(response.headers.get('cloudflare-cdn-cache-control'), null)
  assert.equal(response.headers.get('cache-tag'), null)
  assert.match(response.headers.get('x-robots-tag') ?? '', /noindex/u)
  assert.equal(
    response.headers
      .get('content-security-policy')
      ?.includes("'unsafe-inline'"),
    false
  )
})

test('returns 404 for missing and disabled publications', async () => {
  for (const token of ['missing', 'disabled']) {
    const response = await publicWorker().fetch(
      `https://cv.example.test/c/${token}`
    )
    assert.equal(response.status, 404)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.match(await response.text(), /CV not found/u)
  }
})

test('refuses to render an invalid document', async () => {
  const response = await publicWorker().fetch(
    'https://cv.example.test/c/invalid-document'
  )

  assert.equal(response.status, 500)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.match(await response.text(), /CV unavailable/u)
})

test('returns 404 outside the exact /c/:token route', async () => {
  for (const path of ['/c/valid-token/', '/c/a/b']) {
    const response = await publicWorker().fetch(
      `https://cv.example.test${path}`
    )
    assert.equal(response.status, 404, path)
  }
})

test('renders capability previews without shared caching', async () => {
  const response = await publicWorker().fetch(
    'https://cv.example.test/c/_preview/valid-token?access=preview-secret'
  )

  assert.equal(response.status, 200)
  assert.match(await response.text(), /Ada Lovelace/u)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer')
  assert.match(response.headers.get('x-robots-tag') ?? '', /noindex/u)
  assert.equal(response.headers.get('cloudflare-cdn-cache-control'), null)
  assert.equal(response.headers.get('cache-tag'), null)
  assert.equal(
    response.headers
      .get('content-security-policy')
      ?.includes("'unsafe-inline'"),
    false
  )
})

test('rejects query parameters on public pages before rendering', async () => {
  const response = await publicWorker().fetch(
    'https://cv.example.test/c/valid-token?access=not-a-public-capability'
  )

  assert.equal(response.status, 404)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
})

test('rejects unauthorized cache invalidation requests', async () => {
  const input = {
    body: JSON.stringify({ token: 'valid-token' }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  }
  const unauthorized = await publicWorker().fetch(
    'https://cv.example.test/c/_internal/revalidate',
    input
  )
  assert.equal(unauthorized.status, 401)
  assert.equal(unauthorized.headers.get('cache-control'), 'private, no-store')
})
