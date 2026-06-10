const { Issuer, generators } = require('openid-client');

function getOidcConfig(db) {
  const rows = db.prepare("SELECT key, value FROM app_settings WHERE key LIKE 'oidc_%'").all();
  const dbCfg = {};
  for (const row of rows) dbCfg[row.key] = row.value;

  // Env vars take precedence over DB settings
  return {
    issuer:       process.env.OIDC_ISSUER || dbCfg.oidc_issuer || '',
    clientId:     process.env.OIDC_CLIENT_ID || dbCfg.oidc_client_id || '',
    clientSecret: process.env.OIDC_CLIENT_SECRET || dbCfg.oidc_client_secret || '',
    redirectUri:  process.env.OIDC_REDIRECT_URI || dbCfg.oidc_redirect_uri || '',
    providerName: process.env.OIDC_PROVIDER_NAME || dbCfg.oidc_provider_name || 'SSO',
  };
}

function isConfigured(db) {
  const cfg = getOidcConfig(db);
  return !!(cfg.issuer && cfg.clientId && cfg.clientSecret);
}

// Cache the discovered client; re-discover when config changes
let cached = null;

async function getClient(db, fallbackRedirectUri) {
  const cfg = getOidcConfig(db);
  if (!cfg.issuer || !cfg.clientId || !cfg.clientSecret) return null;
  const redirectUri = cfg.redirectUri || fallbackRedirectUri;
  const cacheKey = [cfg.issuer, cfg.clientId, cfg.clientSecret, redirectUri].join('|');
  if (cached && cached.key === cacheKey) return cached.client;

  const issuer = await Issuer.discover(cfg.issuer);
  const client = new issuer.Client({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uris: [redirectUri],
    response_types: ['code'],
  });
  cached = { key: cacheKey, client, redirectUri };
  return client;
}

function getCachedRedirectUri() {
  return cached ? cached.redirectUri : null;
}

module.exports = { getOidcConfig, isConfigured, getClient, getCachedRedirectUri, generators };
