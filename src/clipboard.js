'use strict';

const { spawn } = require('node:child_process');
const { UserError } = require('./errors');

function copyToClipboard(text) {
  return new Promise((resolve, reject) => {
    const command = [
      '[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false);',
      '$value = [Console]::In.ReadToEnd();',
      'Set-Clipboard -Value $value',
    ].join(' ');
    const child = spawn('powershell.exe', [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      command,
    ], {
      windowsHide: true,
      stdio: ['pipe', 'ignore', 'pipe'],
    });

    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => reject(new UserError(`Could not start clipboard helper: ${error.message}`)));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new UserError(`Could not copy translation: ${stderr.trim() || `exit code ${code}`}`));
    });
    child.stdin.end(String(text), 'utf8');
  });
}

module.exports = {
  copyToClipboard,
};
