function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    });

    if (!result.success) {
      const err = new Error('Dados inválidos');
      err.name = 'ZodError';
      err.statusCode = 422;
      err.issues = result.error.issues;
      err.details = result.error.issues;
      return next(err);
    }

    if (result.data.body) req.body = result.data.body;
    if (result.data.query) {
      // Express 5 made `req.query` a getter-only accessor, so a plain
      // reassignment silently no-ops and callers keep reading the raw,
      // unvalidated/uncoerced query string values. Override the property
      // directly so coerced types (numbers, booleans) actually stick.
      Object.defineProperty(req, 'query', {
        value: result.data.query,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
    next();
  };
}

module.exports = validate;
