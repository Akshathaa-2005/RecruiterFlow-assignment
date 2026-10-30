import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';

test('standard user can log in and sees the products page', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.login('standard_user', 'secret_sauce');

  await expect(page.getByText('Products', { exact: true })).toBeVisible();
});

test('locked out user sees an error message', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.login('locked_out_user', 'secret_sauce');

  await expect(loginPage.errorMessage).toContainText('locked out');
});
