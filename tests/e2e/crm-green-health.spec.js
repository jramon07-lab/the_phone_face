const { test, expect } = require('@playwright/test');

async function readHealth(request) {
  const response = await request.get('/api/green-health');
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  console.log('GREEN_HEALTH', JSON.stringify({ status: response.status(), data }));
  return { response, text, data };
}

test('GREEN-API: instancia autorizada y proveedor sano', async ({ request }) => {
  let last;

  for (let attempt = 1; attempt <= 13; attempt++) {
    last = await readHealth(request);
    const state = String(last.data?.state || '').toLowerCase();

    expect(last.response.status(), `GREEN-API health HTTP ${last.response.status()}: ${last.text}`).toBe(200);
    expect(last.data?.ok, `GREEN-API health: ${last.text}`).toBe(true);
    expect(last.data?.providerHealthy, `GREEN-API proveedor degradado: ${last.text}`).toBe(true);
    expect(last.data?.degraded, `GREEN-API no debe estar degradado: ${last.text}`).not.toBe(true);

    if (state === 'authorized') return;
    if (state !== 'starting') break;
    if (attempt < 13) await new Promise(resolve => setTimeout(resolve, 5000));
  }

  expect(
    String(last?.data?.state || '').toLowerCase(),
    `GREEN-API instancia no autorizada tras esperar estado transitorio: ${last?.text || ''}`
  ).toBe('authorized');
});
