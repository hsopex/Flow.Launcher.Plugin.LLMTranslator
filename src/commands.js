'use strict';

const { UserError } = require('./errors');

function consumeToken(value) {
  const trimmed = String(value ?? '').trimStart();
  if (!trimmed) {
    return { token: '', rest: '' };
  }

  const match = /^(\S+)(?:\s+|$)/u.exec(trimmed);
  return {
    token: match[1],
    rest: trimmed.slice(match[0].length),
  };
}

function validateLanguage(value, label) {
  if (!value || value.length > 32 || /[\s>@]/u.test(value)) {
    throw new UserError(`${label} must be a language code or a one-word language name.`);
  }
  return value;
}

function parseSetCommand(input) {
  const parts = String(input).trim().split(/\s+/u);
  if (parts.length === 2 && parts[1].toLowerCase() === 'reset') {
    return { kind: 'set-languages', reset: true };
  }
  if (parts.length !== 3) {
    throw new UserError('Usage: tt :set <source> <target>, for example tt :set en zh-CN.');
  }

  return {
    kind: 'set-languages',
    reset: false,
    source: validateLanguage(parts[1], 'Source language'),
    target: validateLanguage(parts[2], 'Target language'),
  };
}

function parseQuery(input) {
  const normalized = String(input ?? '').trim();
  if (!normalized) {
    return { kind: 'help' };
  }

  if (/^:set(?:\s|$)/iu.test(normalized)) {
    return parseSetCommand(normalized);
  }

  let rest = normalized;
  let execute = false;
  let current = consumeToken(rest);

  if (current.token.toLowerCase() === ':run') {
    execute = true;
    rest = current.rest;
    current = consumeToken(rest);
  }

  let profileSelector = null;
  if (current.token.startsWith('@')) {
    profileSelector = current.token.slice(1);
    if (!profileSelector) {
      throw new UserError('A profile name is required after @.');
    }
    rest = current.rest;
    current = consumeToken(rest);
  }

  let direction = { kind: 'default' };
  if (current.token.toLowerCase() === 'r') {
    direction = { kind: 'reverse' };
    rest = current.rest;
  } else {
    const languagePair = /^([^>\s]+)>([^>\s]+)$/u.exec(current.token);
    if (languagePair) {
      direction = {
        kind: 'explicit',
        source: validateLanguage(languagePair[1], 'Source language'),
        target: validateLanguage(languagePair[2], 'Target language'),
      };
      rest = current.rest;
    }
  }

  const text = rest.trim();
  if (!text) {
    throw new UserError('Enter text to translate.');
  }

  const executionSpec = normalized.replace(/^:run(?:\s+|$)/iu, '').trim();
  return {
    kind: 'translation',
    execute,
    profileSelector,
    direction,
    text,
    executionSpec,
  };
}

function resolveDirection(command, source, target, translationMode = 'custom') {
  if (command.direction.kind === 'explicit') {
    return {
      smart: false,
      source: command.direction.source,
      target: command.direction.target,
    };
  }
  if (command.direction.kind === 'reverse') {
    return { smart: false, source: target, target: source };
  }
  if (translationMode === 'smart') {
    return { smart: true, source: null, target: null };
  }
  return { smart: false, source, target };
}

module.exports = {
  parseQuery,
  resolveDirection,
  validateLanguage,
};
