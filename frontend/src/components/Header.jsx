import './Header.css'

const NAV_ITEMS = [
  { id: 'overview', label: 'Painel' },
  { id: 'schedule', label: 'Agendar' },
  { id: 'history', label: 'Histórico' },
  { id: 'machines', label: 'Máquinas', adminOnly: true },
]

export function BrandMark({ inverse = false }) {
  return (
    <svg
      className="brand-mark"
      width="28"
      height="28"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        rx="7"
        fill={inverse ? 'rgba(255, 255, 255, 0.16)' : '#1463F3'}
        stroke={inverse ? 'rgba(255, 255, 255, 0.45)' : 'none'}
        strokeWidth="1.5"
      />
      <circle cx="9.5" cy="7.5" r="1.3" fill="#FFFFFF" />
      <circle cx="14" cy="7.5" r="1.3" fill="#FFFFFF" />
      <circle cx="16" cy="18" r="7.5" stroke="#FFFFFF" strokeWidth="2.2" />
      <path
        d="M10.5 18.2C12.3 16.4 14.1 16.4 16 18.2C17.9 20 19.7 20 21.5 18.2"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function Header({ user, activePage, onNavigate, onLogout }) {
  const isAdmin = user?.role === 'admin'
  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <button
          type="button"
          className="site-header__brand"
          onClick={() => onNavigate('overview')}
        >
          <BrandMark />
          <span className="site-header__name">Lave aí</span>
        </button>

        <nav className="site-header__nav" aria-label="Navegação principal">
          {visibleItems.map((item) => {
            const isActive = activePage === item.id
            return (
              <button
                key={item.id}
                type="button"
                className={`site-header__tab${isActive ? ' site-header__tab--active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onNavigate(item.id)}
              >
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="site-header__account">
          <div className="site-header__user">
            <span className="site-header__user-name">{user?.name || 'Usuário'}</span>
            {isAdmin && <span className="site-header__role">Admin</span>}
          </div>
          <button
            type="button"
            className="site-header__logout"
            onClick={onLogout}
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  )
}
