import { expect, test } from '@playwright/test'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

const fixturePath = '/c/fixture'
const previewPath = '/c/_preview/fixture?access=fixture-preview'
const overflowPreviewPath =
  '/c/_preview/fixture-overflow?access=fixture-overflow-preview'
const colorSchemeStorageKey = 'cv:color-scheme:v1'
const fixturePort = Number(process.env.CV_E2E_PORT ?? 4381)
const fixturePublicUrl = `http://localhost:${fixturePort}/c/fixture`

const inspectPdf = async (bytes: Uint8Array) => {
  const loadingTask = getDocument({ data: bytes })
  try {
    const pdf = await loadingTask.promise
    const pages = await Promise.all(
      Array.from({ length: pdf.numPages }, async (_, index) => {
        const page = await pdf.getPage(index + 1)
        const content = await page.getTextContent()
        return content.items
          .flatMap((item) => ('str' in item ? [item.str] : []))
          .join('\n')
      })
    )
    const metadata = await pdf.getMetadata()

    return {
      pageCount: pdf.numPages,
      text: pages.join('\n'),
      title: String(metadata.info.Title ?? ''),
    }
  } finally {
    await loadingTask.destroy()
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((storageKey) => {
    const resetMarker = `${storageKey}:playwright-reset`

    if (window.sessionStorage.getItem(resetMarker) === null) {
      window.localStorage.removeItem(storageKey)
      window.sessionStorage.setItem(resetMarker, '1')
    }
  }, colorSchemeStorageKey)
})

test('renders the complete fixture through the public application route', async ({
  page,
}) => {
  const response = await page.goto(fixturePath)

  expect(response?.status()).toBe(200)
  await expect(page).toHaveTitle('Ada Lovelace — CV')
  await expect(page.locator('[data-cv-web-document]')).toBeVisible()
  await expect(page.locator('[data-cv-pdf-document]')).toBeHidden()
  await expect(page.locator('[data-cv-document]')).toHaveCount(1)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Ada Lovelace'
  )
  await expect(
    page.getByRole('heading', { level: 2, name: 'Experience' })
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { level: 2, name: 'Selected projects' })
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { level: 2, name: 'Skills' })
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { level: 2, name: 'Education' })
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'github.com/ada' })
  ).toHaveAttribute('href', 'https://github.com/ada')

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  )
  expect(horizontalOverflow).toBeLessThanOrEqual(1)

  const csp = response?.headers()['content-security-policy'] ?? ''
  expect(csp).toContain("'nonce-")
  expect(csp.match(/script-src[^;]+/u)?.[0]).not.toContain("'unsafe-inline'")
})

test('behaves as a navigable website instead of an A4 sheet', async ({
  page,
}) => {
  await page.goto(fixturePath)

  const website = page.locator('[data-cv-web-document]')
  const header = page.locator('.cv-web-header')
  const experience = page.locator('#cv-web-experience')

  await expect(website).not.toHaveCSS('width', '793.688px')
  await expect(header).toHaveCSS('position', 'sticky')
  await page
    .locator('.cv-web-index')
    .getByRole('link', { name: /Experience/u })
    .click()
  await expect(page).toHaveURL(/#cv-web-experience$/u)
  await expect(experience).toBeInViewport()
})

test('renders the single-column A4 capability preview without interactive controls', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop')

  const response = await page.goto(previewPath)

  expect(response?.status()).toBe(200)
  await expect(page).toHaveTitle('Ada Lovelace — CV')
  await expect(page.locator('[data-cv-document]')).toHaveAttribute(
    'data-cv-renderer-mode',
    'print-preview'
  )
  await expect(page.getByRole('group', { name: 'Color scheme' })).toHaveCount(0)
  await expect(page.locator('[data-cv-web-document]')).toHaveCount(0)
  const document = page.locator('[data-cv-pdf-document]')
  await expect(document).toBeVisible()
  await expect(page.locator('[data-cv-print-only]')).toBeVisible()
  await expect(page.locator('[data-cv-public-url]')).toHaveAttribute(
    'href',
    fixturePublicUrl
  )
  await expect(page.locator('.cv2-qr')).toHaveCount(0)
  await expect(page.locator('.cv2-column')).toHaveCount(0)
  await expect(page.locator('.cv2-layout')).toHaveCSS('display', 'block')
  await expect(document).toHaveCSS('font-family', /Arimo/u)
  await expect(page.locator('.cv2-entry-list').first()).toHaveCSS(
    'padding-inline-start',
    '0px'
  )

  const [documentBox, sectionBoxes] = await Promise.all([
    document.boundingBox(),
    page.locator('.cv2-layout > .cv2-section').evaluateAll((sections) =>
      sections.map((section) => {
        const rectangle = section.getBoundingClientRect()
        return { left: rectangle.left, width: rectangle.width }
      })
    ),
  ])
  if (documentBox === null || sectionBoxes.length < 4) {
    throw new Error('Expected measurable PDF layout bounds')
  }

  const pagePadding = await document.evaluate((element) => {
    const style = getComputedStyle(element)

    return [
      style.paddingTop,
      style.paddingRight,
      style.paddingBottom,
      style.paddingLeft,
    ].map(Number.parseFloat)
  })
  const millimetresToCssPixels = (millimetres: number) =>
    (millimetres * 96) / 25.4
  expect(pagePadding[0]).toBeCloseTo(millimetresToCssPixels(12), 1)
  expect(pagePadding[1]).toBeCloseTo(millimetresToCssPixels(14), 1)
  expect(pagePadding[2]).toBeCloseTo(millimetresToCssPixels(12), 1)
  expect(pagePadding[3]).toBeCloseTo(millimetresToCssPixels(14), 1)

  for (const sectionBox of sectionBoxes) {
    expect(sectionBox.left).toBeCloseTo(sectionBoxes[0]?.left ?? 0, 1)
    expect(sectionBox.width).toBeCloseTo(sectionBoxes[0]?.width ?? 0, 1)
  }

  const minimumTextSize = await page
    .locator('.cv2-chip')
    .first()
    .evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize)
    )
  expect(minimumTextSize).toBeGreaterThanOrEqual(12)
})

