'use strict';

const { parseQuery, resolveDirection } = require('./commands');
const { translate } = require('./adapters');
const { normalizeSettings, selectProfile, validateProfile } = require('./settings');
const { readState } = require('./state');
const {
  response,
  helpResults,
  confirmationResult,
  translationResult,
  setLanguagesResult,
  errorResult,
} = require('./results');

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

  try {
    const command = parseQuery(input);
    if (command.kind === 'help') {
      return response(helpResults(config));
    }
    if (command.kind === 'set-languages') {
      return response([setLanguagesResult(command)]);
    }

    const state = readState(stateFile);
    const languages = effectiveLanguages(config, state);
    const direction = resolveDirection(command, languages.source, languages.target, config.translationMode);
    const profile = selectProfile(config, command.profileSelector);
    validateProfile(profile);

    if (!command.execute) {
      return response([confirmationResult(command, profile, direction)]);
    }

    const translatedText = await translateFn(profile, {
      text: command.text,
      source: direction.source,
      target: direction.target,
      smart: direction.smart,
      timeoutMs: config.timeoutMs,
      maxOutputTokens: config.maxOutputTokens,
    }, { fetchImpl });

    return response([translationResult(translatedText, profile, direction)]);
  } catch (error) {
    return response([errorResult(error, secrets)]);
  }
}

module.exports = {
  handleQuery,
  effectiveLanguages,
};
