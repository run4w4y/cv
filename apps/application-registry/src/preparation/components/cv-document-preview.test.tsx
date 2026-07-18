import { afterEach, describe, expect, mock, test } from 'bun:test'
import type { CvDocumentV1 } from '@cv/contracts/document'
import type { CvPageLayoutAssessment } from '@cv/renderer'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'

import { CvDocumentPreview } from './cv-document-preview'

const document: CvDocumentV1 = {
  $schema: 'cv.document.v1',
  additionalSections: [],
  direction: 'ltr',
  education: [],
  experience: [],
  locale: 'en',
  person: {
    contacts: [
      {
        href: 'mailto:ada@example.test',
        kind: 'email',
        label: 'Email',
        value: 'ada@example.test',
      },
    ],
    headline: 'Platform engineer',
    name: 'Ada Example',
    summary: 'Builds reliable systems.',
  },
  projects: [],
  skills: [],
}

afterEach(cleanup)

const rectangle = (width: number, height: number): DOMRect => ({
  bottom: height,
  height,
  left: 0,
  right: width,
  toJSON: () => ({}),
  top: 0,
  width,
  x: 0,
  y: 0,
})

describe('CvDocumentPreview', () => {
  test('remeasures a fit-to-fit edit when ResizeObserver emits no notification', async () => {
    const onPageLayoutChange = mock(
      (_assessment: CvPageLayoutAssessment | null) => undefined
    )
    const view = render(
      <CvDocumentPreview
        document={document}
        onPageLayoutChange={onPageLayoutChange}
        publicUrl="https://cv.example.test/c/token"
      />
    )
    const frame = view.getByTitle(
      'Live CV document preview'
    ) as HTMLIFrameElement
    const frameDocument = frame.contentDocument
    const frameWindow = frame.contentWindow
    if (frameDocument === null || frameWindow === null) {
      throw new Error('Expected a same-origin preview frame.')
    }
    const frameGlobals = frameWindow as Window & typeof globalThis

    Object.defineProperty(frameDocument, 'fonts', {
      configurable: true,
      value: { ready: Promise.resolve() },
    })
    Object.defineProperty(frameWindow, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        queueMicrotask(() => callback(performance.now()))
        return 1
      },
    })
    Object.defineProperty(frameWindow, 'cancelAnimationFrame', {
      configurable: true,
      value: () => undefined,
    })
    Object.defineProperty(
      frameGlobals.HTMLElement.prototype,
      'getBoundingClientRect',
      {
        configurable: true,
        value(this: HTMLElement) {
          return this.hasAttribute('data-cv-document')
            ? rectangle(780, 1_100)
            : rectangle(800, 1_120)
        },
      }
    )
    Object.defineProperty(frameGlobals.HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get(this: HTMLElement) {
        return this.hasAttribute('data-cv-document') ? 1_100 : 0
      },
    })
    Object.defineProperty(frameGlobals.HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get(this: HTMLElement) {
        return this.hasAttribute('data-cv-document') ? 780 : 0
      },
    })
    Object.defineProperty(frameWindow, 'ResizeObserver', {
      configurable: true,
      value: class SilentResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    })

    fireEvent.load(frame)

    await waitFor(() =>
      expect(
        onPageLayoutChange.mock.calls.some(
          ([assessment]) => assessment?.status === 'fits'
        )
      ).toBe(true)
    )
    const callCountBeforeEdit = onPageLayoutChange.mock.calls.length

    view.rerender(
      <CvDocumentPreview
        document={{
          ...document,
          person: {
            ...document.person,
            summary: 'Builds reliable distributed systems.',
          },
        }}
        onPageLayoutChange={onPageLayoutChange}
        publicUrl="https://cv.example.test/c/token"
      />
    )

    await waitFor(() =>
      expect(onPageLayoutChange.mock.calls.length).toBeGreaterThan(
        callCountBeforeEdit + 1
      )
    )
    expect(onPageLayoutChange.mock.calls[callCountBeforeEdit]?.[0]).toBeNull()
    expect(
      onPageLayoutChange.mock.calls
        .slice(callCountBeforeEdit + 1)
        .some(([assessment]) => assessment?.status === 'fits')
    ).toBe(true)
  })
})
