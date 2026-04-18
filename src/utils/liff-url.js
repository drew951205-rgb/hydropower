const { env } = require('../config/env');

function publicBaseUrl() {
  const explicit = String(env.publicBaseUrl || '').trim();
  return (explicit || `http://localhost:${env.port || 3000}`).replace(/\/+$/, '');
}

function liffPageUrl(path, params = {}) {
  const base = publicBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`
    )
    .join('&');

  return `${base}${normalizedPath}${query ? `?${query}` : ''}`;
}

function uriAction(label, path, params = {}) {
  return {
    type: 'uri',
    label,
    uri: liffPageUrl(path, params),
  };
}

module.exports = { liffPageUrl, uriAction };
