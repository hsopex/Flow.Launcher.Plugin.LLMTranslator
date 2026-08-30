'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseQuery, resolveDirection } = require('../src/commands');

test('parses the default translation syntax', () => {
  const command = parseQuery('Hello, world');
  assert.equal(command.kind, 'translation');
  assert.equal(command.execute, false);
  assert.equal(command.text, 'Hello, world');
  assert.equal(command.profileSelector, null);
  assert.deepEqual(resolveDirection(command, 'en', 'zh-CN'), { smart: false, source: 'en', target: 'zh-CN' });
});

test('parses profile selection and reverse direction', () => {
  const command = parseQuery('@claude r Keep  internal   spacing');
  assert.equal(command.profileSelector, 'claude');
  assert.equal(command.text, 'Keep  internal   spacing');
  assert.deepEqual(resolveDirection(command, 'en', 'zh-CN'), { smart: false, source: 'zh-CN', target: 'en' });
});

test('parses internal run marker and an explicit language pair', () => {
  const command = parseQuery(':run @chat ja>en こんにちは');
  assert.equal(command.execute, true);
  assert.equal(command.executionSpec, '@chat ja>en こんにちは');
  assert.deepEqual(resolveDirection(command, 'en', 'zh-CN'), { smart: false, source: 'ja', target: 'en' });
});

test('uses smart bilingual mode only for a default direction', () => {
  const command = parseQuery('你好，世界');
  assert.deepEqual(resolveDirection(command, 'en', 'zh-CN', 'smart'), {
    smart: true,
    source: null,
    target: null,
  });
  const reverse = parseQuery('r 你好');
  assert.deepEqual(resolveDirection(reverse, 'en', 'zh-CN', 'smart'), {
    smart: false,
    source: 'zh-CN',
    target: 'en',
  });
});

test('parses set and reset commands', () => {
  assert.deepEqual(parseQuery(':set de fr'), {
    kind: 'set-languages',
    reset: false,
    source: 'de',
    target: 'fr',
  });
  assert.deepEqual(parseQuery(':set reset'), { kind: 'set-languages', reset: true });
});

test('rejects a translation without text', () => {
  assert.throws(() => parseQuery('@chat en>zh-CN'), /Enter text/);
});
