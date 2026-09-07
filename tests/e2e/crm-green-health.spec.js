const { test, expect } = require('@playwright/test');

async function readHealth(request) {
  const response = await request.get('/api/green-health');
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  console.log('GREEN_HEALTH', JSON.stringify({ status: response.status(), data }));
  return { response, text, data };
}

test('GREEN-API: instancia sana o límite temporal controlado', async ({ request }) => {
  const last = await readHealth(request);
  expect(last.response.status(), `GREEN-API health HTTP ${last.response.status()}: ${last.text}`).toBe(200);
  expect(last.data?.ok, `GREEN-API health: ${last.text}`).toBe(true);
  if(last.data?.degraded){
    expect(last.data?.providerStatus, `Degradación no controlada: ${last.text}`).toBe(429);
    expect(last.data?.checks?.[0]?.attempts).toBe(1);
    return;
  }
  expect(last.data?.providerHealthy, `GREEN-API proveedor no sano: ${last.text}`).toBe(true);
  expect(String(last.data?.state || '').toLowerCase(), `GREEN-API no autorizada: ${last.text}`).toBe('authorized');
});
