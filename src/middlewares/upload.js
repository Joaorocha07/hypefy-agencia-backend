const multer = require('multer');
const AppError = require('../utils/appError');

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return cb(new AppError('Formato de imagem não suportado', 422));
    }
    cb(null, true);
  },
});

module.exports = upload;
