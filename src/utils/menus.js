// Fonte única das chaves de menu administrativo — usada para validar
// allowedMenus de um SOCIO e para marcar (attachMenu) a rota correspondente
// em cada arquivo de rotas. Precisa ficar em sincronia com ADMIN_NAV_ITEMS no
// frontend (lib/admin-nav.ts).
const ADMIN_MENUS = [
  'dashboard',
  'pedidos',
  'produtos',
  'estoque',
  'clientes',
  'engajamento',
  'categorias',
  'plataformas',
  'cupons',
  'funcionarios',
  'contas',
];

module.exports = { ADMIN_MENUS };
