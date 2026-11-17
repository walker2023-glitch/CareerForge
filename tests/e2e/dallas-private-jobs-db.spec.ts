import { expect, test } from '@playwright/test';
import { signIn } from './live-auth';

// Run only against an explicitly designated isolated project with fictional accounts.
// Auth uses the app's real cookie session, rather than unsupported bearer headers.
const enabled = process.env.E2E_ISOLATED_DB === '1' &&
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
  ['A', 'B'].every(account => process.env[`E2E_STUDENT_${account}_EMAIL`] && process.env[`E2E_STUDENT_${account}_PASSWORD`]);

test.describe('Private jobs in an isolated Supabase database', () => {
  test.skip(!enabled, 'Requires E2E_ISOLATED_DB=1, Supabase config and two fictional account credentials.');
  test('save, open, reload; second account and signed-out requests denied', async ({ browser }) => {
    expect(process.env.CAREERFORGE_E2E_JOBS_FIXTURE).not.toBe('1');
    const a = await browser.newContext();
    const b = await browser.newContext();
    const anonymous = await browser.newContext();
    try {
      const page = await a.newPage();
      await signIn(page, 'A');
      await page.goto('/jobs');
      await page.getByLabel('Job title', { exact: true }).fill('Fictional isolation internship');
      await page.getByLabel('Company', { exact: true }).fill('Fictional Test Company');
      await page.getByLabel('Job description', { exact: true }).fill('Build accessible interfaces with TypeScript.');
      await page.getByRole('button', { name: 'Preview pasted job', exact: true }).click();
      await page.getByRole('button', { name: 'Save as private job', exact: true }).click();
      await page.getByRole('link', { name: 'Open saved private job' }).click();
      await expect(page.getByRole('heading', { name: 'Fictional isolation internship' })).toBeVisible();
      const url = page.url();
      const id = url.split('/').pop();
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Fictional isolation internship' })).toBeVisible();
      const own = await a.request.get(`/api/jobs/${id}`);
      expect(own.status()).toBe(200);
      expect((await own.json()).data).toMatchObject({ source: 'pasted', status: 'private', deadlineVerified: false });
      const otherPage = await b.newPage();
      await signIn(otherPage, 'B');
      const denied = await b.request.get(`/api/jobs/${id}`);
      expect(denied.status()).toBe(404);
      const missing = await b.request.get('/api/jobs/00000000-0000-4000-8000-000000000000');
      expect(await denied.json()).toEqual(await missing.json());
      await otherPage.goto(url);
      await expect(otherPage.getByRole('heading', { name: 'Job not available' })).toBeVisible();
      expect((await anonymous.request.get(`/api/jobs/${id}`)).status()).toBe(401);
    } finally {
      await a.close(); await b.close(); await anonymous.close();
    }
  });
});
