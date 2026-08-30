'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSystemPrompt } = require('../src/prompt');

test('builds a deterministic smart bilingual instruction', () => {
  const prompt = buildSystemPrompt({ smart: true });
  assert.match(prompt, /predominantly Chinese/);
  assert.match(prompt, /natural English/);
  assert.match(prompt, /Simplified Chinese/);
});

test('supports automatic source detection for a custom target', () => {
  const prompt = buildSystemPrompt({ source: 'auto', target: 'ja', smart: false });
  assert.match(prompt, /Detect the source language and translate it to ja/);
});
