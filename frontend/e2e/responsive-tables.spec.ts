import { expect, test, type Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password').fill('adm!n@pass123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('resource table keeps selection and identity visible across orientation changes', async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto('/resources');
  await expect(page.getByRole('heading', { name: 'Resources' })).toBeVisible();

  const table = page.getByRole('table');
  const wrapper = table.locator('..');
  const selectHeader = table.locator('thead .data-table__select');
  const identityHeader = table.locator('thead .data-table__identity');
  const firstResourceLink = table.getByRole('link').first();

  await expect(table).toHaveClass(/data-table--sticky-identity/);
  await expect(table).toHaveClass(/data-table--selectable/);
  await expect.poll(() => wrapper.evaluate((element) => element.scrollWidth > element.clientWidth))
    .toBe(true);

  const initialSelectX = (await selectHeader.boundingBox())?.x;
  const initialIdentityX = (await identityHeader.boundingBox())?.x;
  await wrapper.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });

  await expect.poll(() => wrapper.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  await expect.poll(async () => (await selectHeader.boundingBox())?.x).toBeCloseTo(
    initialSelectX ?? 0,
    0
  );
  await expect.poll(async () => (await identityHeader.boundingBox())?.x).toBeCloseTo(
    initialIdentityX ?? 0,
    0
  );

  const stickyStyle = await identityHeader.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      left: style.left,
      position: style.position,
      zIndex: style.zIndex
    };
  });
  expect(stickyStyle).toMatchObject({ left: '46px', position: 'sticky', zIndex: '3' });
  expect(stickyStyle.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');

  await firstResourceLink.focus();
  await expect(firstResourceLink).toBeFocused();
  await expect(firstResourceLink).toBeVisible();

  await page.setViewportSize({ width: 1024, height: 600 });
  await wrapper.evaluate((element) => {
    element.scrollLeft = 0;
  });
  await expect.poll(() => wrapper.evaluate((element) => element.scrollWidth > element.clientWidth))
    .toBe(true);
  const landscapeIdentityX = (await identityHeader.boundingBox())?.x;
  await wrapper.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });

  await expect.poll(async () => (await identityHeader.boundingBox())?.x).toBeCloseTo(
    landscapeIdentityX ?? 0,
    0
  );
  await expect(identityHeader).toHaveCSS('position', 'sticky');
});
