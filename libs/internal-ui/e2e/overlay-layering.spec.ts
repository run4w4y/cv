import { expect, type Locator, type Page, test } from '@playwright/test'

const expectTopmostAtCenter = async (page: Page, locator: Locator) => {
  const slot = await locator.getAttribute('data-slot')
  expect(slot).toBeTruthy()

  await expect
    .poll(async () => {
      const box = await locator.boundingBox()
      if (!box || !slot) return false

      return page.evaluate(
        ({ selector, x, y }) =>
          document
            .elementsFromPoint(x, y)
            .some((element) => element.closest(selector) !== null),
        {
          selector: `[data-slot="${slot}"]`,
          x: box.x + box.width / 2,
          y: box.y + box.height / 2,
        }
      )
    })
    .toBe(true)
}

test('floating and modal portals remain interactive inside a dialog', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=overlays-layering--nested-overlays&viewMode=story'
  )
  await page.getByRole('button', { name: 'Open layering dialog' }).click()

  const dialogPortal = page.locator('[data-slot="dialog-portal"]')
  await expect(dialogPortal).toHaveCount(1)

  await page.getByRole('combobox', { name: 'Status combobox' }).click()
  const combobox = page.locator('[data-slot="combobox-content"]')
  await expect(combobox).toBeVisible()
  await expect(
    dialogPortal.locator('[data-slot="combobox-portal"]')
  ).toHaveCount(1)
  await expectTopmostAtCenter(page, combobox)
  await page.getByRole('option', { name: 'Interviewing' }).click()

  await page.getByRole('combobox', { name: 'Priority select' }).click()
  const select = page.locator('[data-slot="select-content"]')
  await expect(select).toBeVisible()
  await expect(dialogPortal.locator('[data-slot="select-portal"]')).toHaveCount(
    1
  )
  await expectTopmostAtCenter(page, select)
  await page.getByRole('option', { name: 'High' }).click()

  await page.getByRole('button', { name: 'Open calendar' }).click()
  const calendarPopover = page.locator('[data-slot="popover-content"]')
  await expect(calendarPopover).toBeVisible()
  await expect(
    dialogPortal.locator('[data-slot="popover-portal"]')
  ).toHaveCount(1)
  await expectTopmostAtCenter(page, calendarPopover)
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Help' }).click()
  const helpPopover = page.locator('[data-slot="popover-content"]')
  await expect(helpPopover).toBeVisible()
  await expectTopmostAtCenter(page, helpPopover)
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Open actions' }).click()
  const dropdown = page.locator('[data-slot="dropdown-menu-content"]')
  await expect(dropdown).toBeVisible()
  await expect(
    dialogPortal.locator('[data-slot="dropdown-menu-portal"]')
  ).toHaveCount(1)
  await expectTopmostAtCenter(page, dropdown)
  await page.getByRole('menuitem', { name: 'Duplicate' }).click()

  await page.getByRole('button', { name: 'Open confirmation' }).click()
  const alertDialog = page.locator('[data-slot="alert-dialog-content"]')
  await expect(alertDialog).toBeVisible()
  await expect(
    dialogPortal.locator('[data-slot="alert-dialog-portal"]')
  ).toHaveCount(1)
  await expectTopmostAtCenter(page, alertDialog)
  await page.getByRole('button', { name: 'Cancel' }).click()
  await page.getByRole('button', { name: 'Close dialog' }).click()

  await page.getByRole('button', { name: 'Open layering sheet' }).click()
  const sheetPortal = page.locator('[data-slot="sheet-portal"]')
  const sheet = page.locator('[data-slot="sheet-content"]')
  await expect(sheet).toBeVisible()
  await expectTopmostAtCenter(page, sheet)

  await page.getByRole('combobox', { name: 'Sheet status' }).click()
  const sheetCombobox = page.locator('[data-slot="combobox-content"]')
  await expect(sheetCombobox).toBeVisible()
  await expect(
    sheetPortal.locator('[data-slot="combobox-portal"]')
  ).toHaveCount(1)
  await expectTopmostAtCenter(page, sheetCombobox)
})
