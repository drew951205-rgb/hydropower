const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const webhookRoutes = require('./routes/webhook.routes');
const orderRoutes = require('./routes/order.routes');
const technicianRoutes = require('./routes/technician.routes');
const adminRoutes = require('./routes/admin.routes');
const { rateLimit } = require('./middlewares/rate-limit');
const { requestLogger } = require('./middlewares/request-logger');
const { notFound, errorHandler } = require('./middlewares/error-handler');

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'img-src': ["'self'", 'data:'],
        'script-src': ["'self'"],
        'style-src': ["'self'"],
      },
    },
  })
);
app.use(cors());
app.use(rateLimit);
app.use(
  express.json({
    verify: (req, res, buffer) => {
      req.rawBody = buffer.toString('utf8');
    },
  })
);
app.use(requestLogger);

app.get('/health', (req, res) => {
  res.json({ ok: true, service: '師傅抵嘉 API' });
});

app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/admin', (req, res) => {
  res.redirect('/admin/');
});

app.use('/webhook', webhookRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/technicians', technicianRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFound);
app.use(errorHandler);

// 啟動背景任務
const cron = require('node-cron');
const { runDispatchTimeoutJob } = require('./jobs/dispatch-timeout.job');
const { runUnpaidFollowupJob } = require('./jobs/unpaid-followup.job');
const { runStaleOrderJob } = require('./jobs/stale-order.job');

// 每5分鐘執行一次派單超時檢查
cron.schedule('*/5 * * * *', runDispatchTimeoutJob);

// 每小時執行一次逾期訂單檢查
cron.schedule('0 * * * *', runStaleOrderJob);

// MVP不收款，逾期催收任務保持placeholder
cron.schedule('0 9 * * *', runUnpaidFollowupJob); // 每天早上9點

console.log('[app] Background jobs scheduled');

module.exports = { app };
