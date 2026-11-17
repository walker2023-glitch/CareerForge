import { expect, test } from '@playwright/test';

test.describe('Truthful missing-service UI', () => {
  test.skip(Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL), 'Spec requires a build without Supabase configuration');
  test('sign-in is visibly unavailable and a preview never becomes falsely saved', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.getByRole('status')).toHaveText('Sign-in is currently unavailable.');
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeDisabled();
    await page.goto('/jobs');
    await page.getByLabel('Job title', { exact: true }).fill('Fictional unavailable-service test');
    await page.getByLabel('Company', { exact: true }).fill('Fictional company');
    await page.getByLabel('Job description', { exact: true }).fill('Build TypeScript applications.');
    await page.getByRole('button', { name: 'Preview pasted job', exact: true }).click();
    await page.getByRole('button', { name: 'Save as private job', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Pasted job preview' }).getByRole('alert')).toHaveText('Job service is unavailable. Try again later.');
    await expect(page.getByText('Preview — not saved', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open saved private job' })).toHaveCount(0);
  });
});
