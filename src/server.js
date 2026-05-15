const { app } = require('./app');
const { env } = require('./config/env');
const { startBackgroundJobs } = require('./jobs/scheduler');
const { logger } = require('./config/logger');

startBackgroundJobs();

app.listen(env.port, () => {
  logger.info('???? API listening', { port: env.port });
});
