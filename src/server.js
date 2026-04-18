const { app } = require('./app');
const { env } = require('./config/env');
const { startBackgroundJobs } = require('./jobs/scheduler');

startBackgroundJobs();

app.listen(env.port, () => {
  console.log(`師傅抵嘉 API listening on port ${env.port}`);
});
