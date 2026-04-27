import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('#email', process.env.TEST_EMAIL ?? '')
    await page.fill('#password', process.env.TEST_PASSWORD ?? '')
    await page.click('button[type=submit]')
    await page.waitForURL('/dashboard')
  })

  test('shows KPI cards', async ({ page }) => {
    await expect(page.getByText('Total Spend')).toBeVisible()
    await expect(page.getByText('Leads')).toBeVisible()
    await expect(page.getByText('CPL')).toBeVisible()
    await expect(page.getByText('ROAS')).toBeVisible()
  })

  test('navigates to campaigns', async ({ page }) => {
    await page.click('text=Campanhas')
    await page.waitForURL('/campaigns')
    await expect(page.getByRole('heading', { name: 'Campanhas' })).toBeVisible()
  })

  test('navigates to leads', async ({ page }) => {
    await page.click('text=Leads')
    await page.waitForURL('/leads')
    await expect(page.getByRole('heading', { name: 'Leads' })).toBeVisible()
  })
})
