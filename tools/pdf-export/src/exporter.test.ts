import { describe, expect, test } from 'bun:test'
import { Effect, Layer } from 'effect'
import {
  exportProfilePdfs,
  PdfExporter,
  type PdfExporterService,
  privatePreviewPath,
  privatePrintUrl,
  publicPreviewPath,
  publicPrintUrl,
} from './exporter'
import type { ProfilePdfBatchExportRequest } from './model'

describe('PDF exporter programmatic API', () => {
  test('keeps print URL overrides out of preview navigation', () => {
    const webBaseUrl = new URL('https://cv.example.com/root/')

    expect(
      privatePreviewPath({
        audienceId: 'audience/id',
        locale: 'en',
        token: 'token+value',
      })
    ).toBe('/en/a/#audience=audience%2Fid&p=token%2Bvalue')
    expect(publicPreviewPath('en')).toBe('/en/')
    expect(
      privatePrintUrl({
        audienceId: 'audience/id',
        locale: 'en',
        token: 'token+value',
        webBaseUrl,
      })
    ).toBe('https://cv.example.com/root/en/a/audience%2Fid/?p=token%2Bvalue')
    expect(publicPrintUrl('en', webBaseUrl)).toBe(
      'https://cv.example.com/root/en/'
    )
  })

  test('delegates batch requests through the Effect service', async () => {
    let received: ProfilePdfBatchExportRequest | undefined
    const request = {
      items: [
        {
          audienceId: 'audience-id',
          locale: 'en',
          token: 'token',
        },
      ],
      outputDir: '/tmp/pdfs',
      webBaseUrl: new URL('https://cv.example.com'),
    } satisfies ProfilePdfBatchExportRequest
    const layer = Layer.succeed(PdfExporter, {
      exportProfile: () => Effect.die('unused'),
      exportProfiles: (input) => {
        received = input
        return Effect.succeed([
          {
            audienceId: 'audience-id',
            locale: 'en',
            outputPath: '/tmp/pdfs/cv-en-audience-id.pdf',
            previewPath: '/en/a/',
          },
        ])
      },
      exportPublic: () => Effect.die('unused'),
    } satisfies PdfExporterService)

    const result = await Effect.runPromise(
      exportProfilePdfs(request).pipe(Effect.provide(layer))
    )

    expect(received).toBe(request)
    expect(result[0]?.outputPath).toBe('/tmp/pdfs/cv-en-audience-id.pdf')
  })
})
