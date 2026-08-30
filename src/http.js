'use strict';

const { ApiError, ResponseFormatError } = require('./errors');

function extractApiMessage(payload, fallback) {
  if (payload && typeof payload === 'object') {
    if (typeof payload.error === 'string') return payload.error;
    if (payload.error && typeof payload.error.message === 'string') return payload.error.message;
    if (typeof payload.message === 'string') return payload.message;
  }
  return fallback;
}

async function postJson(url, { headers, body, timeoutMs, fetchImpl = globalThis.fetch }) {
  if (typeof fetchImpl !== 'function') {
    throw new ApiError('This plugin requires Node.js 18 or newer because fetch is unavailable.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const raw = await response.text();
    let payload = null;
    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch {
        if (response.ok) throw new ResponseFormatError('The API returned invalid JSON.');
      }
    }

    if (!response.ok) {
      const fallback = raw ? raw.slice(0, 300) : response.statusText || 'Request failed';
      throw new ApiError(`API ${response.status}: ${extractApiMessage(payload, fallback)}`, response.status);
    }
    if (!payload || typeof payload !== 'object') {
      throw new ResponseFormatError('The API returned an empty response.');
    }
    return payload;
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new ApiError(`The API request timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
    }
    if (error instanceof ApiError || error instanceof ResponseFormatError) throw error;
    throw new ApiError(`API request failed: ${error.message || String(error)}`);
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  postJson,
};
