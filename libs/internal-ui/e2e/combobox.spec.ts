import { expect, test } from '@playwright/test'

test('only reserves empty-state space when no options match', async ({
  page,
}) => {
  await page.goto('/iframe.html?id=forms-combobox--single&viewMode=story')
  await page.getByRole('combobox').click()

  const input = page.getByRole('combobox', { name: 'Search…' })
  const emptyRegion = page.getByRole('status')
  const searchRow = input.locator('xpath=..')
  const firstOption = page.getByRole('option').first()

  await expect(firstOption).toBeVisible()
  await expect(emptyRegion).toHaveText('')
  await expect
    .poll(() =>
      emptyRegion.evaluate((element) => element.getBoundingClientRect().height)
    )
    .toBe(0)

  const searchRowBox = await searchRow.boundingBox()
  const firstOptionBox = await firstOption.boundingBox()
  expect(searchRowBox).not.toBeNull()
  expect(firstOptionBox).not.toBeNull()
  expect(
    firstOptionBox &&
      searchRowBox &&
      firstOptionBox.y - (searchRowBox.y + searchRowBox.height)
  ).toBeLessThan(8)

  await input.fill('missing')

  await expect(firstOption).toHaveCount(0)
  await expect(emptyRegion).toHaveText('No options found.')
  await expect
    .poll(() =>
      emptyRegion.evaluate((element) => element.getBoundingClientRect().height)
    )
    .toBeGreaterThan(0)
})
