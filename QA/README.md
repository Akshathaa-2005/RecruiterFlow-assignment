# QA Automation

Playwright + TypeScript tests for two parts:

- **UI tests** against the demo shop at https://www.saucedemo.com
- **API tests** against the demo REST API at https://reqres.in

## Setup

Requires Node.js 18 or newer.

```bash
npm install
npx playwright install chromium
```

## Running the tests

Run every test on Chromium:

```bash
npx playwright test --project=chromium
```

Run only one part:

```bash
npx playwright test tests/ui
npx playwright test tests/api
```

After a run, open the HTML report with:

```bash
npx playwright show-report
```

## ReqRes API key (optional)

The API tests send an `x-api-key` header when the `REQRES_API_KEY` environment variable is set. Create a free account at https://reqres.in to get a key.

```bash
REQRES_API_KEY=your_key npx playwright test tests/api
```

The key is read from the environment and is never stored in the repo. At the time of writing, ReqRes also accepts requests without a key, so the tests pass either way.

## What is covered

| File | Tests |
| --- | --- |
| `tests/ui/login.spec.ts` | Valid login with standard user shows the Products page; locked out user sees an error |
| `tests/ui/cart.spec.ts` | Adding a product shows a cart badge with 1 |
| `tests/api/users.spec.ts` | GET user 2 returns 200 with an email; POST a user returns 201 with the submitted name |

`pages/LoginPage.ts` holds the login steps, so the UI tests share one login helper.

## Not included

- Other browsers (Firefox and WebKit)
- CI setup
- Bonus scenarios: removing an item from the cart, logging out, and a 404 check on `/api/users/23`

The testcases were written with the help of Claude.
