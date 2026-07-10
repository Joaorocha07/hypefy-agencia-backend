require('dotenv').config({ quiet: true });

const app = require('./app');
const { startSyncEngagementOrdersJob } = require('./jobs/syncEngagementOrders');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Hypefy Agência API rodando na porta ${PORT}`);
  console.log(`Documentação Swagger: http://localhost:${PORT}/docs`);

  startSyncEngagementOrdersJob();
});
