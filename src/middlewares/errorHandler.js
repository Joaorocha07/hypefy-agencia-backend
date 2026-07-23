const AppError = require('../utils/appError');

function notFoundHandler(req, res, next) {
  next(new AppError(`Rota não encontrada: ${req.method} ${req.originalUrl}`, 404));
}

function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Erro interno do servidor';
  let details = err.details || null;

  // err.meta do Prisma (nomes de coluna/constraint) só é útil para depuração —
  // em produção não deve trafegar para o cliente, é detalhe interno do schema.
  const exposeInternalDetails = process.env.NODE_ENV !== 'production';

  if (err.code === 'P2002') {
    statusCode = 409;
    message = 'Registro duplicado (violação de unicidade)';
    details = exposeInternalDetails ? err.meta : null;
  } else if (err.code === 'P2025') {
    statusCode = 404;
    message = 'Registro não encontrado';
  } else if (err.code === 'P2003') {
    statusCode = 409;
    message = 'Não é possível excluir: existem registros vinculados a este item';
    details = exposeInternalDetails ? err.meta : null;
  } else if (err.name === 'ZodError') {
    statusCode = 422;
    message = 'Dados inválidos';
    details = err.issues;
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token inválido ou expirado';
  }

  // Erros não-operacionais (exceções inesperadas — bugs, driver do banco,
  // libs de terceiros) nunca devem vazar err.message/err.details ao cliente:
  // isso pode conter caminhos de arquivo, nomes de tabela/coluna, ou outros
  // detalhes internos. Só o log do servidor recebe o erro completo.
  if (!err.isOperational && statusCode === 500) {
    console.error(err);
    message = 'Erro interno do servidor';
    details = null;
  }

  res.status(statusCode).json({
    success: false,
    message,
    details,
  });
}

module.exports = { notFoundHandler, errorHandler };
