'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { handleQuery } = require('../src/application');

function completeSettings(overrides = {}) {
  return {
    defaultProfile: 'Chat Completions',
    sourceLanguage: 'en',
    targetLanguage: 'zh-CN',
    chatAlias: 'chat',
    chatBaseUrl: 'https://example.test/v1',
    chatApiKey: 'secret-key',
    chatModel: 'test-model',
    ...overrides,
  };
}

test('confirmation query never calls the translation API', async () => {
  let calls = 0;
  const result = await handleQuery({
    input: 'hello',
    settings: completeSettings(),
    stateFile: 'Z:\\path-that-does-not-exist\\state.json',
    translateFn: async () => { calls += 1; return '你好'; },
  });

  assert.equal(calls, 0);
  assert.equal(result.result[0].JsonRPCAction.method, 'run_translation');
  assert.match(result.result[0].Subtitle, /Smart bilingual/);
});

test('internal run query calls the translation API exactly once', async () => {
  let calls = 0;
  const result = await handleQuery({
    input: ':run @chat hello',
    settings: completeSettings(),
    stateFile: 'Z:\\path-that-does-not-exist\\state.json',
    translateFn: async (_profile, request) => {
      calls += 1;
      assert.equal(request.text, 'hello');
      assert.equal(request.smart, true);
      return '你好';
    },
  });

  assert.equal(calls, 1);
  assert.equal(result.result[0].Title, '你好');
  assert.equal(result.result[0].CopyText, '你好');
});

test('an explicit language pair overrides smart bilingual mode', async () => {
  const result = await handleQuery({
    input: ':run ja>en こんにちは',
    settings: completeSettings(),
    stateFile: 'Z:\\path-that-does-not-exist\\state.json',
    translateFn: async (_profile, request) => {
      assert.equal(request.smart, false);
      assert.equal(request.source, 'ja');
      assert.equal(request.target, 'en');
      return 'Hello';
    },
  });

  assert.equal(result.result[0].Title, 'Hello');
});

test('configuration and API errors redact keys', async () => {
  const result = await handleQuery({
    input: ':run hello',
    settings: completeSettings(),
    stateFile: 'Z:\\path-that-does-not-exist\\state.json',
    translateFn: async () => { throw new Error('request with secret-key failed'); },
  });

  assert.equal(result.result[0].Title, 'Translation failed');
  assert.doesNotMatch(result.result[0].Subtitle, /secret-key/);
  assert.match(result.result[0].Subtitle, /\[REDACTED\]/);
});
