import { mintPrivateAudienceLinkFromSecrets } from '@cv/content-build'
import { decodeWebBaseUrl } from '@cv/content-core'
import { runPrivateCryptoPromise } from '@cv/private-content-crypto'
import { expect, type Page, type TestInfo, test } from '@playwright/test'
import { Redacted } from 'effect'
import {
  e2eFixtureAccessEmail,
  e2eFixtureAudienceKey,
  e2eFixtureBaseUrl,
  e2eFixtureContentIdSalt,
  e2eFixturePrivateCanaries,
  e2eFixtureRootKey,
} from './fixture-env'

const publicRoutes = [
  {
    activeLocale: 'EN',
    inactiveLocale: 'RU',
    noticeText:
      'This is the public version of the CV, so some details are redacted.',
    path: '/en/',
    title: /Example CV Fixture - Staff Software Engineer/u,
  },
  {
    activeLocale: 'RU',
    inactiveLocale: 'EN',
    noticeText: 'Это публичная версия CV, поэтому часть деталей скрыта.',
    path: '/ru/',
    title: /Example CV Fixture - Staff Software Engineer/u,
  },
] as const

const visibleLeakPattern = /[?&]p=|Full CV opened/u
const privateCanaryPattern = new RegExp(
  e2eFixturePrivateCanaries
    .map((value) => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
    .join('|'),
  'u'
)
const frameworkOverlayPattern =
  /Astro encountered an error|Unhandled Runtime Error|Internal Server Error/u

const privateFixtureLink = () =>
  runPrivateCryptoPromise(
    mintPrivateAudienceLinkFromSecrets({
      audience: 'pdf-export-fixture',
      audienceKey: Redacted.make(e2eFixtureAudienceKey),
      baseUrl: decodeWebBaseUrl(e2eFixtureBaseUrl),
      contentIdSalt: e2eFixtureContentIdSalt,
      locale: 'en',
      profile: 'default',
      secrets: { rootKey: Redacted.make(e2eFixtureRootKey) },
    })
  )

const isInternalRequest = (baseURL: string, requestUrl: string) => {
  const request = new URL(requestUrl)

  if (
    request.protocol === 'about:' ||
    request.protocol === 'blob:' ||
    request.protocol === 'data:'
  ) {
    return true
  }

  return request.origin === new URL(baseURL).origin
}

const attachPageGuards = (page: Page, testInfo: TestInfo) => {
  const unexpectedRequests: string[] = []
  const runtimeErrors: string[] = []
  const baseURL = testInfo.project.use.baseURL

  if (typeof baseURL !== 'string') {
    throw new Error('Playwright baseURL must be configured for network guards')
  }

  page.on('request', (request) => {
    const url = request.url()

    if (!isInternalRequest(baseURL, url)) {
      unexpectedRequests.push(`${request.method()} ${url}`)
    }
  })

  page.on('pageerror', (error) => {
    runtimeErrors.push(error.stack ?? error.message)
  })

  page.on('console', (message) => {
    if (message.type() === 'error') {
      runtimeErrors.push(message.text())
    }
  })

  return async () => {
    expect(runtimeErrors, 'browser console/page errors').toEqual([])
    expect(unexpectedRequests, 'unexpected cross-origin network calls').toEqual(
      []
    )
  }
}

const expectNoVisiblePrivateLeaks = async (page: Page) => {
  await expect(
    page.locator('[data-content-variable-state="unlocked"]')
  ).toHaveCount(0)
  await expect(
    page.locator('a[data-cv-file-state="private-locked"][href]')
  ).toHaveCount(0)
  await expect(page.locator('a[href*="?p="], a[href*="&p="]')).toHaveCount(0)
  await expect(page.locator('a[href*="/a/"]')).toHaveCount(0)

  const visibleText = await page.locator('body').innerText()
  expect(visibleText).not.toMatch(visibleLeakPattern)
  expect(visibleText).not.toMatch(privateCanaryPattern)

  const html = await page.content()
  expect(html).not.toMatch(privateCanaryPattern)
}

const metaContent = async (page: Page, selector: string) => {
  const locator = page.locator(selector).first()

  return (await locator.count()) === 0 ? null : locator.getAttribute('content')
}

const sanitizedPageUrl = (value: string) => {
  const url = new URL(value)

  if (url.searchParams.has('p')) {
    url.searchParams.set('p', '[redacted]')
  }

  return url.toString()
}

const expectPublicMetadata = async (
  page: Page,
  route: (typeof publicRoutes)[number]
) => {
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    'href',
    '/favicon.svg'
  )

  const title = await page.title()
  const description = await metaContent(page, 'meta[name="description"]')
  const robots = await metaContent(page, 'meta[name="robots"]')

  expect(description).toBeTruthy()
  expect(robots).toContain('noindex')
  expect(robots).toContain('nofollow')
  expect(await metaContent(page, 'meta[property="og:title"]')).toBe(title)
  expect(await metaContent(page, 'meta[property="og:description"]')).toBe(
    description
  )
  expect(await metaContent(page, 'meta[property="og:type"]')).toBe('website')
  expect(await metaContent(page, 'meta[property="og:url"]')).toContain(
    route.path
  )
  expect(await metaContent(page, 'meta[property="og:image"]')).toBeNull()
  expect(await metaContent(page, 'meta[property="og:image:type"]')).toBeNull()
  expect(await metaContent(page, 'meta[property="og:image:width"]')).toBeNull()
  expect(await metaContent(page, 'meta[property="og:image:height"]')).toBeNull()
  expect(await metaContent(page, 'meta[property="og:image:alt"]')).toBeNull()
  expect(await metaContent(page, 'meta[name="twitter:card"]')).toBe('summary')
  expect(await metaContent(page, 'meta[name="twitter:title"]')).toBe(title)
  expect(await metaContent(page, 'meta[name="twitter:description"]')).toBe(
    description
  )
  expect(await metaContent(page, 'meta[name="twitter:image"]')).toBeNull()
  expect(await metaContent(page, 'meta[name="twitter:image:alt"]')).toBeNull()
}

