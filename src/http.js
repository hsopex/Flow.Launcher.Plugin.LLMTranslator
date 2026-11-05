'use strict';

const http = require('node:http');
const https = require('node:https');
const { ApiError, ResponseFormatError } = require('./errors');

const MAX_REDIRECTS = 5;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function extractApiMessage(payload, fallback) {
  if (payload && typeof payload === 'object') {
    if (typeof payload.error === 'string') return payload.error;
    if (payload.error && typeof payload.error.message === 'string') return payload.error.message;
    if (typeof payload.message === 'string') return payload.message;
  }
  return fallback;
}

function timeoutError(timeoutMs) {
  return new ApiError(`The API request timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
}

function parseUrl(urlString) {
  let target;
  try {
    target = new URL(urlString);
  } catch {
    throw new ApiError(`Invalid API URL: ${urlString}`);
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    throw new ApiError('The API URL must use http or https.');
  }
  return target;
}

function rawRequest(urlString, { method = 'POST', headers = {}, body = '', timeoutMs }) {
  return new Promise((resolve, reject) => {
    const target = parseUrl(urlString);
    const transport = target.protocol === 'https:' ? https : http;
    const bodyBuffer = Buffer.from(body, 'utf8');
    const requestHeaders = { ...headers };

    if (method !== 'GET' && method !== 'HEAD') {
      requestHeaders['content-length'] = String(bodyBuffer.length);
    } else {
      delete requestHeaders['content-length'];
    }

    let settled = false;
    let timedOut = false;
    let timer = null;

    function finish(callback, value) {
      if (settled) return;
      settled = true;
      if (timer !== null) clearTimeout(timer);
      callback(value);
    }

    const request = transport.request(target, { method, headers: requestHeaders }, (response) => {
      const chunks = [];
      let received = 0;
      let tooLarge = false;

      response.on('data', (chunk) => {
        received += chunk.length;
        if (received > MAX_RESPONSE_BYTES) {
          tooLarge = true;
          response.destroy();
          return;
        }
        chunks.push(chunk);
      });

      function complete() {
        if (timedOut) {
          finish(reject, timeoutError(timeoutMs));
          return;
        }
        if (tooLarge) {
          finish(reject, new ApiError('The API response was too large.'));
          return;
        }
        const status = response.statusCode || 0;
        finish(resolve, {
          status,
          statusText: response.statusMessage || '',
          ok: status >= 200 && status < 300,
          headers: response.headers,
          text: Buffer.concat(chunks).toString('utf8'),
        });
      }

      response.on('end', complete);
      response.on('close', complete);
      response.on('error', (error) => {
        finish(reject, timedOut
          ? timeoutError(timeoutMs)
          : new ApiError(`API request failed: ${error.message || String(error)}`));
      });
    });

    timer = setTimeout(() => {
      timedOut = true;
      request.destroy();
    }, timeoutMs);

    request.on('error', (error) => {
      finish(reject, timedOut
        ? timeoutError(timeoutMs)
        : new ApiError(`API request failed: ${error.message || String(error)}`));
    });

    request.end(bodyBuffer);
  });
}

async function requestWithRedirects(urlString, options) {
  let currentUrl = urlString;
  let method = options.method || 'POST';
  let headers = { ...options.headers };
  let body = options.body || '';

  for (let redirects = 0; ; redirects += 1) {
    const response = await rawRequest(currentUrl, {
      ...options,
      method,
      headers,
      body,
    });
    if (!REDIRECT_STATUSES.has(response.status)) return response;

    const location = response.headers.location;
    if (!location) return response;
    if (redirects >= MAX_REDIRECTS) {
      throw new ApiError('The API redirected too many times.');
    }

    if (response.status === 303 || ((response.status === 301 || response.status === 302) && method === 'POST')) {
      method = 'GET';
      body = '';
      headers = { ...headers };
      delete headers['content-type'];
      delete headers['content-length'];
    }

    try {
      currentUrl = new URL(location, currentUrl).toString();
    } catch {
      throw new ApiError('The API returned an invalid redirect location.');
    }
  }
}

async function fetchRequest(fetchImpl, url, { headers, body, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });
    return {
      status: response.status,
      statusText: response.statusText || '',
      ok: response.ok,
      text: await response.text(),
    };
  } catch (error) {
    if (error && error.name === 'AbortError') throw timeoutError(timeoutMs);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function postJson(url, { headers, body, timeoutMs, fetchImpl }) {
  const requestHeaders = {
    'content-type': 'application/json',
    ...headers,
  };
  const requestBody = JSON.stringify(body);

  let response;
  try {
    response = typeof fetchImpl === 'function'
      ? await fetchRequest(fetchImpl, url, { headers: requestHeaders, body: requestBody, timeoutMs })
      : await requestWithRedirects(url, { headers: requestHeaders, body: requestBody, timeoutMs });
  } catch (error) {
    if (error instanceof ApiError || error instanceof ResponseFormatError) throw error;
    throw new ApiError(`API request failed: ${error.message || String(error)}`);
  }

  const raw = response.text;
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
}

module.exports = {
  postJson,
};
