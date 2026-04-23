const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const { env } = require('./config/env');
const { roleRouter } = require('./middlewares/role-router');
const webhookRoutes = require('./routes/webhook.routes');
const orderRoutes = require('./routes/order.routes');
const technicianRoutes = require('./routes/technician.routes');
const adminRoutes = require('./routes/admin.routes');
const liffRoutes = require('./routes/liff.routes');
const { rateLimit } = require('./middlewares/rate-limit');
const { requestLogger } = require('./middlewares/request-logger');
const { notFound, errorHandler } = require('./middlewares/error-handler');

const app = express();

// CORS configuration - allow specific origins only
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Allow localhost for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }

    // Allow Render and production domains
    if (origin.includes('onrender.com') || origin.includes('liff.line.me')) {
      return callback(null, true);
    }

    // For production, check PUBLIC_BASE_URL
    if (env.publicBaseUrl && origin === env.publicBaseUrl) {
      return callback(null, true);
    }

    // Deny all other origins in production
    if (env.nodeEnv === 'production') {
      console.warn(`CORS denied for origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    }

    // Allow in development
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-admin-api-key', 'x-line-signature', 'authorization'],
};

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'connect-src': [
        "'self'",
        'https://api.line.me',
        'https://access.line.me',
        'https://liff.line.me',
        'https://*.line.me',
      ],
      'frame-ancestors': [
        "'self'",
        'https://line.me',
        'https://*.line.me',
        'https://liff.line.me',
      ],
      'frame-src': [
        "'self'",
        'https://access.line.me',
        'https://liff.line.me',
        'https://*.line.me',
      ],
      'img-src': ["'self'", 'data:', 'https:'],
      'script-src': ["'self'", 'https://static.line-scdn.net'],
      'style-src': ["'self'"],
    }
  }
}));
app.use(cors(corsOptions));
app.use(rateLimit);
app.use(express.json({
  verify: (req, res, buffer) => {
    req.rawBody = buffer.toString('utf8');
  }
}));
app.use(requestLogger);
app.use(roleRouter);

app.get('/health', (req, res) => {
  res.json({ ok: true, service: '師傅抵嘉 API' });
});

app.use(express.static(path.join(__dirname, '..', 'public')));

// 首頁路由 - 根據身份動態返回
app.get('/', (req, res) => {
  const defaultPage = req.userRole === 'technician' ? 'my-cases.html' : 'repair.html';
  res.sendFile(path.join(__dirname, '..', 'public', 'liff', defaultPage));
});

app.get('/admin', (req, res) => {
  res.redirect('/admin/');
});

app.get('/liff', (req, res) => {
  const defaultPage = req.userRole === 'technician' ? 'my-cases.html' : 'repair.html';
  res.sendFile(path.join(__dirname, '..', 'public', 'liff', defaultPage));
});

// LIFF 頁面 - 對師傅隱藏某些頁面
const customerPages = ['repair', 'profile', 'review', 'support'];
const technicianPages = ['my-cases', 'quote', 'confirm', 'support', 'faq', 'cancel', 'navigate', 'change-request'];
const commonPages = ['quote', 'change-request', 'confirm', 'faq', 'cancel', 'navigate', 'support'];

[
  'repair',
  'quote',
  'change-request',
  'confirm',
  'my-cases',
  'profile',
  'review',
  'support',
  'faq',
  'cancel',
  'navigate',
].forEach((page) => {
  app.get(`/liff/${page}`, (req, res) => {
    // 檢查頁面是否對此用戶開放
    if (req.userRole === 'technician' && customerPages.includes(page)) {
      return res.status(403).json({ error: 'Forbidden: This page is for customers only' });
    }

    res.sendFile(path.join(__dirname, '..', 'public', 'liff', `${page}.html`));
  });

  app.get(`/${page}`, (req, res) => {
    // 檢查頁面是否對此用戶開放
    if (req.userRole === 'technician' && customerPages.includes(page)) {
      return res.status(403).json({ error: 'Forbidden: This page is for customers only' });
    }

    res.sendFile(path.join(__dirname, '..', 'public', 'liff', `${page}.html`));
  });
});

app.use('/webhook', webhookRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/technicians', technicianRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/liff', liffRoutes);

app.get('*', (req, res, next) => {
  const isApiRoute =
    req.path.startsWith('/api') ||
    req.path.startsWith('/webhook') ||
    req.path.startsWith('/health');
  const acceptsHtml = req.accepts('html');

  if (isApiRoute || !acceptsHtml) {
    return next();
  }

  // Fallback：根據用戶身份返回正確的首頁
  const defaultPage = req.userRole === 'technician' ? 'my-cases.html' : 'repair.html';
  return res.sendFile(path.join(__dirname, '..', 'public', 'liff', defaultPage));
});

app.use(notFound);
app.use(errorHandler);

module.exports = { app };
