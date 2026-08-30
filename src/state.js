'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { STATE_FILE_NAME } = require('./constants');

function defaultStateFile() {
  return path.join(__dirname, '..', STATE_FILE_NAME);
}

function readState(filePath = defaultStateFile()) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (typeof parsed.sourceLanguage === 'string' && typeof parsed.targetLanguage === 'string') {
      return {
        sourceLanguage: parsed.sourceLanguage,
        targetLanguage: parsed.targetLanguage,
      };
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      // A corrupted state file should not make the plugin unusable.
    }
  }
  return {};
}

function writeState(sourceLanguage, targetLanguage, filePath = defaultStateFile()) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  const payload = `${JSON.stringify({ sourceLanguage, targetLanguage }, null, 2)}\n`;
  fs.writeFileSync(temporaryPath, payload, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporaryPath, filePath);
}

function clearState(filePath = defaultStateFile()) {
  try {
    fs.unlinkSync(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

module.exports = {
  defaultStateFile,
  readState,
  writeState,
  clearState,
};
