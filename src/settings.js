'use strict';

const { ConfigurationError } = require('./errors');
const { PROFILE_LABELS, PROFILE_TYPES } = require('./constants');

const TRANSLATION_MODES = Object.freeze({
  SMART: 'smart',
  CUSTOM: 'custom',
});

function stringValue(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function buildProfile(type, settings) {
  const definitions = {
    [PROFILE_TYPES.CHAT]: {
      prefix: 'chat',
      alias: 'chat',
      baseUrl: 'https://api.openai.com/v1',
      endpoint: '/chat/completions',
    },
    [PROFILE_TYPES.RESPONSES]: {
      prefix: 'responses',
      alias: 'responses',
      baseUrl: 'https://api.openai.com/v1',
      endpoint: '/responses',
    },
    [PROFILE_TYPES.CLAUDE]: {
      prefix: 'claude',
      alias: 'claude',
      baseUrl: 'https://api.anthropic.com/v1',
      endpoint: '/messages',
    },
  };
  const definition = definitions[type];
  const prefix = definition.prefix;

  return {
    type,
    label: PROFILE_LABELS[type],
    alias: stringValue(settings[`${prefix}Alias`], definition.alias),
    baseUrl: stringValue(settings[`${prefix}BaseUrl`], definition.baseUrl),
    apiKey: stringValue(settings[`${prefix}ApiKey`]),
    model: stringValue(settings[`${prefix}Model`]),
    endpoint: definition.endpoint,
  };
}

function normalizeDefaultProfile(value) {
  const candidate = stringValue(value, PROFILE_LABELS[PROFILE_TYPES.CHAT]).toLowerCase();
  for (const [type, label] of Object.entries(PROFILE_LABELS)) {
    if (candidate === type || candidate === label.toLowerCase()) return type;
  }
  return PROFILE_TYPES.CHAT;
}

function normalizeTranslationMode(value) {
  const candidate = stringValue(value, 'Smart bilingual').toLowerCase();
  if (candidate === TRANSLATION_MODES.CUSTOM || candidate.includes('custom') || candidate.includes('自定义')) {
    return TRANSLATION_MODES.CUSTOM;
  }
  return TRANSLATION_MODES.SMART;
}

function normalizeSettings(settings = {}) {
  const source = stringValue(settings.sourceLanguage, 'en');
  const target = stringValue(settings.targetLanguage, 'zh-CN');
  const profiles = [
    buildProfile(PROFILE_TYPES.CHAT, settings),
    buildProfile(PROFILE_TYPES.RESPONSES, settings),
    buildProfile(PROFILE_TYPES.CLAUDE, settings),
  ];

  return {
    defaultProfile: normalizeDefaultProfile(settings.defaultProfile),
    translationMode: normalizeTranslationMode(settings.translationMode),
    sourceLanguage: source || 'en',
    targetLanguage: target || 'zh-CN',
    timeoutMs: boundedInteger(settings.requestTimeoutSeconds, 30, 1, 120) * 1000,
    maxOutputTokens: boundedInteger(settings.maxOutputTokens, 2048, 1, 32768),
    profiles,
  };
}

function validateAlias(alias, label) {
  if (!alias || alias.length > 32 || /[\s@>]/u.test(alias)) {
    throw new ConfigurationError(`${label} profile name must be one word with at most 32 characters.`);
  }
}

function selectProfile(config, selector = null) {
  const requested = stringValue(selector || config.defaultProfile).toLowerCase();
  const matches = config.profiles.filter((profile) => {
    return profile.type === requested
      || profile.label.toLowerCase() === requested
      || profile.alias.toLowerCase() === requested;
  });

  if (matches.length === 0) {
    throw new ConfigurationError(`Unknown API profile "${selector}". Use @chat, @responses, @claude, or a configured profile name.`);
  }
  if (matches.length > 1) {
    throw new ConfigurationError(`Profile name "${selector}" is ambiguous. Give each profile a unique name.`);
  }
  return matches[0];
}

function validateProfile(profile) {
  validateAlias(profile.alias, profile.label);
  if (!profile.baseUrl) throw new ConfigurationError(`${profile.label} Base URL is not configured.`);
  if (!profile.apiKey) throw new ConfigurationError(`${profile.label} API key is not configured.`);
  if (!profile.model) throw new ConfigurationError(`${profile.label} model is not configured.`);

  let parsed;
  try {
    parsed = new URL(profile.baseUrl);
  } catch {
    throw new ConfigurationError(`${profile.label} Base URL is invalid.`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new ConfigurationError(`${profile.label} Base URL must use http or https.`);
  }
}

function buildEndpoint(profile) {
  validateProfile(profile);
  const url = new URL(profile.baseUrl);
  const basePath = url.pathname.replace(/\/+$/u, '');
  const endpointPath = profile.endpoint;
  if (!basePath.toLowerCase().endsWith(endpointPath.toLowerCase())) {
    url.pathname = `${basePath}${endpointPath}`.replace(/\/{2,}/gu, '/');
  }
  return url.toString();
}

module.exports = {
  TRANSLATION_MODES,
  normalizeSettings,
  normalizeTranslationMode,
  selectProfile,
  validateProfile,
  buildEndpoint,
};
