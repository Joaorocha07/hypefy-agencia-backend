const AppError = require('../utils/appError');

function notFoundHandler(req, res, next) {
  next(new AppError(`Rota não encontrada: ${req.method} ${req.originalUrl}`, 404));
}

function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Erro interno do servidor';
  let details = err.details || null;

  if (err.code === 'P2002') {
    statusCode = 409;
    message = 'Registro duplicado (violação de unicidade)';
    details = err.meta;
  } else if (err.code === 'P2025') {
    statusCode = 404;
    message = 'Registro não encontrado';
  } else if (err.code === 'P2003') {
    statusCode = 409;
    message = 'Não é possível excluir: existem registros vinculados a este item';
    details = err.meta;
  } else if (err.name === 'ZodError') {
    statusCode = 422;
    message = 'Dados inválidos';
    details = err.issues;
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token inválido ou expirado';
  }

  if (!err.isOperational && statusCode === 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    details,
  });
}

module.exports = { notFoundHandler, errorHandler };
