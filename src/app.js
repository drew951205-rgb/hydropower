const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const webhookRoutes = require('./routes/webhook.routes');
const orderRoutes = require('./routes/order.routes');
const technicianRoutes = require('./routes/technician.routes');
const adminRoutes = require('./routes/admin.routes');
const liffRoutes = require('./routes/liff.routes');
const { rateLimit } = require('./middlewares/rate-limit');
const { requestLogger } = require('./middlewares/request-logger');
const { notFound, errorHandler } = require('./middlewares/error-handler');

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'img-src': ["'self'", 'data:', 'https:'],
      'script-src': ["'self'", 'https://static.line-scdn.net'],
      'style-src': ["'self'"],
      'connect-src': ["'self'", 'https://api.line.me']
    }
  }
}));
app.use(cors());
app.use(rateLimit);
app.use(express.json({
  verify: (req, res, buffer) => {
    req.rawBody = buffer.toString('utf8');
  }
}));
app.use(requestLogger);

app.get('/health', (req, res) => {
  res.json({ ok: true, service: '師傅抵嘉 API' });
});

app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'liff', 'repair.html'));
});
app.get('/admin', (req, res) => {
  res.redirect('/admin/');
});
app.get('/liff', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'liff', 'repair.html'));
});
[
  'repair',
  'quote',
  'change-request',
  'confirm',
  'my-cases',
  'review',
].forEach((page) => {
  app.get(`/liff/${page}`, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'liff', `${page}.html`));
  });
  app.get(`/${page}`, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'liff', `${page}.html`));
  });
});

app.use('/webhook', webhookRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/technicians', technicianRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/liff', liffRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = { app };
