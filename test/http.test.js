'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { postJson } = require('../src/http');

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address()));
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

test('follows a 307 redirect without losing the POST body', async () => {
  const calls = [];
  const server = http.createServer((request, response) => {
    let raw = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { raw += chunk; });
    request.on('end', () => {
      calls.push({ method: request.method, url: request.url, body: raw });
      if (request.url === '/redirect') {
        response.statusCode = 307;
        response.setHeader('location', '/target');
        response.end();
        return;
      }
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ ok: true }));
    });
  });

  try {
    const address = await listen(server);
    const payload = await postJson(`http://127.0.0.1:${address.port}/redirect`, {
      headers: { authorization: 'Bearer key' },
      body: { hello: 'world' },
      timeoutMs: 2000,
    });

    assert.deepEqual(payload, { ok: true });
    assert.equal(calls.length, 2);
    assert.equal(calls[1].method, 'POST');
    assert.equal(calls[1].url, '/target');
    assert.deepEqual(JSON.parse(calls[1].body), { hello: 'world' });
  } finally {
    await close(server);
  }
});

test('reports a timeout when the API does not respond', async () => {
  const sockets = new Set();
  const server = http.createServer(() => {});
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  try {
    const address = await listen(server);
    await assert.rejects(() => postJson(`http://127.0.0.1:${address.port}/slow`, {
      headers: {},
      body: { hello: 'world' },
      timeoutMs: 100,
    }), /timed out/);
  } finally {
    for (const socket of sockets) socket.destroy();
    await close(server);
  }
});

test('uses an injected fetch implementation when provided', async () => {
  const requests = [];
  const payload = await postJson('https://example.test/v1/chat/completions', {
    headers: { authorization: 'Bearer key' },
    body: { hello: 'world' },
    timeoutMs: 1000,
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify({ choices: [] }),
      };
    },
  });

  assert.deepEqual(payload, { choices: [] });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(requests[0].options.body), { hello: 'world' });
});
