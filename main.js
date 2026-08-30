'use strict';

const { ACTION_KEYWORD, ICON_PATH } = require('./src/constants');
const { handleQuery } = require('./src/application');
const { writeState, clearState } = require('./src/state');
const { copyToClipboard } = require('./src/clipboard');
const { response, errorResult } = require('./src/results');

function output(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function flowCall(method, parameters = []) {
  return { method, parameters };
}

function queryText(parameters) {
  if (!Array.isArray(parameters)) return String(parameters ?? '');
  return parameters.map((value) => String(value ?? '')).join(' ');
}

async function run(rawRequest = process.argv[2]) {
  let request;
  try {
    request = JSON.parse(rawRequest || '{}');
  } catch (error) {
    output(response([errorResult(new Error(`Invalid Flow Launcher request: ${error.message}`))]));
    return;
  }

  const method = request.method;
  const parameters = Array.isArray(request.parameters) ? request.parameters : [];

  try {
    switch (method) {
      case 'query':
        output(await handleQuery({
          input: queryText(parameters),
          settings: request.settings || {},
        }));
        break;

      case 'run_translation': {
        const executionSpec = String(parameters[0] ?? '').trim();
        output(flowCall('Flow.Launcher.ChangeQuery', [`${ACTION_KEYWORD} :run ${executionSpec}`, true]));
        break;
      }

      case 'set_languages':
        writeState(String(parameters[0] ?? ''), String(parameters[1] ?? ''));
        output(flowCall('Flow.Launcher.ShowMsg', [
          'LLM Translator',
          `Default direction set to ${parameters[0]} → ${parameters[1]}`,
          ICON_PATH,
        ]));
        break;

      case 'reset_languages':
        clearState();
        output(flowCall('Flow.Launcher.ShowMsg', [
          'LLM Translator',
          'Language direction restored from the plugin settings.',
          ICON_PATH,
        ]));
        break;

      case 'copy_translation':
        await copyToClipboard(String(parameters[0] ?? ''));
        break;

      case 'open_settings':
        output(flowCall('Flow.Launcher.OpenSettingDialog', []));
        break;

      default:
        output(response([errorResult(new Error(`Unsupported method: ${method || '(empty)'}`))]));
        break;
    }
  } catch (error) {
    if (method === 'query') {
      output(response([errorResult(error)]));
    } else {
      output(flowCall('Flow.Launcher.ShowMsg', [
        'LLM Translator',
        (error.message || String(error)).slice(0, 500),
        ICON_PATH,
      ]));
    }
  }
}

if (require.main === module) {
  run();
}

module.exports = {
  run,
  queryText,
  flowCall,
};