const expectPublicRoute = async (
  page: Page,
  route: (typeof publicRoutes)[number]
) => {
  await page.goto(route.path, { waitUntil: 'networkidle' })

  await expect(page).toHaveTitle(route.title)
  await expect(page.locator('main').first()).toBeVisible()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Example CV Fixture' })
  ).toBeVisible()
  await expect(page.getByText(route.noticeText)).toBeVisible()
  await expect(
    page.getByRole('link', { exact: true, name: route.activeLocale }).first()
  ).toHaveAttribute('aria-current', 'page')
  await expect(
    page.getByRole('link', { exact: true, name: route.inactiveLocale }).first()
  ).toBeVisible()

  const visibleText = await page.locator('body').innerText()
  expect(visibleText).not.toMatch(frameworkOverlayPattern)

  await expectPublicMetadata(page, route)
  await expectNoVisiblePrivateLeaks(page)
}

test.describe('static public CV routes', () => {
  test.afterEach(async ({ page }, testInfo) => {
    await testInfo.attach('url', {
      body: sanitizedPageUrl(page.url()),
      contentType: 'text/plain',
    })
  })

  for (const route of publicRoutes) {
    test(`${route.path} renders on desktop and mobile without privacy/network leaks`, async ({
      page,
    }, testInfo) => {
      const assertPageGuards = attachPageGuards(page, testInfo)

      await expectPublicRoute(page, route)
      await assertPageGuards()
    })
  }

  test('root redirect page exposes public preview metadata', async ({
    page,
  }) => {
    const response = await page.request.get('/')
    expect(response.ok()).toBe(true)

    const html = await response.text()
    expect(html).toContain('http-equiv="refresh"')
    expect(html).toContain('href="/favicon.svg" rel="icon"')
    expect(html).toContain(
      'content="noindex, nofollow, noarchive" name="robots"'
    )
    expect(html).toContain('property="og:title"')
    expect(html).toContain('name="twitter:card"')
    expect(html).toContain('content="summary" name="twitter:card"')
    expect(html).not.toContain('property="og:image"')
    expect(html).not.toContain('name="twitter:image"')
    expect(html).not.toMatch(privateCanaryPattern)
  })

  test('locale tabs switch between static routes', async ({
    page,
  }, testInfo) => {
    const assertPageGuards = attachPageGuards(page, testInfo)

    await expectPublicRoute(page, publicRoutes[0])
    await page.getByRole('link', { exact: true, name: 'RU' }).first().click()
    await expect(page).toHaveURL(/\/ru\/$/u)
    await expect(page).toHaveTitle(publicRoutes[1].title)
    await expect(
      page.getByRole('link', { exact: true, name: 'RU' }).first()
    ).toHaveAttribute('aria-current', 'page')
    await expectNoVisiblePrivateLeaks(page)

    await assertPageGuards()
  })

  test('private file links stay inert on public routes', async ({
    page,
  }, testInfo) => {
    const assertPageGuards = attachPageGuards(page, testInfo)

    await expectPublicRoute(page, publicRoutes[0])

    const privateFileLink = page
      .locator('[data-cv-file-state="private-locked"]')
      .first()
    const publicFileLink = page
      .locator('a[data-cv-file-state="public"]')
      .first()

    await expect(privateFileLink).toBeVisible()
    await expect(privateFileLink).toHaveCSS('cursor', 'not-allowed')
    await expect(publicFileLink).toBeVisible()
    await expect(publicFileLink).toHaveCSS('cursor', 'pointer')
    expect(await privateFileLink.getAttribute('href')).toBeNull()
    await expect(privateFileLink).toHaveAttribute(
      'data-cv-file-state',
      'private-locked'
    )
    await expect(privateFileLink).toHaveAttribute('aria-disabled', 'true')
    await expect(
      privateFileLink.locator('[data-cv-file-lock-icon]')
    ).toBeVisible()

    await expect(
      page.locator('.print-only a', { hasText: 'Private case study PDF' })
    ).toHaveCount(0)

    if (testInfo.project.name.includes('mobile')) {
      await privateFileLink.focus()
    } else {
      await privateFileLink.hover()
    }

    const visibleHoverCard = page
      .locator('[data-private-access-hover-card]:visible')
      .first()
    await expect(visibleHoverCard).toBeVisible()
    await expect(visibleHoverCard).toContainText(
      'This detail is hidden in the redacted public version'
    )
    await privateFileLink.click({ force: true })
    await expect(page).toHaveURL(/\/en\/$/u)
    await assertPageGuards()
  })

  test('redacted sections explain public redaction inline', async ({
    page,
  }, testInfo) => {
    const assertPageGuards = attachPageGuards(page, testInfo)

    await expectPublicRoute(page, publicRoutes[0])

    const lockedSection = page
      .locator('.print-root [data-content-redacted-section-state="locked"]')
      .first()

    await expect(lockedSection).toBeVisible()
    await expect(lockedSection).toContainText('Redacted from public CV')
    await expect(lockedSection).toContainText('For the full CV, email')
    await expect(lockedSection).toContainText(e2eFixtureAccessEmail)
    await expectNoVisiblePrivateLeaks(page)

    await assertPageGuards()
  })

  test('theme filter control updates rendered state', async ({
    page,
  }, testInfo) => {
    const assertPageGuards = attachPageGuards(page, testInfo)

    await expectPublicRoute(page, publicRoutes[0])
    const darkTheme = page.getByRole('button', { name: 'Dark theme' })
    const lightTheme = page.getByRole('button', { name: 'Light theme' })

    await darkTheme.focus()
    await darkTheme.press('Enter')
    await expect(page.locator('html')).toHaveAttribute(
      'data-color-scheme',
      'dark'
    )
    await expect(page.locator('html')).toHaveClass(/(?:^|\s)dark(?:\s|$)/u)
    await lightTheme.focus()
    await lightTheme.press('Space')
    await expect(page.locator('html')).toHaveAttribute(
      'data-color-scheme',
      'light'
    )
    await expectNoVisiblePrivateLeaks(page)

    await assertPageGuards()
  })

  test('static header runtime updates navigation and sticky actions', async ({
    page,
  }, testInfo) => {
    const assertPageGuards = attachPageGuards(page, testInfo)

    await expectPublicRoute(page, publicRoutes[0])

    const headerActions = page.locator('[data-cv-header-actions]')
    const experienceNav = page.locator('[data-cv-nav-section="experience"]')

    await expect(headerActions).toBeHidden()
    await page.locator('#experience').evaluate((element) => {
      element.scrollIntoView({ block: 'start' })
    })
    await expect(headerActions).toBeVisible()
    await expect(experienceNav).toHaveAttribute('aria-current', 'location')
    await expect(experienceNav).toHaveAttribute('data-active', 'true')
    await assertPageGuards()
  })

  test('technology icons use the bounded SVG catalog', async ({
    page,
  }, testInfo) => {
    const assertPageGuards = attachPageGuards(page, testInfo)

    await expectPublicRoute(page, publicRoutes[0])

    const icon = page.locator('main [data-tech-icon]:visible').first()

    await expect(icon).toBeVisible()
    expect(
      await icon.evaluate((element) => getComputedStyle(element).maskImage)
    ).not.toBe('none')
    await expect(page.locator('[class*="devicon-"]')).toHaveCount(0)
    await assertPageGuards()
  })

  test('project overflow disclosure expands hidden projects', async ({
    page,
  }, testInfo) => {
    const assertPageGuards = attachPageGuards(page, testInfo)

    await expectPublicRoute(page, publicRoutes[0])

    const details = page.locator('#projects details').first()
    const trigger = details.locator('summary')
    const showMoreLabel = trigger.getByText('Show more', { exact: true })
    const showLessLabel = trigger.getByText('Show less', { exact: true })
    const hiddenProject = page.getByRole('heading', {
      level: 2,
      name: 'Project Overflow Zeta',
    })

    await expect(details).toBeVisible()
    await expect(showMoreLabel).toBeVisible()
    await expect(showLessLabel).toBeHidden()
    await expect(hiddenProject).toBeHidden()

    await trigger.click()

    await expect(details).toHaveAttribute('open', '')
    await expect(showMoreLabel).toBeHidden()
    await expect(showLessLabel).toBeVisible()
    await expect(hiddenProject).toBeVisible()

    const triggerBox = await trigger.boundingBox()
    const hiddenProjectBox = await hiddenProject.boundingBox()

    expect(
      triggerBox?.y,
      'show less control should stay below revealed projects'
    ).toBeGreaterThan(hiddenProjectBox?.y ?? Number.POSITIVE_INFINITY)
    await expectNoVisiblePrivateLeaks(page)

    await trigger.click()

    await expect(details).not.toHaveAttribute('open', '')
    await expect(showMoreLabel).toBeVisible()
    await expect(showLessLabel).toBeHidden()
    await expect(hiddenProject).toBeHidden()

    await assertPageGuards()
  })

  test('print resume limits projects to eight entries', async ({
    page,
  }, testInfo) => {
    const assertPageGuards = attachPageGuards(page, testInfo)

    await expectPublicRoute(page, publicRoutes[0])

    const printProjects = page.locator('.print-only [data-print-project]')

    await expect(printProjects).toHaveCount(8)
    await expect(printProjects.nth(7)).toContainText('Project Overflow Eta')
    await expect(
      page.locator('.print-only [data-print-project]', {
        hasText: 'Project Overflow Theta',
      })
    ).toHaveCount(0)
    await expect(
      page.locator('#projects article', {
        hasText: 'Project Overflow Theta',
      })
    ).toHaveCount(1)
    await expectNoVisiblePrivateLeaks(page)

    await assertPageGuards()
  })

  test('skill subgroups wrap as full-width rows', async ({
    page,
  }, testInfo) => {
    const assertPageGuards = attachPageGuards(page, testInfo)

    await expectPublicRoute(page, publicRoutes[0])

    const reactSubgroup = page.locator('[data-skill-subgroup="React"]').first()
    const astroSubgroup = page.locator('[data-skill-subgroup="Astro"]').first()
    const reactLabel = reactSubgroup.getByText('React', { exact: true })
    const firstReactItem = reactSubgroup.locator(
      '[data-skill-subitem="Suspense"]'
    )

    await expect(reactSubgroup).toBeVisible()
    await expect(astroSubgroup).toBeVisible()

    const reactBox = await reactSubgroup.boundingBox()
    const astroBox = await astroSubgroup.boundingBox()
    const reactLabelBox = await reactLabel.boundingBox()
    const firstReactItemBox = await firstReactItem.boundingBox()
    const firstItemRowOffset = Math.abs(
      (firstReactItemBox?.y ?? Number.POSITIVE_INFINITY) -
        (reactLabelBox?.y ?? Number.NEGATIVE_INFINITY)
    )

    expect(
      astroBox?.y,
      'each skill subgroup should start on its own row'
    ).toBeGreaterThan((reactBox?.y ?? Number.POSITIVE_INFINITY) + 1)
    expect(
      firstItemRowOffset,
      'subgroup title and subitems should share the same wrapping flow'
    ).toBeLessThan(2)
    await expectNoVisiblePrivateLeaks(page)

    await assertPageGuards()
  })

  test('mobile workstream disclosures expand inline details', async ({
    page,
  }, testInfo) => {
    test.skip(
      !testInfo.project.name.includes('mobile'),
      'workstream disclosures are mobile-only'
    )

    const assertPageGuards = attachPageGuards(page, testInfo)

    await expectPublicRoute(page, publicRoutes[0])

    const trigger = page
      .locator('#experience details', { hasText: 'Fixture platform' })
      .locator('summary')
      .first()
    const panelText = page
      .locator('#experience')
      .getByText(/public-facing and administrative React applications/iu)
      .first()

    await expect(trigger).toBeVisible()
    await expect(panelText).toBeHidden()
    await trigger.click()
    await expect(panelText).toBeVisible()
    await expectNoVisiblePrivateLeaks(page)

    await assertPageGuards()
  })
})

