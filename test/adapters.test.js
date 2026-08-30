'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { translate } = require('../src/adapters');

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address()));
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

test('sends and parses all three API formats', async (context) => {
  const calls = [];
  const server = http.createServer((request, response) => {
    let raw = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { raw += chunk; });
    request.on('end', () => {
      calls.push({
        url: request.url,
        headers: request.headers,
        body: JSON.parse(raw),
      });
      response.setHeader('content-type', 'application/json');
      if (request.url === '/v1/chat/completions') {
        response.end(JSON.stringify({ choices: [{ message: { content: '聊天译文' } }] }));
      } else if (request.url === '/v1/responses') {
        response.end(JSON.stringify({
          output: [{ type: 'message', content: [{ type: 'output_text', text: '响应译文' }] }],
        }));
      } else if (request.url === '/v1/messages') {
        response.end(JSON.stringify({ content: [{ type: 'text', text: 'Claude 译文' }] }));
      } else {
        response.statusCode = 404;
        response.end(JSON.stringify({ error: { message: 'not found' } }));
      }
    });
  });
  context.after(() => close(server));
  const address = await listen(server);
  const baseUrl = `http://127.0.0.1:${address.port}/v1`;
  const request = {
    text: 'hello',
    source: 'en',
    target: 'zh-CN',
    timeoutMs: 2000,
    maxOutputTokens: 256,
  };

  const chat = await translate({
    type: 'chat', alias: 'chat', label: 'Chat Completions', baseUrl, endpoint: '/chat/completions', apiKey: 'chat-key', model: 'chat-model',
  }, request);
  const responses = await translate({
    type: 'responses', alias: 'responses', label: 'Responses', baseUrl, endpoint: '/responses', apiKey: 'responses-key', model: 'responses-model',
  }, request);
  const claude = await translate({
    type: 'claude', alias: 'claude', label: 'Claude', baseUrl, endpoint: '/messages', apiKey: 'claude-key', model: 'claude-model',
  }, request);

  assert.equal(chat, '聊天译文');
  assert.equal(responses, '响应译文');
  assert.equal(claude, 'Claude 译文');
  assert.equal(calls[0].headers.authorization, 'Bearer chat-key');
  assert.equal(calls[0].body.messages[0].role, 'system');
  assert.equal(calls[1].headers.authorization, 'Bearer responses-key');
  assert.equal(calls[1].body.store, false);
  assert.equal(calls[2].headers['x-api-key'], 'claude-key');
  assert.equal(calls[2].headers['anthropic-version'], '2023-06-01');
  assert.equal(calls[2].body.max_tokens, 256);
});

test('surfaces HTTP errors without accepting an empty translation', async (context) => {
  const server = http.createServer((_request, response) => {
    response.statusCode = 429;
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ error: { message: 'rate limited' } }));
  });
  context.after(() => close(server));
  const address = await listen(server);

  await assert.rejects(() => translate({
    type: 'chat', alias: 'chat', label: 'Chat Completions', baseUrl: `http://127.0.0.1:${address.port}/v1`, endpoint: '/chat/completions', apiKey: 'key', model: 'model',
  }, {
    text: 'hello', source: 'en', target: 'zh-CN', timeoutMs: 2000, maxOutputTokens: 32,
  }), /API 429: rate limited/);
});