test('switches the public route to its dedicated PDF tree for printing', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop')

  await page.goto(fixturePath)
  await page.emulateMedia({ colorScheme: 'dark', media: 'print' })

  await expect(page.locator('[data-cv-web-document]')).toBeHidden()
  await expect(page.locator('[data-cv-pdf-document]')).toBeVisible()
  await expect(page.locator('[data-cv-pdf-document]')).toHaveCSS(
    'background-color',
    'rgb(255, 255, 255)'
  )
})

test('generates an ordered two-page ATS PDF with safe metadata', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop')

  await page.goto(previewPath)
  await page.emulateMedia({ media: 'print' })
  const bytes = await page.pdf({
    format: 'A4',
    preferCSSPageSize: true,
    printBackground: true,
  })
  const pdf = await inspectPdf(new Uint8Array(bytes))

  expect(bytes.subarray(0, 4).toString()).toBe('%PDF')
  expect(bytes.byteLength).toBeGreaterThan(10_000)
  expect(pdf.pageCount).toBe(2)
  expect(pdf.title).toBe('Ada Lovelace — CV')
  expect(pdf.title).not.toContain('access=')
  expect(pdf.text).toContain('Selected projects')
  expect(pdf.text).toContain('Current web CV')
  expect(pdf.text).toContain(fixturePublicUrl)
  expect(pdf.text).not.toContain('PROJ ECTS')
  expect(pdf.text).not.toContain('COMM U NIT Y')

  const orderedSections = [
    'Experience',
    'Selected projects',
    'Skills',
    'Education',
    'Languages',
    'Community',
  ]
  const sectionOffsets = orderedSections.map((section) =>
    pdf.text.indexOf(section)
  )
  expect(sectionOffsets.every((offset) => offset >= 0)).toBe(true)
  expect(sectionOffsets).toEqual([...sectionOffsets].toSorted((a, b) => a - b))
})

test('keeps a deliberate overflow fixture above the two-page guard', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop')

  await page.goto(overflowPreviewPath)
  await page.emulateMedia({ media: 'print' })
  const bytes = await page.pdf({
    format: 'A4',
    preferCSSPageSize: true,
    printBackground: true,
  })
  const pdf = await inspectPdf(new Uint8Array(bytes))

  expect(pdf.pageCount).toBeGreaterThan(2)
})

test('switches and persists explicit color-scheme preferences', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto(fixturePath)

  const root = page.locator('html')
  const dark = page.getByRole('button', { name: 'Dark' })
  const light = page.getByRole('button', { name: 'Light' })

  await dark.focus()
  await dark.press('Enter')
  await expect(root).toHaveAttribute('data-color-scheme', 'dark')
  await expect(root).toHaveClass(/(?:^|\s)dark(?:\s|$)/u)
  await expect(dark).toHaveAttribute('aria-pressed', 'true')
  expect(
    await page.evaluate(
      (key) => localStorage.getItem(key),
      colorSchemeStorageKey
    )
  ).toBe('dark')

  await page.reload()
  await expect(root).toHaveAttribute('data-color-scheme', 'dark')
  await expect(dark).toHaveAttribute('aria-pressed', 'true')

  await light.focus()
  await light.press('Space')
  await expect(root).toHaveAttribute('data-color-scheme', 'light')
  await expect(root).not.toHaveClass(/(?:^|\s)dark(?:\s|$)/u)
})

test('tracks the operating-system scheme while system is selected', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto(fixturePath)

  const root = page.locator('html')
  const system = page.getByRole('button', { name: 'System' })
  await expect(system).toHaveAttribute('aria-pressed', 'true')
  await expect(root).toHaveAttribute('data-color-scheme', 'system')
  await expect(root).not.toHaveClass(/(?:^|\s)dark(?:\s|$)/u)

  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(root).toHaveClass(/(?:^|\s)dark(?:\s|$)/u)
  await expect(root).toHaveAttribute('data-color-scheme', 'system')
})

test('returns not found for unknown fixture capabilities', async ({ page }) => {
  const publicResponse = await page.goto('/c/missing')
  expect(publicResponse?.status()).toBe(404)
  await expect(
    page.getByRole('heading', { name: 'CV not found' })
  ).toBeVisible()

  const previewResponse = await page.goto(
    '/c/_preview/fixture?access=wrong-preview-capability'
  )
  expect(previewResponse?.status()).toBe(404)
})
