'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSettings, selectProfile, buildEndpoint } = require('../src/settings');

test('normalizes defaults and clamps numeric settings', () => {
  const config = normalizeSettings({ requestTimeoutSeconds: '999', maxOutputTokens: '0' });
  assert.equal(config.timeoutMs, 120000);
  assert.equal(config.maxOutputTokens, 1);
  assert.equal(config.sourceLanguage, 'en');
  assert.equal(config.targetLanguage, 'zh-CN');
  assert.equal(config.translationMode, 'smart');
});

test('uses custom mode when selected in Flow settings', () => {
  assert.equal(
    normalizeSettings({ translationMode: 'Custom language pair / 自定义语言方向' }).translationMode,
    'custom',
  );
});

test('selects profiles by canonical type and configured alias', () => {
  const config = normalizeSettings({
    defaultProfile: 'Responses',
    responsesAlias: 'fast',
  });
  assert.equal(selectProfile(config).type, 'responses');
  assert.equal(selectProfile(config, 'fast').type, 'responses');
  assert.equal(selectProfile(config, 'claude').type, 'claude');
});

test('builds provider endpoints without duplicating endpoint paths', () => {
  const config = normalizeSettings({
    chatApiKey: 'key',
    chatModel: 'model',
    chatBaseUrl: 'https://example.test/v1/',
    responsesApiKey: 'key',
    responsesModel: 'model',
    responsesBaseUrl: 'https://example.test/v1/responses',
  });
  assert.equal(buildEndpoint(config.profiles[0]), 'https://example.test/v1/chat/completions');
  assert.equal(buildEndpoint(config.profiles[1]), 'https://example.test/v1/responses');
});

test('rejects incomplete profiles', () => {
  const config = normalizeSettings({ chatApiKey: '', chatModel: '' });
  assert.throws(() => buildEndpoint(config.profiles[0]), /API key is not configured/);
});
