import { expect, test } from '@playwright/test';

const EXAMPLE_JOB_ID = '22222222-2222-4222-8222-222222222222';

// Covers the fictional pasted-job slice at /jobs: honest "unsaved / unverified"
// labelling, an example opportunity with a source link, client-side validation
// errors, a safe (escaped) preview of pasted text, and both themes at phone and
// desktop widths. No server routes or persistence are involved.

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`paste-a-job ${viewport.width}px / ${colorScheme}: labels, validation and safe preview`, async ({ browser }) => {
      const context = await browser.newContext({ viewport, colorScheme });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => {
        if (message.type() !== 'error' || message.location().url.endsWith('/favicon.ico')) return;

        // These two 400 responses are intentional validation cases exercised
        // below. Browsers report failed HTTP resources to the console even
        // though the application handles the responses and displays errors.
        const text = message.text();
        if (/Failed to load resource:.*status of 400/i.test(text)) return;
        errors.push(text);
      });

      await page.goto('/jobs');

      // Theme applied globally by the root init script.
      await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme);

      // Honest limitations are stated up front.
      await expect(page.getByText('Nothing here is saved yet.')).toBeVisible();

      // Example opportunity is clearly labelled and shows its source link.
      const example = page.getByRole('region', { name: 'Example opportunity' });
      await expect(example.getByText('Example opportunity')).toBeVisible();
      await expect(example.getByText('● Unverified')).toBeVisible();
      await expect(example.getByRole('link', { name: 'https://example.com/jobs/job-001' })).toBeVisible();

      const pasteForm = page.getByRole('form', { name: 'Paste a job description' });
      const preview = page.getByRole('region', { name: 'Pasted job preview' });
      await expect(preview.getByText(/appear here as an unsaved preview/)).toBeVisible();

      // Submitting an empty form surfaces validation errors and no preview.
      await pasteForm.getByRole('button', { name: 'Preview pasted job' }).click();
      await expect(page.getByText('This field is required.').first()).toBeVisible();
      await expect(pasteForm.getByRole('textbox', { name: 'Job title' })).toHaveAttribute('aria-invalid', 'true');
      await expect(preview.getByRole('article')).toHaveCount(0);

      // A non-https source URL is rejected with a specific message.
      await pasteForm.getByRole('textbox', { name: 'Job title' }).fill('Junior Web Developer');
      await pasteForm.getByRole('textbox', { name: 'Company' }).fill('North Star Labs');
      const xssText = '<img src=x onerror="window.__xss=1"> Build accessible interfaces.';
      await pasteForm.getByRole('textbox', { name: 'Job description' }).fill(xssText);
      await pasteForm.getByRole('textbox', { name: /Source URL/ }).fill('http://insecure.example.com/1');
      await pasteForm.getByRole('button', { name: 'Preview pasted job' }).click();
      await expect(page.getByText('Enter a full https:// URL, or leave it blank.')).toBeVisible();
      await expect(preview.getByRole('article')).toHaveCount(0);

      // Fixing the URL produces a safe, clearly-labelled preview.
      await pasteForm.getByRole('textbox', { name: /Source URL/ }).fill('https://example.com/jobs/job-001');
      await pasteForm.getByRole('combobox', { name: 'Job type' }).selectOption('full_time');
      await pasteForm.getByRole('combobox', { name: 'Work arrangement' }).selectOption('on_site');
      await pasteForm.getByRole('button', { name: 'Preview pasted job' }).click();

      const card = preview.getByRole('article');
      await expect(card).toBeVisible();
      await expect(card.getByText('Preview — not saved')).toBeVisible();
      await expect(card.getByText('● Unverified')).toBeVisible();
      await expect(card.getByRole('heading', { name: 'Junior Web Developer' })).toBeVisible();
      await expect(card.getByText(/North Star Labs/)).toBeVisible();
      await expect(card.getByRole('link', { name: 'https://example.com/jobs/job-001' })).toBeVisible();

      // Pasted text is rendered as text, never as HTML.
      await expect(card.getByText(xssText)).toBeVisible();
      expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
      expect(await page.locator('.cf-jobs-card-description img').count()).toBe(0);

      // The real save request is enabled; this fixture test does not assert persistence.
      await expect(page.getByRole('button', { name: 'Save as private job', exact: true })).toBeEnabled();
      await expect(card.getByText(/Preview only — save it/)).toBeVisible();
      await expect(card.getByRole('link', { name: /Open saved private job/ })).toHaveCount(0);

      await page.getByRole('link', { name: 'Open example job detail' }).first().click();
      await page.waitForURL(`**/jobs/${EXAMPLE_JOB_ID}`);
      await expect(page.getByText('Fixture preview — not loaded from the database.')).toBeVisible();
      await expect(page.getByRole('link', { name: 'Review match', exact: true })).toBeVisible();

      // No horizontal overflow and no console/page errors.
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(errors).toEqual([]);

      await context.close();
    });
  }
}
