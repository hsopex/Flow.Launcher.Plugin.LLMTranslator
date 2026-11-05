'use strict';

const { parseQuery, resolveDirection } = require('./commands');
const { translate } = require('./adapters');
const {
  normalizeSettings,
  normalizeTranslationMode,
  selectProfile,
  validateProfile,
} = require('./settings');
const { readState } = require('./state');
const {
  response,
  helpResults,
  confirmationResult,
  translationResult,
  setLanguagesResult,
  errorResult,
} = require('./results');

const TRANSLATION_MODE_LABELS = {
  smart: 'Smart bilingual',
  custom: 'Custom language pair',
};

function settingsMigration(settings) {
  const current = settings?.translationMode;
  if (typeof current !== 'string' || !current.trim()) return null;

  const canonical = TRANSLATION_MODE_LABELS[normalizeTranslationMode(current)];
  return current === canonical ? null : { translationMode: canonical };
}

function effectiveLanguages(config, state) {
  return {
    source: state.sourceLanguage || config.sourceLanguage,
    target: state.targetLanguage || config.targetLanguage,
  };
}

async function handleQuery({
  input,
  settings = {},
  stateFile,
  translateFn = translate,
  fetchImpl,
}) {
  const config = normalizeSettings(settings);
  const secrets = config.profiles.map((profile) => profile.apiKey);
  const settingsChange = settingsMigration(settings);
  const send = (results) => {
    const payload = response(results);
    return settingsChange ? { ...payload, SettingsChange: settingsChange } : payload;
  };

  try {
    const command = parseQuery(input);
    if (command.kind === 'help') {
      return send(helpResults(config));
    }
    if (command.kind === 'set-languages') {
      return send([setLanguagesResult(command)]);
    }

    const state = readState(stateFile);
    const languages = effectiveLanguages(config, state);
    const direction = resolveDirection(command, languages.source, languages.target, config.translationMode);
    const profile = selectProfile(config, command.profileSelector);
    validateProfile(profile);

    if (!command.execute) {
      return send([confirmationResult(command, profile, direction)]);
    }

    const translatedText = await translateFn(profile, {
      text: command.text,
      source: direction.source,
      target: direction.target,
      smart: direction.smart,
      timeoutMs: config.timeoutMs,
      maxOutputTokens: config.maxOutputTokens,
    }, { fetchImpl });

    return send([translationResult(translatedText, profile, direction)]);
  } catch (error) {
    return send([errorResult(error, secrets)]);
  }
}

module.exports = {
  handleQuery,
  effectiveLanguages,
};
