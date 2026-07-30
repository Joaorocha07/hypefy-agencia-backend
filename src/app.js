const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');

const routes = require('./routes');
const swaggerSpec = require('./docs/swagger');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');

const app = express();

// Render fica atrás de um único proxy reverso que injeta X-Forwarded-For;
// sem isso o Express não confia no header e o express-rate-limit recusa
// operar (ERR_ERL_UNEXPECTED_X_FORWARDED_FOR). `1` = confia só no 1º hop.
app.set('trust proxy', 1);

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
