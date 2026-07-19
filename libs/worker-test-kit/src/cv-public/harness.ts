import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import Handlebars from 'handlebars'
import type { Miniflare } from 'miniflare'

import {
  MiniflareTestEnvironment,
  workerTestCompatibilityDate,
} from '../miniflare/index.js'

export interface CvPublicWorkerHarnessOptions {
  readonly document: unknown
  readonly invalidDocument?: unknown
  readonly invalidToken?: string
  readonly notFoundTokens?: readonly string[]
  readonly revalidationSecret?: string
  readonly serverRoot: string
}

type TestWorker = Awaited<ReturnType<Miniflare['getWorker']>>

const encodeJson = (value: unknown) =>
  Buffer.from(JSON.stringify(value), 'utf8').toString('base64')

const readWorkerModule = async (workerPath: string) => {
  const upload = await readFile(workerPath)
  const firstLineEnd = upload.indexOf('\r\n')
  if (firstLineEnd < 2 || !upload.subarray(0, 2).equals(Buffer.from('--'))) {
    return upload.toString('utf8')
  }

  const boundary = upload.subarray(2, firstLineEnd).toString('utf8')
  const body = await new Response(upload, {
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  }).formData()
  const worker = body.get('worker.js')
  if (!(worker instanceof Blob)) {
    throw new Error('Wrangler upload does not contain worker.js.')
  }
  return worker.text()
}

interface RegistryStubTemplateContext {
  readonly document: string
  readonly invalidDocument: string
  readonly invalidToken: string
  readonly notFoundTokens: string
}

const registryStubTemplate = Handlebars.compile<RegistryStubTemplateContext>(
  `
import { WorkerEntrypoint } from 'cloudflare:workers'

const decode = (value) => JSON.parse(new TextDecoder().decode(
  Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
))
const document = decode('{{document}}')
const invalidDocument = decode('{{invalidDocument}}')
const invalidToken = {{invalidToken}}
const notFoundTokens = new Set({{notFoundTokens}})

const hex = (buffer) => Array.from(new Uint8Array(buffer), (byte) =>
  byte.toString(16).padStart(2, '0')
).join('')

const publication = async (token) => {
  const payload = token === invalidToken ? invalidDocument : document
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
    if (notFoundTokens.has(token)) {
      return new Response('Not found', { status: 404 })
    }
    return publication(token)
  }
}

export default { fetch: () => new Response('Not found', { status: 404 }) }
`,
  { noEscape: true, strict: true }
)

const registryStubScript = (
  document: unknown,
  invalidDocument: unknown,
  invalidToken: string,
  notFoundTokens: readonly string[]
) =>
  registryStubTemplate({
    document: encodeJson(document),
    invalidDocument: encodeJson(invalidDocument),
    invalidToken: JSON.stringify(invalidToken),
    notFoundTokens: JSON.stringify(notFoundTokens),
  })

/** Runs the Wrangler-bundled OpenNext Worker against a resolver Worker. */
export class CvPublicWorkerHarness {
  readonly #environment: MiniflareTestEnvironment
  readonly #publicWorker: TestWorker

  private constructor(
    environment: MiniflareTestEnvironment,
    publicWorker: TestWorker
  ) {
    this.#environment = environment
    this.#publicWorker = publicWorker
  }

  static async make(options: CvPublicWorkerHarnessOptions) {
    const publicWorkerName = 'cv-public-test'
    const registryWorkerName = 'registry-stub'
    const invalidToken = options.invalidToken ?? 'invalid-document'
    const workerPath = join(options.serverRoot, 'worker.js')
    const environment = await MiniflareTestEnvironment.make({
      workers: [
        {
          compatibilityDate: workerTestCompatibilityDate,
          compatibilityFlags: ['nodejs_compat'],
          bindings: {
            CV_REVALIDATION_SECRET:
              options.revalidationSecret ?? 'cv-revalidation-test-secret',
          },
          modules: [
            {
              contents: await readWorkerModule(workerPath),
              path: workerPath,
              type: 'ESModule',
            },
          ],
          modulesRoot: options.serverRoot,
          name: publicWorkerName,
          serviceBindings: {
            ASSETS: registryWorkerName,
            CV_PUBLIC_RESOLVER: {
              entrypoint: 'CvPublicResolver',
              name: registryWorkerName,
            },
          },
        },
        {
          compatibilityDate: workerTestCompatibilityDate,
          modules: true,
          name: registryWorkerName,
          script: registryStubScript(
            options.document,
            options.invalidDocument ?? options.document,
            invalidToken,
            options.notFoundTokens ?? ['disabled', 'missing']
          ),
        },
      ],
    })

    try {
      return new CvPublicWorkerHarness(
        environment,
        await environment.miniflare.getWorker(publicWorkerName)
      )
    } catch (error) {
      await environment.dispose()
      throw error
    }
  }

  fetch(
    input: Parameters<TestWorker['fetch']>[0],
    init?: Parameters<TestWorker['fetch']>[1]
  ) {
    return this.#publicWorker.fetch(input, init)
  }

  async dispose() {
    await this.#environment.dispose()
  }
}
