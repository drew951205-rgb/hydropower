const dotenv = require('dotenv');

dotenv.config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  skipLineSignature: process.env.SKIP_LINE_SIGNATURE !== 'false',
  lineChannelSecret: process.env.LINE_CHANNEL_SECRET || '',
  lineChannelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  adminApiKey: process.env.ADMIN_API_KEY || 'change-me',
  publicBaseUrl: process.env.PUBLIC_BASE_URL || '',
  liffId: process.env.LIFF_ID || '',
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 120),
  dispatchTimeoutMinutes: Number(process.env.DISPATCH_TIMEOUT_MINUTES || 10),
  uploadMaxFileSize: Number(process.env.UPLOAD_MAX_FILE_SIZE || 5242880),
  uploadMaxFiles: Number(process.env.UPLOAD_MAX_FILES || 3),
};

module.exports = { env };
