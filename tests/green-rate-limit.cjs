const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../api/green.js'), 'utf8');
const testSource = source
  .replace('export default async function handler', 'async function handler')
  .concat('\nglobalThis.__greenHandler=handler;\n');

function response(status, payload, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 429 ? 'Too Many Requests' : '',
    headers: { get(name) { return headers[String(name).toLowerCase()] || null; } },
    async text() { return payload === null ? '' : JSON.stringify(payload); }
  };
}

function mockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    send(value) { this.body = value; return this; }
  };
}

function loadHandler(fetchImpl) {
  const context = {
    fetch: fetchImpl,
    AbortController,
    setTimeout,
    clearTimeout,
    URLSearchParams,
    Buffer,
    Blob,
    FormData,
    escape,
    console: { error() {} },
    process: {
      env: {
        GREEN_API_INSTANCE_ID: '1234',
        GREEN_API_TOKEN: 'test-token',
        GREEN_API_API_URL: 'https://provider.test'
      }
    }
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(testSource, context);
  return context.__greenHandler;
}

async function call(handler, method, action, body) {
  const req = { method, query: { action }, body: body || {} };
  const res = mockResponse();
  await handler(req, res);
  return res;
}

async function run() {
  {
    const calls = [];
    const handler = loadHandler(async (url) => {
      calls.push(String(url));
      if (String(url).includes('/getChats/')) {
        return response(200, [{ id: '34600000000@c.us', name: 'Cliente', lastMessage: { idMessage: 'native' } }]);
      }
      if (String(url).includes('/lastIncomingMessages/')) {
        return response(200, [{ chatId: '34600000000@c.us', idMessage: 'incoming', timestamp: 20, textMessage: 'Hola' }]);
      }
      if (String(url).includes('/lastOutgoingMessages/')) return response(200, []);
      throw new Error(`URL inesperada: ${url}`);
    });

    const [first, concurrent] = await Promise.all([
      call(handler, 'GET', 'summary'),
      call(handler, 'GET', 'summary')
    ]);
    const cached = await call(handler, 'GET', 'summary');

    assert.equal(first.statusCode, 200);
    assert.equal(concurrent.statusCode, 200);
    assert.equal(cached.statusCode, 200);
    assert.equal(cached.body.cached, true);
    assert.equal(calls.filter((url) => url.includes('/getChats/')).length, 1, 'debe deduplicar y cachear getChats');
    assert.equal(calls.filter((url) => url.includes('/getChatHistory/')).length, 0, 'el resumen no debe disparar historiales en ráfaga');
    assert.equal(first.body.chats[0]._lastMessage.idMessage, 'incoming');
  }

  {
    let historyCalls = 0;
    let failWith429 = false;
    let now = 0;
    const RealDate = Date;
    class FakeDate extends RealDate {
      static now() { return now; }
    }
    const responses = [];
    const contextFetch = async (url) => {
      if (!String(url).includes('/getChatHistory/')) throw new Error(`URL inesperada: ${url}`);
      historyCalls += 1;
      if (failWith429) return response(429, { message: 'Too Many Requests' }, { 'retry-after': '60' });
      return response(200, [{ idMessage: 'm1', timestamp: 1, textMessage: 'Mensaje' }]);
    };

    const context = {
      fetch: contextFetch,
      AbortController,
      setTimeout,
      clearTimeout,
      URLSearchParams,
      Buffer,
      Blob,
      FormData,
      escape,
      Date: FakeDate,
      console: { error() {} },
      process: { env: { GREEN_API_INSTANCE_ID: '1234', GREEN_API_TOKEN: 'test-token', GREEN_API_API_URL: 'https://provider.test' } }
    };
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(testSource, context);
    const handler = context.__greenHandler;

    responses.push(await call(handler, 'POST', 'history', { chatId: '34600000000@c.us', count: 40 }));
    responses.push(await call(handler, 'POST', 'history', { chatId: '34600000000@c.us', count: 40 }));
    now = 3000;
    failWith429 = true;
    responses.push(await call(handler, 'POST', 'history', { chatId: '34600000000@c.us', count: 40 }));
    responses.push(await call(handler, 'POST', 'history', { chatId: '34600000000@c.us', count: 40 }));

    assert.equal(historyCalls, 2, 'debe cachear la lectura y respetar el backoff tras 429');
    assert.equal(responses[1].body.cached, true);
    assert.equal(responses[2].statusCode, 200);
    assert.equal(responses[2].body.degraded, true);
    assert.equal(responses[2].body.providerStatus, 429);
    assert.equal(responses[3].body.cached, true);
    assert.equal(responses[3].body.messages[0].idMessage, 'm1');
  }

  console.log('GREEN-API rate limit guard OK');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
