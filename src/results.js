'use strict';

const { ACTION_KEYWORD, ICON_PATH } = require('./constants');

function result(title, subtitle, extra = {}) {
  return {
    Title: title,
    Subtitle: subtitle,
    IcoPath: ICON_PATH,
    ...extra,
  };
}

function response(results) {
  return { result: results };
}

function helpResults(config) {
  const profiles = config.profiles.map((profile) => `@${profile.alias}`).join(', ');
  return [
    result('Translate with an LLM', `Type ${ACTION_KEYWORD} <text>, then press Enter to translate.`),
    result('Smart translation', `${ACTION_KEYWORD} <text> detects the source language: Chinese → English, other languages → Simplified Chinese.`),
    result('Manual language direction', `${ACTION_KEYWORD} r <text> reverses the custom language pair; ${ACTION_KEYWORD} en>zh-CN <text> overrides it once.`),
    result('API profiles', `Use ${profiles} before the text to select a profile for one query.`),
    result('Set custom language pair', `${ACTION_KEYWORD} :set en zh-CN · ${ACTION_KEYWORD} :set reset restores settings-page defaults.`),
  ];
}

function confirmationResult(command, profile, direction) {
  const languageDescription = direction.smart
    ? 'Smart bilingual · 中文 → English · Other languages → 简体中文'
    : `${direction.source} → ${direction.target}`;
  return result(
    direction.smart ? 'Smart bilingual translation' : `Translate to ${direction.target}`,
    `${profile.alias} · ${languageDescription} · Press Enter to send one API request`,
    {
      JsonRPCAction: {
        method: 'run_translation',
        parameters: [command.executionSpec],
        dontHideAfterAction: true,
      },
      AutoCompleteText: `${ACTION_KEYWORD} ${command.executionSpec}`,
    },
  );
}

function translationResult(translation, profile, direction) {
  const languageDescription = direction.smart
    ? 'Smart bilingual · 中文 → English · Other languages → 简体中文'
    : `${direction.source} → ${direction.target}`;
  return result(
    translation,
    `${profile.alias} · ${profile.model} · ${languageDescription} · Enter or Ctrl+C to copy`,
    {
      CopyText: translation,
      JsonRPCAction: {
        method: 'copy_translation',
        parameters: [translation],
        dontHideAfterAction: false,
      },
    },
  );
}

function setLanguagesResult(command) {
  if (command.reset) {
    return result('Restore language defaults from settings', 'Press Enter to remove the :set override.', {
      JsonRPCAction: {
        method: 'reset_languages',
        parameters: [],
        dontHideAfterAction: false,
      },
    });
  }
  return result(`Set ${command.source} → ${command.target}`, 'Press Enter to save this language direction.', {
    JsonRPCAction: {
      method: 'set_languages',
      parameters: [command.source, command.target],
      dontHideAfterAction: false,
    },
  });
}

function errorResult(error, secrets = []) {
  let message = error?.message || String(error);
  for (const secret of secrets.filter(Boolean)) {
    message = message.split(secret).join('[REDACTED]');
  }
  message = message
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/giu, 'Bearer [REDACTED]')
    .slice(0, 500);

  const configError = error?.code === 'CONFIGURATION_ERROR';
  return result(configError ? 'Configuration required' : 'Translation failed', message, configError ? {
    JsonRPCAction: {
      method: 'open_settings',
      parameters: [],
      dontHideAfterAction: false,
    },
  } : {});
}

module.exports = {
  response,
  helpResults,
  confirmationResult,
  translationResult,
  setLanguagesResult,
  errorResult,
};
