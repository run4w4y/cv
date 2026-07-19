import assert from 'node:assert/strict'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { CvPublicWorkerHarness } from '@cv/worker-test-kit/cv-public'

const applicationRoot = fileURLToPath(new URL('..', import.meta.url))
const serverRoot = join(applicationRoot, 'dist', 'server')

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

let harness: CvPublicWorkerHarness

before(async () => {
  harness = await CvPublicWorkerHarness.make({
    document,
    invalidDocument: { ...document, rendererOwnedField: true },
    serverRoot,
  })
})

after(async () => {
  await harness.dispose()
})

test('renders a valid publication through the named service binding', async () => {
  const response = await harness.fetch('https://cv.example.test/c/valid-token')
  const html = await response.text()

  assert.equal(response.status, 200)
  assert.match(html, /Ada Lovelace/u)
  assert.match(html, /cv2-document/u)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.match(response.headers.get('x-robots-tag') ?? '', /noindex/u)
})

test('returns 404 for missing and disabled publications', async () => {
  for (const token of ['missing', 'disabled']) {
    const response = await harness.fetch(`https://cv.example.test/c/${token}`)
    assert.equal(response.status, 404)
    assert.match(await response.text(), /CV not found/u)
  }
})

test('refuses to render an invalid document', async () => {
  const response = await harness.fetch(
    'https://cv.example.test/c/invalid-document'
  )

  assert.equal(response.status, 502)
  assert.match(await response.text(), /CV unavailable/u)
})

test('returns 404 outside the exact /c/:token route', async () => {
  for (const path of ['/', '/en', '/c/valid-token/', '/c/a/b', '/_image']) {
    const response = await harness.fetch(`https://cv.example.test${path}`)
    assert.equal(response.status, 404, path)
  }
})
