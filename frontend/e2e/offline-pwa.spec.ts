import { expect, test, type Page } from '@playwright/test';

const username = process.env.E2E_USERNAME ?? 'pwa.e2e';
const password = process.env.E2E_PASSWORD ?? 'Pwa-E2E-Password-2026!';

async function waitForServiceWorker(page: Page) {
  await page.waitForFunction(async () => {
    if (!('serviceWorker' in navigator)) {
      return false;
    }
    const registration = await navigator.serviceWorker.ready;
    return Boolean(registration.active);
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(username)).toBeVisible();
}

async function queuedRecords(page: Page) {
  return page.evaluate(async () => {
    return new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
      const request = indexedDB.open('dataLensOffline');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('pendingSync', 'readonly');
        const records = transaction.objectStore('pendingSync').getAll();
        records.onerror = () => {
          database.close();
          reject(records.error);
        };
        records.onsuccess = () => {
          database.close();
          resolve(records.result);
        };
      };
    });
  });
}

test.describe.serial('offline and PWA behavior', () => {
  test('installs the service worker and reloads the application shell offline', async ({
    context,
    page
  }) => {
    await page.goto('/login');
    await waitForServiceWorker(page);

    const pwaState = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      const manifestLink = document.querySelector<HTMLLinkElement>(
        'link[rel="manifest"]'
      );
      const manifest = await fetch(manifestLink?.href ?? '/manifest.webmanifest').then(
        (response) => response.json()
      );
      const cacheNames = await caches.keys();
      const shellCached = Boolean(
        await caches.match('/index.html', { ignoreSearch: true })
      );

      return {
        active: Boolean(registration.active),
        controlled: Boolean(navigator.serviceWorker.controller),
        display: manifest.display,
        iconSizes: manifest.icons.map((icon: { sizes: string }) => icon.sizes),
        maskable: manifest.icons.some(
          (icon: { purpose?: string }) => icon.purpose === 'maskable'
        ),
        cacheNames,
        shellCached
      };
    });

    expect(pwaState).toMatchObject({
      active: true,
      controlled: true,
      display: 'standalone',
      maskable: true,
      shellCached: true
    });
    expect(pwaState.iconSizes).toEqual(
      expect.arrayContaining(['192x192', '512x512'])
    );
    expect(pwaState.cacheNames.length).toBeGreaterThan(0);

    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await context.setOffline(false);
  });

  test('queues a mutation offline and replays it after reconnecting', async ({
    context,
    page
  }) => {
    await login(page);
    await page.goto('/communities');
    await expect(page.getByRole('heading', { name: 'Communities' })).toBeVisible();
    await expect(page.getByText('Loading communities...')).toBeHidden();

    const communityName = `Offline PWA ${Date.now()}`;
    await context.setOffline(true);
    await expect(page.getByRole('button', { name: /Open sync center/ })).toContainText(
      'Offline'
    );

    await page.getByRole('button', { name: 'Create community' }).click();
    const dialog = page.getByRole('dialog', { name: 'Create community' });
    const nameField = dialog.getByLabel('Community name');
    await nameField.fill(communityName);
    await page.waitForTimeout(1_000);
    await dialog.locator('button[type="submit"]').click();

    await expect
      .poll(async () => queuedRecords(page))
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            entityType: 'community',
            payload: expect.objectContaining({ name: communityName }),
            status: 'pending'
          })
        ])
      );

    await expect(dialog).toBeHidden();

    await expect(
      page.getByRole('button', { name: /Open sync center, 1 items need attention/ })
    ).toBeVisible();

    await context.setOffline(false);

    await expect
      .poll(
        async () => {
          const records = await queuedRecords(page);
          return records.some(
            (record) =>
              record.entityType === 'community' &&
              record.status === 'synced' &&
              (record.payload as { name?: string }).name === communityName
          );
        },
        { timeout: 20_000 }
      )
      .toBe(true);

    await expect
      .poll(async () => {
        return page.evaluate(async (name) => {
          const response = await fetch(
            `/api/v1/communities/?search=${encodeURIComponent(name)}`
          );
          if (!response.ok) {
            return false;
          }
          const payload = await response.json();
          return payload.results.some(
            (community: { name?: string }) => community.name === name
          );
        }, communityName);
      })
      .toBe(true);
  });
});
