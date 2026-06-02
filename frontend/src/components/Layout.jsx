import React, { useState, useEffect } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, Package, ShoppingCart, ArrowLeftRight, 
  FileText, Settings, LogOut, Menu, X,
  ChevronLeft, ChevronRight, BarChart2, Search,
  Wallet, ShoppingBag, Sun, Moon, Users
} from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'

/* ── Brand tokens ─────────────────────────────────────────
   dark  → black sidebar (#111), black body (#0a0a0a)
   light → white sidebar (#fff),  white body (#fff)
   red   → #e11d48 (always, both modes)
─────────────────────────────────────────────────────────── */
const T = {
  dark: {
    sidebar:     '#111111',
    sidebarBorder:'#222222',
    body:        '#0a0a0a',
    header:      '#111111',
    headerBorder:'#222222',
    text:        '#fafafa',
    muted:       '#737373',
    navText:     '#a3a3a3',
    navHoverBg:  '#1f1f1f',
    navHoverTxt: '#ffffff',
    userCard:    '#1a1a1a',
    searchBg:    '#1a1a1a',
    searchBorder:'#2a2a2a',
    langBg:      '#1a1a1a',
    divider:     '#2a2a2a',
    logoutHoverBg:'#2a0a0a',
    logoutHoverTxt:'#f87171',
    inputBg:     '#1a1a1a',
  },
  light: {
    sidebar:     '#ffffff',
    sidebarBorder:'#e5e5e5',
    body:        '#f5f5f5',
    header:      '#ffffff',
    headerBorder:'#e5e5e5',
    text:        '#0a0a0a',
    muted:       '#737373',
    navText:     '#525252',
    navHoverBg:  '#fff1f2',
    navHoverTxt: '#e11d48',
    userCard:    '#f5f5f5',
    searchBg:    '#f5f5f5',
    searchBorder:'#e5e5e5',
    langBg:      '#f5f5f5',
    divider:     '#e5e5e5',
    logoutHoverBg:'#fff1f2',
    logoutHoverTxt:'#e11d48',
    inputBg:     '#f5f5f5',
  }
}

