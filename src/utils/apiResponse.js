function success(res, data = null, message = 'OK', statusCode = 200) {
  return res.status(statusCode).json({ success: true, message, data });
}

function error(res, message = 'Erro interno', statusCode = 500, details = null) {
  return res.status(statusCode).json({ success: false, message, details });
}

module.exports = { success, error };
