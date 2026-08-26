const { test, expect } = require('@playwright/test');

test('GREEN-API: instancia autorizada y proveedor sano', async ({ request }) => {
  const response = await request.get('/api/green-health');
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

  console.log('GREEN_HEALTH', JSON.stringify({ status: response.status(), data }));

  expect(response.status(), `GREEN-API health HTTP ${response.status()}: ${text}`).toBe(200);
  expect(data?.ok, `GREEN-API health: ${text}`).toBe(true);
  expect(data?.providerHealthy, `GREEN-API proveedor degradado: ${text}`).toBe(true);
  expect(data?.degraded, `GREEN-API no debe estar degradado: ${text}`).not.toBe(true);
  expect(String(data?.state || '').toLowerCase(), `GREEN-API instancia no autorizada: ${text}`).toBe('authorized');
});
