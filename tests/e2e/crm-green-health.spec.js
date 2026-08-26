const { test, expect } = require('@playwright/test');

test('GREEN-API: instancia y settings responden correctamente', async ({ request }) => {
  const response = await request.get('/api/green-health');
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

  console.log('GREEN_HEALTH', JSON.stringify({ status: response.status(), data }));

  expect(response.status(), `GREEN-API health HTTP ${response.status()}: ${text}`).toBe(200);
  expect(data?.ok, `GREEN-API health: ${text}`).toBe(true);
});