test.describe('private CV printing', () => {
  test('unlocks and prints with the configured deployed URL', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name.includes('mobile'),
      'PDF output is covered once with the desktop browser'
    )

    const assertPageGuards = attachPageGuards(page, testInfo)
    const link = await privateFixtureLink()
    const hash = new URLSearchParams({
      audience: link.audienceId,
      p: link.token,
    })

    await page.goto(`/en/a/#${hash.toString()}`, {
      waitUntil: 'networkidle',
    })
    await expect(
      page.locator('[data-private-qr-image][data-private-qr-ready]')
    ).toHaveCount(1)
    await expect(page.locator('body')).toContainText(
      e2eFixturePrivateCanaries[0]
    )
    const privateFileAction = page
      .locator('a[data-cv-file-state="private-ready"]')
      .first()
    await expect(privateFileAction).toBeVisible()
    await expect(privateFileAction).toHaveCSS('cursor', 'pointer')
    await expect(page.locator('[data-print-qr-image]')).toHaveAttribute(
      'data-print-qr-url',
      link.url
    )

    const pdf = await page.pdf({ format: 'A4', printBackground: true })

    expect(pdf.subarray(0, 4).toString()).toBe('%PDF')
    expect(pdf.byteLength).toBeGreaterThan(10_000)
    await assertPageGuards()
  })
})
