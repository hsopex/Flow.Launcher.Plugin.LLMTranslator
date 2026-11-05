'use strict';

const ACTION_KEYWORD = 'tt';
const ICON_PATH = 'Images\\app.png';
const STATE_FILE_NAME = '.llm-translator-state.json';

const PROFILE_TYPES = Object.freeze({
  CHAT: 'chat',
  RESPONSES: 'responses',
  CLAUDE: 'claude',
});

const PROFILE_LABELS = Object.freeze({
  [PROFILE_TYPES.CHAT]: 'Chat Completions',
  [PROFILE_TYPES.RESPONSES]: 'Responses',
  [PROFILE_TYPES.CLAUDE]: 'Claude',
});

module.exports = {
  ACTION_KEYWORD,
  ICON_PATH,
  STATE_FILE_NAME,
  PROFILE_TYPES,
  PROFILE_LABELS,
};
