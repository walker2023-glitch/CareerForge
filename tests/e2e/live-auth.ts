import { expect, type Page } from '@playwright/test';

export async function signIn(page: Page, account: 'A' | 'B') {
  await page.goto('/sign-in');
  await page.getByLabel('Email', { exact: true }).fill(process.env[`E2E_STUDENT_${account}_EMAIL`]!);
  await page.getByLabel('Password', { exact: true }).fill(process.env[`E2E_STUDENT_${account}_PASSWORD`]!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
}

