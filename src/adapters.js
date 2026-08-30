'use strict';

const { PROFILE_TYPES } = require('./constants');
const { ConfigurationError, ResponseFormatError } = require('./errors');
const { postJson } = require('./http');
const { buildEndpoint } = require('./settings');
const { buildSystemPrompt, buildUserPrompt } = require('./prompt');

function getTextFromContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((part) => part && typeof part.text === 'string')
    .map((part) => part.text)
    .join('');
}

function parseChatResponse(payload) {
  const text = getTextFromContent(payload?.choices?.[0]?.message?.content);
  if (!text.trim()) {
    throw new ResponseFormatError('Chat Completions returned no translated text.');
  }
  return text.trim();
}

function parseResponsesResponse(payload) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const text = Array.isArray(payload?.output)
    ? payload.output
      .flatMap((item) => Array.isArray(item?.content) ? item.content : [])
      .filter((part) => part?.type === 'output_text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('')
    : '';

  if (!text.trim()) {
    throw new ResponseFormatError('Responses API returned no translated text.');
  }
  return text.trim();
}

function parseClaudeResponse(payload) {
  const text = Array.isArray(payload?.content)
    ? payload.content
      .filter((part) => part?.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('')
    : '';

  if (!text.trim()) {
    throw new ResponseFormatError('Claude Messages returned no translated text.');
  }
  return text.trim();
}

async function translateWithChat(profile, request, dependencies) {
  const systemPrompt = buildSystemPrompt(request);
  const payload = await postJson(buildEndpoint(profile), {
    headers: { authorization: `Bearer ${profile.apiKey}` },
    body: {
      model: profile.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: buildUserPrompt(request.text) },
      ],
    },
    timeoutMs: request.timeoutMs,
    fetchImpl: dependencies.fetchImpl,
  });
  return parseChatResponse(payload);
}

async function translateWithResponses(profile, request, dependencies) {
  const payload = await postJson(buildEndpoint(profile), {
    headers: { authorization: `Bearer ${profile.apiKey}` },
    body: {
      model: profile.model,
      instructions: buildSystemPrompt(request),
      input: buildUserPrompt(request.text),
      max_output_tokens: request.maxOutputTokens,
      store: false,
    },
    timeoutMs: request.timeoutMs,
    fetchImpl: dependencies.fetchImpl,
  });
  return parseResponsesResponse(payload);
}

async function translateWithClaude(profile, request, dependencies) {
  const payload = await postJson(buildEndpoint(profile), {
    headers: {
      'x-api-key': profile.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: {
      model: profile.model,
      max_tokens: request.maxOutputTokens,
      system: buildSystemPrompt(request),
      messages: [
        { role: 'user', content: buildUserPrompt(request.text) },
      ],
    },
    timeoutMs: request.timeoutMs,
    fetchImpl: dependencies.fetchImpl,
  });
  return parseClaudeResponse(payload);
}

async function translate(profile, request, dependencies = {}) {
  if (profile.type === PROFILE_TYPES.CHAT) {
    return translateWithChat(profile, request, dependencies);
  }
  if (profile.type === PROFILE_TYPES.RESPONSES) {
    return translateWithResponses(profile, request, dependencies);
  }
  if (profile.type === PROFILE_TYPES.CLAUDE) {
    return translateWithClaude(profile, request, dependencies);
  }
  throw new ConfigurationError(`Unsupported API profile type: ${profile.type}`);
}

module.exports = {
  translate,
  parseChatResponse,
  parseResponsesResponse,
  parseClaudeResponse,
};
