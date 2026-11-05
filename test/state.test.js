'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readState, writeState, clearState } = require('../src/state');

test('writes, reads, and clears the language override', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-translator-'));
  const file = path.join(directory, 'state.json');

  try {
    writeState('ja', 'en', file);
    assert.deepEqual(readState(file), { sourceLanguage: 'ja', targetLanguage: 'en' });
    writeState('de', 'fr', file);
    assert.deepEqual(readState(file), { sourceLanguage: 'de', targetLanguage: 'fr' });
    clearState(file);
    assert.deepEqual(readState(file), {});
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
