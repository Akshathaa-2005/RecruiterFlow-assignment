import { test, expect } from '@playwright/test';

const BASE_URL = 'https://reqres.in/api/users';

// The API key is read from an environment variable so it is never committed.
// The header is only sent when the variable is set.
const headers: Record<string, string> = {};
if (process.env.REQRES_API_KEY) {
  headers['x-api-key'] = process.env.REQRES_API_KEY;
}

test('get user 2 returns 200 with an email', async ({ request }) => {
  const response = await request.get(`${BASE_URL}/2`, { headers });

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.data.email).toBeTruthy();
});

test('create user returns 201 with the submitted name', async ({ request }) => {
  const response = await request.post(BASE_URL, {
    headers,
    data: { name: 'morpheus', job: 'leader' },
  });

  expect(response.status()).toBe(201);
  const body = await response.json();
  expect(body.name).toBe('morpheus');
});
