import { expect, test } from '@playwright/test'

const fixturePath = '/c/fixture'
const previewPath = '/c/_preview/fixture?access=fixture-preview'
const overflowPreviewPath =
  '/c/_preview/fixture-overflow?access=fixture-overflow-preview'
const colorSchemeStorageKey = 'cv:color-scheme:v1'

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

test('renders the A4 capability preview without interactive controls', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop')

  const response = await page.goto(previewPath)

  expect(response?.status()).toBe(200)
  await expect(page.locator('[data-cv-document]')).toHaveAttribute(
    'data-cv-renderer-mode',
    'print-preview'
  )
  await expect(page.getByRole('group', { name: 'Color scheme' })).toHaveCount(0)
  await expect(page.locator('[data-cv-web-document]')).toHaveCount(0)
  const document = page.locator('[data-cv-pdf-document]')
  await expect(document).toBeVisible()
  await expect(page.locator('[data-cv-print-only]')).toBeVisible()
  await expect(page.locator('.cv2-entry-list').first()).toHaveCSS(
    'padding-inline-start',
    '0px'
  )

  const [documentBox, headerBox, qrBox, mainColumnBox, sidebarColumnBox] =
    await Promise.all([
      document.boundingBox(),
      page.locator('.cv2-header').boundingBox(),
      page.locator('.cv2-qr').boundingBox(),
      page.locator('.cv2-column').nth(0).boundingBox(),
      page.locator('.cv2-column').nth(1).boundingBox(),
    ])
  if (
    documentBox === null ||
    headerBox === null ||
    qrBox === null ||
    mainColumnBox === null ||
    sidebarColumnBox === null
  ) {
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
  const expectedPaddingInCssPixels = (8 * 96) / 25.4
  for (const padding of pagePadding) {
    expect(padding).toBeCloseTo(expectedPaddingInCssPixels, 1)
  }

  const columnRatio = mainColumnBox.width / sidebarColumnBox.width
  expect(columnRatio).toBeGreaterThan(1.75)
  expect(columnRatio).toBeLessThan(2)
  expect(qrBox.x).toBeGreaterThan(documentBox.x + documentBox.width / 2)
  expect(qrBox.y).toBeGreaterThanOrEqual(headerBox.y)
  expect(qrBox.y + qrBox.height).toBeLessThanOrEqual(
    headerBox.y + headerBox.height
  )

  await expect(page).toHaveScreenshot('print-preview.png', {
    animations: 'disabled',
    fullPage: true,
  })
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

  const pdf = await page.pdf({ format: 'A4', printBackground: true })
  expect(pdf.subarray(0, 4).toString()).toBe('%PDF')
  expect(pdf.byteLength).toBeGreaterThan(10_000)
})

test('keeps a deliberate overflow fixture to exercise the PDF guard', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop')

  await page.goto(overflowPreviewPath)
  const measurement = await page
    .locator('[data-cv-pdf-document]')
    .evaluate((element) => {
      const probe = document.createElement('div')
      probe.style.cssText =
        'position:fixed;left:-10000px;width:210mm;height:297mm;visibility:hidden'
      document.documentElement.appendChild(probe)
      const pageHeight = probe.getBoundingClientRect().height
      probe.remove()
      return {
        pageHeight,
        renderedHeight: element.getBoundingClientRect().height,
        scrollHeight: element.scrollHeight,
      }
    })

  expect(
    Math.max(measurement.renderedHeight, measurement.scrollHeight)
  ).toBeGreaterThan(measurement.pageHeight)
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

test('matches the website light and dark visual baselines', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto(fixturePath)

  const root = page.locator('html')
  await page.getByRole('button', { name: 'Light' }).click()
  await expect(root).toHaveAttribute('data-color-scheme', 'light')
  await expect(page).toHaveScreenshot('responsive-light.png', {
    animations: 'disabled',
    fullPage: true,
  })

  await page.getByRole('button', { name: 'Dark' }).click()
  await expect(root).toHaveAttribute('data-color-scheme', 'dark')
  await expect(page).toHaveScreenshot('responsive-dark.png', {
    animations: 'disabled',
    fullPage: true,
  })
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
