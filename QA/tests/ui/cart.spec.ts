import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';

test('adding a product to the cart shows a badge with 1', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.login('standard_user', 'secret_sauce');

  await page.getByTestId('add-to-cart-sauce-labs-backpack').click();

  await expect(page.getByTestId('shopping-cart-badge')).toHaveText('1');
});
