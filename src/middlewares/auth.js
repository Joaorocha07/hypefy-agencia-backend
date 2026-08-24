const { verifyAccessToken } = require('../utils/jwt');
const AppError = require('../utils/appError');
const prisma = require('../config/db');

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new AppError('Token de acesso ausente', 401);
    }

    const token = header.split(' ')[1];
    const payload = verifyAccessToken(token);

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new AppError('Usuário inválido ou inativo', 401);
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      allowedMenus: user.allowedMenus,
      financialVisibleFrom: user.financialVisibleFrom,
    };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Attaches req.user when a valid Bearer token is present, but never rejects
 * the request — used by public endpoints that adapt their response for a
 * logged-in caller (e.g. review eligibility) without requiring login.
 */
async function optionalAuthenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return next();

    const token = header.split(' ')[1];
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (user && user.isActive) {
      req.user = { id: user.id, email: user.email, role: user.role };
    }
    next();
  } catch {
    next();
  }
}

/**
 * Marca qual menu administrativo (ver src/utils/menus.js) a rota abaixo pertence
 * a — não bloqueia nada sozinho, só grava req.menuKey para o authorize() usar
 * no bypass de SOCIO logo abaixo.
 */
function attachMenu(menuKey) {
  return (req, res, next) => {
    req.menuKey = menuKey;
    next();
  };
}

function authorize(...allowedRoles) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role) {
      return next(new AppError('Acesso negado: privilégio insuficiente', 403));
    }

    if (allowedRoles.includes(role)) return next();

    // SOCIO herda qualquer verificação que exigiria ADM, mas só para o menu
    // que o admin master liberou para essa conta (req.menuKey, setado por
    // attachMenu no topo do arquivo de rotas) — dá acesso "completo" de ADM
    // dentro do menu liberado, sem duplicar regra de negócio por rota.
    if (
      role === 'SOCIO' &&
      allowedRoles.includes('ADM') &&
      req.menuKey &&
      req.user.allowedMenus?.includes(req.menuKey)
    ) {
      return next();
    }

    return next(new AppError('Acesso negado: privilégio insuficiente', 403));
  };
}

module.exports = { authenticate, optionalAuthenticate, authorize, attachMenu };
