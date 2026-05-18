const { env } = require('../config/env');
const { buildSignedLineAuth } = require('../services/liff-auth.service');

function publicBaseUrl() {
  const explicit = String(env.publicBaseUrl || '').trim();
  return (explicit || `http://localhost:${env.port || 3000}`).replace(
    /\/+$/,
    ''
  );
}

function toQuery(params = {}) {
  return Object.entries(params)
    .filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    )
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`
    )
    .join('&');
}

function liffPageUrl(path, params = {}) {
  const base = publicBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const liffPath = normalizedPath.startsWith('/liff/')
    ? normalizedPath.replace(/^\/liff/, '')
    : normalizedPath;
  const query = toQuery(params);

  if (env.liffId && env.useLiffLaunchUrl) {
    return `https://liff.line.me/${env.liffId}${liffPath}${query ? `?${query}` : ''}`;
  }

  return `${base}${normalizedPath}${query ? `?${query}` : ''}`;
}

function webPageUrl(path, params = {}) {
  const base = publicBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const query = toQuery(params);
  return `${base}${normalizedPath}${query ? `?${query}` : ''}`;
}

function signedLiffParams(lineUserId, params = {}) {
  if (!lineUserId) return params;
  return {
    ...params,
    line_user_id: lineUserId,
    ...buildSignedLineAuth(lineUserId),
  };
}

function uriAction(label, path, params = {}) {
  return {
    type: 'uri',
    label,
    uri: liffPageUrl(path, params),
  };
}

function webUriAction(label, path, params = {}) {
  return {
    type: 'uri',
    label,
    uri: webPageUrl(path, params),
  };
}

function signedWebPageUrl(path, lineUserId, params = {}) {
  return webPageUrl(path, signedLiffParams(lineUserId, params));
}

function signedWebUriAction(label, path, lineUserId, params = {}) {
  return {
    type: 'uri',
    label,
    uri: signedWebPageUrl(path, lineUserId, params),
  };
}

module.exports = {
  liffPageUrl,
  webPageUrl,
  uriAction,
  webUriAction,
  signedLiffParams,
  signedWebPageUrl,
  signedWebUriAction,
};
