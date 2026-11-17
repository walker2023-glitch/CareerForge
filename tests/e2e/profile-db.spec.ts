import { expect, test } from '@playwright/test';
import { signIn } from './live-auth';

test.describe('Atomic profile in an isolated database', () => {
  test.skip(process.env.E2E_ISOLATED_DB !== '1', 'Requires an isolated Supabase project and two fictional accounts');
  test('UI save/reload, two stale writers, foreign fact rejection and isolation', async ({ browser }) => {
    expect(process.env.CAREERFORGE_E2E_PROFILE_FIXTURE).not.toBe('1');
    const a = await browser.newContext(); const b = await browser.newContext();
    try {
      const page = await a.newPage(); await signIn(page, 'A');
      await page.getByLabel('Display name', { exact: true }).fill('Fictional Student A');
      await page.getByRole('button', { name: '+ Add skill', exact: true }).click();
      await page.getByLabel(/What you did/).last().fill('Built a TypeScript course project.');
      await page.getByRole('button', { name: 'Save profile', exact: true }).click();
      await expect(page.getByRole('status')).toHaveText('Profile saved.');
      await page.reload();
      await expect(page.getByLabel('Display name', { exact: true })).toHaveValue('Fictional Student A');
      await expect(page.getByLabel(/What you did/).last()).toHaveValue('Built a TypeScript course project.');
      const other = await b.newPage(); await signIn(other, 'B');
      await expect(other.getByLabel('Display name', { exact: true })).not.toHaveValue('Fictional Student A');
      const ownProfile = await a.request.get('/api/profile');
      expect(ownProfile.status()).toBe(200);
      const token = (await ownProfile.json()).data.updatedAt;
      const draft = { displayName: 'Concurrent winner', field: null, facts: [], expectedUpdatedAt: token };
      const results = await Promise.all([a.request.patch('/api/profile', { data: draft }), a.request.patch('/api/profile', { data: { ...draft, displayName: 'Other contender' } })]);
      expect(results.map(r => r.status()).sort()).toEqual([200, 409]);
      const winner = await results.find(r => r.status() === 200)!.json();
      const foreign = { id: crypto.randomUUID(), kind: 'skill', text: 'Private B fact', dates: null, org: null };
      const tokenB = (await (await b.request.get('/api/profile')).json()).data.updatedAt;
      expect((await b.request.patch('/api/profile', { data: { ...draft, expectedUpdatedAt: tokenB, displayName: 'Fictional B', facts: [foreign] } })).status()).toBe(200);
      expect((await a.request.patch('/api/profile', { data: { ...draft, expectedUpdatedAt: winner.data.updatedAt, facts: [foreign] } })).status()).toBe(400);
      await page.reload();
      await expect(page.getByLabel(/What you did/)).toHaveCount(0);
    } finally { await a.close(); await b.close(); }
  });
});
