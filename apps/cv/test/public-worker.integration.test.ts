import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { Miniflare } from 'miniflare'

const applicationRoot = fileURLToPath(new URL('..', import.meta.url))
const serverRoot = join(applicationRoot, 'dist', 'server')

type EsModule = {
  readonly contents: string
  readonly path: string
  readonly type: 'ESModule'
}

const findModules = async (directory: string): Promise<readonly string[]> => {
  const entries = await readdir(directory, { withFileTypes: true })
  const paths = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name)
      return entry.isDirectory()
        ? findModules(path)
        : Promise.resolve(entry.name.endsWith('.mjs') ? [path] : [])
    })
  )
  return paths.flat().sort()
}

const serverModules = async (): Promise<readonly EsModule[]> =>
  Promise.all(
    [...(await findModules(serverRoot))]
      .sort((left, right) => {
        const leftMain = left.endsWith('/entry.mjs') ? 0 : 1
        const rightMain = right.endsWith('/entry.mjs') ? 0 : 1
        return leftMain - rightMain || left.localeCompare(right)
      })
      .map(async (path) => ({
        contents: await readFile(path, 'utf8'),
        path,
        type: 'ESModule',
      }))
  )

const registryStub = `
import { WorkerEntrypoint } from 'cloudflare:workers'

const document = {
  $schema: 'cv.document.v1',
  locale: 'en',
  direction: 'ltr',
  person: {
    name: 'Ada Lovelace',
    headline: 'Software engineer',
    summary: 'Builds dependable systems with clear reasoning.',
    contacts: [{
      kind: 'email',
      label: 'Email',
      value: 'ada@example.test',
      href: 'mailto:ada@example.test',
    }],
  },
  experience: [],
  projects: [],
  skills: [],
  education: [],
  additionalSections: [],
}

const hex = (buffer) => Array.from(new Uint8Array(buffer), (byte) =>
  byte.toString(16).padStart(2, '0')
).join('')

const publication = async (token) => {
  const payload = token === 'invalid-document'
    ? { ...document, rendererOwnedField: true }
    : document
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  const sha256 = hex(await crypto.subtle.digest('SHA-256', bytes))

  return new Response(bytes, {
    headers: {
      'content-type': 'application/json',
      'x-cv-content-byte-length': String(bytes.byteLength),
      'x-cv-content-sha256': sha256,
      'x-cv-contract-id': 'cv.document.v1',
      'x-cv-contract-version': '1',
      'x-cv-document-locale': 'en',
      'x-cv-public-url': 'https://cv.example.test/c/' + token,
    },
  })
}

export class CvPublicResolver extends WorkerEntrypoint {
  async fetch(request) {
    const token = new URL(request.url).pathname.split('/').at(-1)
    if (token === 'missing' || token === 'disabled') {
      return new Response('Not found', { status: 404 })
    }
    return publication(token)
  }
}

export default { fetch: () => new Response('Not found', { status: 404 }) }
`

let miniflare: Miniflare
let publicWorker: Awaited<ReturnType<Miniflare['getWorker']>>

before(async () => {
  const modules = await serverModules()
  miniflare = new Miniflare({
    workers: [
      {
        compatibilityDate: '2026-06-22',
        compatibilityFlags: ['nodejs_compat'],
        modules,
        modulesRoot: serverRoot,
        name: 'cv-public-test',
        serviceBindings: {
          ASSETS: 'registry-stub',
          CV_PUBLIC_RESOLVER: {
            entrypoint: 'CvPublicResolver',
            name: 'registry-stub',
          },
        },
      },
      {
        compatibilityDate: '2026-06-22',
        modules: true,
        name: 'registry-stub',
        script: registryStub,
      },
    ],
  })
  await miniflare.ready
  publicWorker = await miniflare.getWorker('cv-public-test')
})

after(async () => {
  await miniflare.dispose()
})

test('renders a valid publication through the named service binding', async () => {
  const response = await publicWorker.fetch(
    'https://cv.example.test/c/valid-token'
  )
  const html = await response.text()

  assert.equal(response.status, 200)
  assert.match(html, /Ada Lovelace/u)
  assert.match(html, /cv2-document/u)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.match(response.headers.get('x-robots-tag') ?? '', /noindex/u)
})

test('returns 404 for missing and disabled publications', async () => {
  for (const token of ['missing', 'disabled']) {
    const response = await publicWorker.fetch(
      `https://cv.example.test/c/${token}`
    )
    assert.equal(response.status, 404)
    assert.match(await response.text(), /CV not found/u)
  }
})

test('refuses to render an invalid document', async () => {
  const response = await publicWorker.fetch(
    'https://cv.example.test/c/invalid-document'
  )

  assert.equal(response.status, 502)
  assert.match(await response.text(), /CV unavailable/u)
})

test('returns 404 outside the exact /c/:token route', async () => {
  for (const path of ['/', '/en', '/c/valid-token/', '/c/a/b', '/_image']) {
    const response = await publicWorker.fetch(`https://cv.example.test${path}`)
    assert.equal(response.status, 404, path)
  }
})
