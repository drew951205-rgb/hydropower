const dotenv = require('dotenv');

dotenv.config();

function resolveSkipLineSignature() {
  const raw = process.env.SKIP_LINE_SIGNATURE;

  if (raw === 'true') return true;
  if (raw === 'false') return false;

  return process.env.NODE_ENV !== 'production';
}

function resolveUseLiffLaunchUrl() {
  const raw = process.env.LIFF_USE_LAUNCH_URL;

  if (raw === 'true') return true;
  if (raw === 'false') return false;

  return process.env.NODE_ENV === 'production';
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  skipLineSignature: resolveSkipLineSignature(),
  lineChannelSecret: process.env.LINE_CHANNEL_SECRET || '',
  lineChannelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  adminApiKey: process.env.ADMIN_API_KEY || 'change-me',
  publicBaseUrl: process.env.PUBLIC_BASE_URL || '',
  liffId: process.env.LIFF_ID || '',
  useLiffLaunchUrl: resolveUseLiffLaunchUrl(),
  liffLaunchDefaultPath: process.env.LIFF_LAUNCH_DEFAULT_PATH || '/liff/repair',
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 120),
  dispatchTimeoutMinutes: Number(process.env.DISPATCH_TIMEOUT_MINUTES || 10),
  uploadMaxFileSize: Number(process.env.UPLOAD_MAX_FILE_SIZE || 5242880),
  uploadMaxFiles: Number(process.env.UPLOAD_MAX_FILES || 3),
  supabaseImageBucket: process.env.SUPABASE_IMAGE_BUCKET || 'images',
  lineAuthSecret: process.env.LINE_AUTH_SECRET || '',
  lineAuthTtlMs: Number(process.env.LINE_AUTH_TTL_MS || 2592000000),
};

if (env.nodeEnv === 'production') {
  if (env.skipLineSignature) {
    throw new Error(
      'FATAL: SKIP_LINE_SIGNATURE cannot be enabled in production. Set SKIP_LINE_SIGNATURE=false.'
    );
  }

  if (env.adminApiKey === 'change-me') {
    throw new Error(
      'FATAL: ADMIN_API_KEY must be changed in production environment. Update .env or Render environment variables.'
    );
  }

  if (!env.lineChannelSecret) {
    throw new Error(
      'FATAL: LINE_CHANNEL_SECRET is required when SKIP_LINE_SIGNATURE=false in production.'
    );
  }

  if (!env.lineChannelAccessToken) {
    throw new Error(
      'FATAL: LINE_CHANNEL_ACCESS_TOKEN is required when SKIP_LINE_SIGNATURE=false in production.'
    );
  }
}

module.exports = { env };
