const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');

const routes = require('./routes');
const swaggerSpec = require('./docs/swagger');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');

const app = express();

const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // Sem header Origin (chamadas server-to-server, curl, webhooks) — permite.
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error('Origem não permitida por CORS'));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

app.get('/health', (req, res) => res.json({ success: true, message: 'OK' }));

// Swagger só é exposto fora de produção — em produção ele revela toda a
// superfície da API (rotas, regras de negócio) sem exigir autenticação.
if (process.env.NODE_ENV !== 'production') {
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

app.use('/api/v1', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