const Layout = ({ user, onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light')
  const location = useLocation()
  const { t, lang, changeLanguage } = useLanguage()

  const c = T[theme] // current theme colors

  const navigation = [
    { name: t('dashboard'),  href: '/',          icon: LayoutDashboard, roles: ['admin','manager','cashier','storekeeper','accountant'] },
    { name: t('inventory'),  href: '/inventory',  icon: Package,         roles: ['admin','manager','storekeeper'] },
    { name: t('sales'),      href: '/sales',      icon: ShoppingCart,    roles: ['admin','manager','cashier','accountant'] },
    { name: t('orders'),     href: '/orders',     icon: Wallet,          roles: ['admin','manager','cashier'] },
    { name: t('transfers'),  href: '/transfers',  icon: ArrowLeftRight,  roles: ['admin','manager','storekeeper'] },
    { name: t('purchases'),  href: '/purchases',  icon: ShoppingBag,     roles: ['admin','manager','storekeeper'] },
    { name: t('expenses'),   href: '/expenses',   icon: FileText,        roles: ['admin','manager','accountant','storekeeper'] },
    { name: t('reports'),    href: '/reports',    icon: BarChart2,       roles: ['admin','manager','accountant'] },
    { name: t('customers'),  href: '/customers',  icon: Users,           roles: ['admin','manager','cashier'] },
    { name: t('settings'),   href: '/settings',   icon: Settings,        roles: ['admin','manager'] },
  ]

  const filteredNav = navigation.filter(item =>
    !item.roles || item.roles.includes(user?.role?.toLowerCase())
  )
  const isActive = (path) => location.pathname === path

  useEffect(() => { setIsMobileMenuOpen(false) }, [location])

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  const activeNavStyle   = { background: '#e11d48', color: '#ffffff' }
  const inactiveNavStyle = { color: c.navText }

  const NavLink = ({ item }) => (
    <Link
      to={item.href}
      title={!isSidebarOpen ? item.name : undefined}
      className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors"
      style={isActive(item.href) ? activeNavStyle : inactiveNavStyle}
      onMouseEnter={e => { if (!isActive(item.href)) { e.currentTarget.style.background = c.navHoverBg; e.currentTarget.style.color = c.navHoverTxt } }}
      onMouseLeave={e => { if (!isActive(item.href)) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = c.navText } }}
    >
      <item.icon size={18} className="flex-shrink-0" />
      {isSidebarOpen && <span className="truncate">{item.name}</span>}
    </Link>
  )

  const SidebarContent = ({ mobile = false }) => (
    <>
      {/* Logo */}
      <div className="h-16 flex items-center px-4 gap-3 flex-shrink-0" style={{ borderBottom: `1px solid ${c.sidebarBorder}` }}>
        <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0" style={{ background: '#e11d48' }}>
          <Package className="text-white" size={16} />
        </div>
        {(mobile || isSidebarOpen) && (
          <div>
            <span className="font-bold text-sm tracking-widest" style={{ color: c.text }}>LEGASONA</span>
            <div className="w-8 h-0.5 mt-0.5 rounded-full" style={{ background: '#e11d48' }} />
          </div>
        )}
        {mobile && (
          <button onClick={() => setIsMobileMenuOpen(false)} className="ml-auto" style={{ color: c.muted }}>
            <X size={20} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto custom-scrollbar">
        {filteredNav.map((item) => (
          mobile
            ? <Link
                key={item.name} to={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium"
                style={isActive(item.href) ? activeNavStyle : inactiveNavStyle}
              >
                <item.icon size={18} /><span>{item.name}</span>
              </Link>
            : <NavLink key={item.name} item={item} />
        ))}
      </nav>

      {/* User + logout */}
      <div className="p-3 flex-shrink-0" style={{ borderTop: `1px solid ${c.sidebarBorder}` }}>
        {(mobile || isSidebarOpen) && (
          <div className="flex items-center gap-3 px-2 py-2 mb-2 rounded-md" style={{ background: c.userCard }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: '#e11d48' }}>
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: c.text }}>{user?.username}</p>
              <p className="text-xs truncate capitalize" style={{ color: c.muted }}>{user?.role}</p>
            </div>
          </div>
        )}
        <button
          onClick={onLogout}
          title={!mobile && !isSidebarOpen ? t('logout') : undefined}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors"
          style={{ color: c.muted }}
          onMouseEnter={e => { e.currentTarget.style.background = c.logoutHoverBg; e.currentTarget.style.color = c.logoutHoverTxt }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = c.muted }}
        >
          <LogOut size={18} className="flex-shrink-0" />
          {(mobile || isSidebarOpen) && <span>{t('logout')}</span>}
        </button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen flex overflow-hidden font-sans" style={{ background: c.body, color: c.text }}>

      {/* ── Desktop Sidebar ── */}
      <aside
        className={`hidden lg:flex flex-col transition-all duration-300 relative z-30 flex-shrink-0 ${isSidebarOpen ? 'w-60' : 'w-16'}`}
        style={{ background: c.sidebar, borderRight: `1px solid ${c.sidebarBorder}` }}
      >
        <SidebarContent />

        {/* Collapse toggle */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full flex items-center justify-center z-40 shadow-md"
          style={{ background: '#e11d48', color: '#ffffff', border: `2px solid ${c.sidebar}` }}
        >
          {isSidebarOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
        </button>
      </aside>

      {/* ── Mobile Sidebar ── */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setIsMobileMenuOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 flex flex-col" style={{ background: c.sidebar }}>
            <SidebarContent mobile />
          </aside>
        </div>
      )}

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">

        {/* Header */}
        <header
          className="h-16 flex items-center justify-between px-4 sm:px-6 z-20 flex-shrink-0"
          style={{ background: c.header, borderBottom: `1px solid ${c.headerBorder}` }}
        >
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 rounded-md" style={{ color: c.muted }}>
              <Menu size={20} />
            </button>
            <div className="hidden md:flex items-center relative w-64 lg:w-80">
              <Search size={16} className="absolute left-3" style={{ color: c.muted }} />
              <input
                type="text"
                placeholder={t('searchPlaceholder')}
                className="w-full rounded-md py-2 pl-9 pr-4 text-sm outline-none"
                style={{ background: c.searchBg, border: `1px solid ${c.searchBorder}`, color: c.text }}
                onFocus={e => e.target.style.borderColor = '#e11d48'}
                onBlur={e => e.target.style.borderColor = c.searchBorder}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Language */}
            <div className="hidden sm:flex items-center gap-0.5 rounded-md p-1" style={{ background: c.langBg }}>
              {[{ code: 'en', label: 'EN' }, { code: 'am', label: 'አማ' }, { code: 'ti', label: 'ትግ' }].map((l) => (
                <button
                  key={l.code}
                  onClick={() => changeLanguage(l.code)}
                  className="px-2.5 py-1 rounded text-xs font-medium transition-colors"
                  style={lang === l.code ? { background: '#e11d48', color: '#ffffff' } : { color: c.muted }}
                >
                  {l.label}
                </button>
              ))}
            </div>

            {/* Theme */}
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2 rounded-md" style={{ color: c.muted }}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <div className="h-5 w-px" style={{ background: c.divider }} />

            {/* Avatar */}
            <div className="flex items-center gap-2">
              <div className="hidden md:flex flex-col items-end">
                <span className="text-sm font-medium" style={{ color: c.text }}>{user?.username}</span>
                <span className="text-xs" style={{ color: c.muted }}>{user?.branch_name || 'Main Office'}</span>
              </div>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: '#e11d48' }}>
                {user?.username?.[0]?.toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar" style={{ background: c.body }}>
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>

        {/* Footer */}
        <footer className="flex-shrink-0 px-4 sm:px-6 py-2 text-center text-xs" style={{ color: c.muted, borderTop: `1px solid ${c.sidebarBorder}`, background: c.header }}>
          Powered by <span className="font-medium" style={{ color: '#e11d48' }}>Etacom Technologies</span>
        </footer>
      </div>
    </div>
  )
}

export default Layout
