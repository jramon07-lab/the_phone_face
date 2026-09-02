const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../api/mobile-green.js'), 'utf8');
const testSource = source
  .replace(/import greenHandler from ['"]\.\/green\.js['"];?/, 'const greenHandler=globalThis.__greenHandler;')
  .replace(/import greenReadSafeHandler from ['"]\.\/green-read-safe\.js['"];?/, 'const greenReadSafeHandler=globalThis.__greenReadSafeHandler;')
  .replace('export default async function handler', 'async function handler')
  .concat('\nglobalThis.__mobileGreenHandler=handler;\n');

assert.notEqual(testSource, source, 'No se pudo preparar el proxy para la prueba');

function mockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; }
  };
}

function permissionResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return payload; }
  };
}

function loadHandler({ fetchImpl, greenHandler, greenReadSafeHandler = greenHandler }) {
  const context = {
    __greenHandler: greenHandler,
    __greenReadSafeHandler: greenReadSafeHandler,
    fetch: fetchImpl,
    AbortController,
    setTimeout,
    clearTimeout,
    console: { error() {} },
    process: { env: {} }
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(testSource, context);
  return context.__mobileGreenHandler;
}

async function run() {
  {
    let authCalls = 0;
    let greenCalls = 0;
    const handler = loadHandler({
      fetchImpl: async () => { authCalls += 1; throw new Error('No debe consultar Supabase'); },
      greenHandler: async () => { greenCalls += 1; }
    });
    const res = mockResponse();
    await handler({ method: 'GET', query: { action: 'summary' }, headers: {} }, res);
    assert.equal(res.statusCode, 401);
    assert.equal(authCalls, 0);
    assert.equal(greenCalls, 0);
  }

  {
    let greenCalls = 0;
    const handler = loadHandler({
      fetchImpl: async () => permissionResponse(401, { message: 'invalid JWT' }),
      greenHandler: async () => { greenCalls += 1; }
    });
    const res = mockResponse();
    await handler({ method: 'GET', query: { action: 'summary' }, headers: { authorization: 'Bearer invalid' } }, res);
    assert.equal(res.statusCode, 401);
    assert.equal(greenCalls, 0);
  }

  {
    let greenCalls = 0;
    const handler = loadHandler({
      fetchImpl: async () => permissionResponse(200, { is_admin: false, can_use_whatsapp: false }),
      greenHandler: async () => { greenCalls += 1; }
    });
    const res = mockResponse();
    await handler({ method: 'GET', query: { action: 'summary' }, headers: { authorization: 'Bearer valid' } }, res);
    assert.equal(res.statusCode, 403);
    assert.equal(greenCalls, 0);
  }

  {
    const authRequests = [];
    let greenCalls = 0;
    const handler = loadHandler({
      fetchImpl: async (url, options) => {
        authRequests.push({ url, options });
        return permissionResponse(200, [{ is_admin: false, can_use_whatsapp: true }]);
      },
      greenHandler: async (_req, res) => {
        greenCalls += 1;
        return res.status(200).json({ ok: true, delegated: true });
      }
    });
    const res = mockResponse();
    await handler({ method: 'GET', query: { action: 'summary' }, headers: { authorization: 'Bearer valid-user-token' } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { ok: true, delegated: true });
    assert.equal(greenCalls, 1);
    assert.equal(authRequests.length, 1);
    assert.match(authRequests[0].url, /\/rest\/v1\/rpc\/current_user_permissions$/);
    assert.equal(authRequests[0].options.headers.Authorization, 'Bearer valid-user-token');
    assert.equal(authRequests[0].options.body, '{}');
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.equal(res.headers.vary, 'Authorization');
  }

  {
    let delegatedAction = '';
    const handler = loadHandler({
      fetchImpl: async () => permissionResponse(200, { can_use_whatsapp: true }),
      greenHandler: async (req, res) => {
        delegatedAction = req.query.action;
        return res.status(200).json({ ok: true, chats: [] });
      }
    });
    const res = mockResponse();
    await handler({ method: 'GET', query: { action: 'chats' }, headers: { authorization: 'Bearer valid' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(delegatedAction, 'chats');
  }

  {
    let authCalls = 0;
    let greenCalls = 0;
    const handler = loadHandler({
      fetchImpl: async () => { authCalls += 1; return permissionResponse(200, { is_admin: true }); },
      greenHandler: async (_req, res) => { greenCalls += 1; return res.status(200).json({ ok: true }); }
    });
    const res = mockResponse();
    await handler({ method: 'POST', query: { action: 'send' }, headers: { authorization: 'Bearer admin-token' }, body: { chatId: '612345678', message: 'Hola' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(authCalls, 1);
    assert.equal(greenCalls, 1);
  }

  {
    let greenCalls = 0;
    const handler = loadHandler({
      fetchImpl: async () => permissionResponse(200, { is_admin: 'false', can_use_whatsapp: 'false' }),
      greenHandler: async () => { greenCalls += 1; }
    });
    const res = mockResponse();
    await handler({ method: 'GET', query: { action: 'summary' }, headers: { authorization: 'Bearer valid' } }, res);
    assert.equal(res.statusCode, 403);
    assert.equal(greenCalls, 0);
  }

  {
    let delegatedBody = null;
    const handler = loadHandler({
      fetchImpl: async () => permissionResponse(200, { is_admin: true }),
      greenHandler: async (req, res) => { delegatedBody = req.body; return res.status(200).json({ ok: true }); }
    });
    const res = mockResponse();
    await handler({ method: 'POST', query: { action: 'history' }, headers: { authorization: 'Bearer admin' }, body: { chatId: '612345678', count: 100 } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(delegatedBody.chatId, '34612345678@c.us');
    assert.equal(delegatedBody.count, 100);
  }

  for (const count of [0, 201, 1.5, 'no-numérico']) {
    let greenCalls = 0;
    const handler = loadHandler({
      fetchImpl: async () => permissionResponse(200, { is_admin: true }),
      greenHandler: async () => { greenCalls += 1; }
    });
    const res = mockResponse();
    await handler({ method: 'POST', query: { action: 'history' }, headers: { authorization: 'Bearer admin' }, body: { chatId: '612345678', count } }, res);
    assert.equal(res.statusCode, 400, `history debe rechazar count=${count}`);
    assert.equal(greenCalls, 0);
  }

  {
    let delegatedBody = null;
    const handler = loadHandler({
      fetchImpl: async () => permissionResponse(200, { can_use_whatsapp: true }),
      greenHandler: async (req, res) => { delegatedBody = req.body; return res.status(200).json({ ok: true }); }
    });
    const res = mockResponse();
    await handler({ method: 'POST', query: { action: 'history' }, headers: { authorization: 'Bearer valid' }, body: { chatId: '120363123456789012@g.us', count: 200 } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(delegatedBody.chatId, '120363123456789012@g.us');
    assert.equal(delegatedBody.count, 200);
  }

  {
    let greenCalls = 0;
    const handler = loadHandler({
      fetchImpl: async () => permissionResponse(200, { can_use_whatsapp: true }),
      greenHandler: async () => { greenCalls += 1; }
    });
    const res = mockResponse();
    await handler({ method: 'POST', query: { action: 'history' }, headers: { authorization: 'Bearer valid' }, body: { chatId: '-----@g.us', count: 100 } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(greenCalls, 0);
  }

  {
    let greenCalls = 0;
    let safeCalls = 0;
    let safeBody = null;
    const handler = loadHandler({
      fetchImpl: async () => permissionResponse(200, { can_use_whatsapp: true }),
      greenHandler: async () => { greenCalls += 1; },
      greenReadSafeHandler: async (req, res) => {
        safeCalls += 1;
        safeBody = req.body;
        return res.status(200).json({ ok: true, setRead: false, degraded: true, reason: 'provider_rejected' });
      }
    });
    const res = mockResponse();
    await handler({ method: 'POST', query: { action: 'read' }, headers: { authorization: 'Bearer valid' }, body: { chatId: '612345678', idMessage: '  msg-123  ' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(greenCalls, 0);
    assert.equal(safeCalls, 1);
    assert.equal(safeBody.chatId, '34612345678@c.us');
    assert.equal(safeBody.idMessage, 'msg-123');
    assert.deepEqual(res.body, { ok: true, setRead: false, degraded: true, reason: 'provider_rejected' });
  }

  {
    let safeBody = null;
    const handler = loadHandler({
      fetchImpl: async () => permissionResponse(200, { can_use_whatsapp: true }),
      greenHandler: async () => { throw new Error('read no debe llegar al handler general'); },
      greenReadSafeHandler: async (req, res) => {
        safeBody = req.body;
        return res.status(200).json({ ok: true, setRead: false, degraded: true, reason: 'network_error' });
      }
    });
    const res = mockResponse();
    await handler({ method: 'POST', query: { action: 'read' }, headers: { authorization: 'Bearer valid' }, body: { chatId: '612345678' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(safeBody.chatId, '34612345678@c.us');
    assert.equal(Object.hasOwn(safeBody, 'idMessage'), false);
    assert.equal(res.body.degraded, true);
  }

  for (const action of ['file', 'read']) {
    let delegatedCalls = 0;
    const handler = loadHandler({
      fetchImpl: async () => permissionResponse(200, { can_use_whatsapp: true }),
      greenHandler: async () => { delegatedCalls += 1; },
      greenReadSafeHandler: async () => { delegatedCalls += 1; }
    });
    const res = mockResponse();
    await handler({ method: 'POST', query: { action }, headers: { authorization: 'Bearer valid' }, body: { chatId: '612345678', idMessage: 'x'.repeat(257) } }, res);
    assert.equal(res.statusCode, 400, `${action} debe limitar idMessage`);
    assert.equal(delegatedCalls, 0);
  }

  {
    let delegatedBody = null;
    const handler = loadHandler({
      fetchImpl: async () => permissionResponse(200, { can_use_whatsapp: true }),
      greenHandler: async (req, res) => { delegatedBody = req.body; return res.status(200).json({ ok: true }); }
    });
    const res = mockResponse();
    await handler({ method: 'POST', query: { action: 'sendfile' }, headers: { authorization: 'Bearer valid' }, body: {
      chatId: '612345678', fileName: ' foto.jpg ', mimeType: 'image/jpeg', caption: ' Foto ', dataUrl: 'data:image/jpeg;base64,AQID'
    } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(delegatedBody.chatId, '34612345678@c.us');
    assert.equal(delegatedBody.fileName, 'foto.jpg');
    assert.equal(delegatedBody.mimeType, 'image/jpeg');
    assert.equal(delegatedBody.caption, 'Foto');
    assert.equal(delegatedBody.dataUrl, 'data:image/jpeg;base64,AQID');
  }

  {
    let greenCalls = 0;
    const maxDataUrl = `data:application/octet-stream;base64,${Buffer.alloc(2500000).toString('base64')}`;
    const handler = loadHandler({
      fetchImpl: async () => permissionResponse(200, { can_use_whatsapp: true }),
      greenHandler: async (_req, res) => { greenCalls += 1; return res.status(200).json({ ok: true }); }
    });
    const res = mockResponse();
    await handler({ method: 'POST', query: { action: 'sendfile' }, headers: { authorization: 'Bearer valid' }, body: {
      chatId: '612345678', fileName: 'limite.bin', mimeType: 'application/octet-stream', caption: '', dataUrl: maxDataUrl
    } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(greenCalls, 1, '2,5 MB exactos deben estar permitidos');
  }

  const oversizedDataUrl = `data:application/octet-stream;base64,${Buffer.alloc(2500001).toString('base64')}`;
  const invalidFiles = [
    { fileName: 'x'.repeat(181), mimeType: 'image/jpeg', caption: '', dataUrl: 'data:image/jpeg;base64,AQID' },
    { fileName: 'foto.jpg', mimeType: `image/${'x'.repeat(121)}`, caption: '', dataUrl: 'data:image/jpeg;base64,AQID' },
    { fileName: 'foto.jpg', mimeType: 'image/jpeg', caption: 'x'.repeat(1025), dataUrl: 'data:image/jpeg;base64,AQID' },
    { fileName: 'foto.jpg', mimeType: 'image/jpeg', caption: '', dataUrl: 'data:image/jpeg;base64,%%%=' },
    { fileName: 'foto.jpg', mimeType: 'image/jpeg', caption: '', dataUrl: oversizedDataUrl }
  ];
  for (const body of invalidFiles) {
    let greenCalls = 0;
    const handler = loadHandler({
      fetchImpl: async () => permissionResponse(200, { can_use_whatsapp: true }),
      greenHandler: async () => { greenCalls += 1; }
    });
    const res = mockResponse();
    await handler({ method: 'POST', query: { action: 'sendfile' }, headers: { authorization: 'Bearer valid' }, body: { chatId: '612345678', ...body } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(greenCalls, 0);
  }

  {
    let greenCalls = 0;
    const handler = loadHandler({
      fetchImpl: async () => permissionResponse(200, { can_use_whatsapp: true }),
      greenHandler: async () => { greenCalls += 1; }
    });
    const res = mockResponse();
    await handler({ method: 'POST', query: { action: 'send' }, headers: { authorization: 'Bearer valid' }, body: { chatId: 'bad@evil', message: 'Hola' } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(greenCalls, 0);
  }

  for (const action of ['notifications', 'notification', 'settings', 'ensure', 'webhook']) {
    let authCalls = 0;
    let greenCalls = 0;
    const handler = loadHandler({
      fetchImpl: async () => { authCalls += 1; },
      greenHandler: async () => { greenCalls += 1; }
    });
    const res = mockResponse();
    await handler({ method: action === 'notifications' ? 'GET' : 'POST', query: { action }, headers: { authorization: 'Bearer valid' } }, res);
    assert.equal(res.statusCode, 405, `${action} debe quedar fuera del proxy móvil`);
    assert.equal(authCalls, 0);
    assert.equal(greenCalls, 0);
  }

  {
    let authCalls = 0;
    let greenCalls = 0;
    const handler = loadHandler({
      fetchImpl: async () => { authCalls += 1; },
      greenHandler: async () => { greenCalls += 1; }
    });
    const res = mockResponse();
    await handler({ method: 'GET', query: { action: 'send' }, headers: { authorization: 'Bearer valid' } }, res);
    assert.equal(res.statusCode, 405);
    assert.equal(res.headers.allow, 'POST');
    assert.equal(authCalls, 0);
    assert.equal(greenCalls, 0);
  }

  {
    let greenCalls = 0;
    const handler = loadHandler({
      fetchImpl: async () => permissionResponse(500, { message: 'unavailable' }),
      greenHandler: async () => { greenCalls += 1; }
    });
    const res = mockResponse();
    await handler({ method: 'GET', query: { action: 'state' }, headers: { authorization: 'Bearer valid' } }, res);
    assert.equal(res.statusCode, 503);
    assert.equal(greenCalls, 0);
  }

  console.log('mobile GREEN proxy auth guard: ok');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
